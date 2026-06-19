import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import {
  GRID_COL_WIDTH,
  GRID_ROW_HEIGHT,
  PIANO_STEPS_PER_BEAT,
} from './constants';
import type { Note, PianoRow, PianoTool, SelectionBox } from './types';
import { getHummingStreamUrl, transcribeHummingAudio } from './fileUtils';
import type { HummingStreamEvent } from './fileUtils';
import {
  DEVICE_SETTINGS_CHANGE_EVENT,
  getDeviceSettings,
  setDeviceSettings,
  type AudioDeviceSettings,
} from '../ui/deviceSettings';

type PianoRollOverlayProps = {
  isOpen: boolean;
  activeTrackName: string;
  bpm: number;
  bpmLabel: string;
  playheadBeat: number;
  isPlaying: boolean;
  clipLengthBeats: number;
  maxRecordingBeats: number;
  pianoTool: PianoTool;
  pianoRows: PianoRow[];
  activeTrackNotes: Note[];
  gridTotalCols: number;
  selectedNoteIds: number[];
  selectionBox: SelectionBox | null;
  gridRef: RefObject<HTMLDivElement | null>;
  pianoKeysRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSetPianoTool: (tool: PianoTool) => void;
  onPreviewPitch: (pitch: number, durationSeconds?: number) => void;
  onGridMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onGridDoubleClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onSyncVerticalScroll: (source: 'grid' | 'keys') => void;
  onNoteMouseDown: (
    event: ReactMouseEvent<HTMLElement>,
    note: Note,
    forcedMode?: 'move' | 'resize',
  ) => void;
  onDeleteNote: (noteId: number) => void;
  onPrepareRealtimeHumming: () => boolean;
  onRealtimeHummingCountInBeat: (beat: number) => void;
  onStartRealtimeHummingPlayback: () => Promise<void>;
  onRealtimeHummingProgress: (beat: number) => void;
  onRealtimeHummingEvent: (event: HummingStreamEvent) => void;
  onStopPlayback?: () => void;
};

type HummingWheelNote = {
  label: string;
  angleDeg: number;
};

type RecordingState = 'idle' | 'preparing' | 'recording' | 'stopping';

const HUMMING_WHEEL_NOTES: HummingWheelNote[] = [
  { label: 'A', angleDeg: 180 },
  { label: 'B', angleDeg: 230 },
  { label: 'C', angleDeg: 275 },
  { label: 'D', angleDeg: 330 },
  { label: 'E', angleDeg: 30 },
  { label: 'F', angleDeg: 85 },
  { label: 'G', angleDeg: 135 },
];

const MAX_PENDING_AUDIO_CHUNKS = 120;
const HUMMING_CLOCK_UI_UPDATE_MS = 16;
const HUMMING_PITCH_UI_UPDATE_MS = 120;
const HUMMING_NOTE_UI_UPDATE_MS = 160;
const HUMMING_SOCKET_OPEN_TIMEOUT_MS = 8000;
const HUMMING_BACKEND_READY_TIMEOUT_MS = 20000;
const HUMMING_AUTOSCROLL_UPDATE_MS = 120;
const HUMMING_CLIP_GROWTH_UPDATE_MS = 240;

const HUMMING_AUDIO_WORKLET = `
class HummingAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) {
      return true;
    }

    let inputOffset = 0;
    while (inputOffset < input.length) {
      const writable = this.buffer.length - this.offset;
      const readable = input.length - inputOffset;
      const count = Math.min(writable, readable);

      this.buffer.set(input.subarray(inputOffset, inputOffset + count), this.offset);
      this.offset += count;
      inputOffset += count;

      if (this.offset === this.buffer.length) {
        const chunk = new Float32Array(this.buffer.length);
        chunk.set(this.buffer);
        this.port.postMessage(chunk.buffer, [chunk.buffer]);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('humming-audio-processor', HummingAudioProcessor);
`;

const createHummingAudioWorkletNode = async (audioContext: AudioContext) => {
  if (!audioContext.audioWorklet) {
    throw new Error('AudioWorklet is not supported in this browser.');
  }

  const moduleUrl = URL.createObjectURL(new Blob([HUMMING_AUDIO_WORKLET], {
    type: 'application/javascript',
  }));

  try {
    await audioContext.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  return new AudioWorkletNode(audioContext, 'humming-audio-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
};

export function PianoRollOverlay({
  isOpen,
  activeTrackName,
  bpm,
  bpmLabel,
  playheadBeat,
  isPlaying,
  clipLengthBeats,
  maxRecordingBeats,
  pianoTool,
  pianoRows,
  activeTrackNotes,
  gridTotalCols,
  selectedNoteIds,
  selectionBox,
  gridRef,
  pianoKeysRef,
  onClose,
  onSetPianoTool,
  onPreviewPitch,
  onGridMouseDown,
  onGridDoubleClick,
  onSyncVerticalScroll,
  onNoteMouseDown,
  onDeleteNote,
  onPrepareRealtimeHumming,
  onRealtimeHummingCountInBeat,
  onStartRealtimeHummingPlayback,
  onRealtimeHummingProgress,
  onRealtimeHummingEvent,
  onStopPlayback,
}: PianoRollOverlayProps) {
  const [isHummingPanelOpen, setIsHummingPanelOpen] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [hummingError, setHummingError] = useState('');
  const [microphoneDevices, setMicrophoneDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState(() => getDeviceSettings().inputDeviceId);
  const [detectedNoteLabel, setDetectedNoteLabel] = useState('D3');
  const [pitchConfidence, setPitchConfidence] = useState<number | null>(null);
  const [detectedKey, setDetectedKey] = useState('--');
  const [streamedNoteCount, setStreamedNoteCount] = useState(0);
  const [streamStatus, setStreamStatus] = useState('Offline');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<AudioWorkletNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const pendingAudioChunksRef = useRef<ArrayBuffer[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingFrameRef = useRef<number | null>(null);
  const lastBackendPitchLogRef = useRef(0);
  const lastRecordingBeatUiUpdateRef = useRef(0);
  const lastAutoScrollUpdateRef = useRef(0);
  const lastClipGrowthUpdateRef = useRef(0);
  const lastPitchUiUpdateRef = useRef(0);
  const lastNoteUiUpdateRef = useRef(0);
  const stopFallbackTimerRef = useRef<number | null>(null);
  const recordingSessionRef = useRef(0);
  const recordingStateRef = useRef<RecordingState>('idle');
  const currentRecordingBeatRef = useRef(0);
  const cancelPreparingRef = useRef<(() => void) | null>(null);
  const livePlayheadRef = useRef<HTMLDivElement | null>(null);
  const captureProgressRef = useRef<HTMLDivElement | null>(null);
  const activeHummingNote = detectedNoteLabel.match(/[A-G]/)?.[0] ?? 'D';
  const activeWheelAngle = HUMMING_WHEEL_NOTES.find((note) => note.label === activeHummingNote)?.angleDeg ?? 330;
  const wheelRotationDeg = activeWheelAngle - 330;

  const totalBeats = gridTotalCols / PIANO_STEPS_PER_BEAT;
  const beatMarkings = Array.from({ length: totalBeats }, (_, i) => i);

  const setRecordingMode = (nextState: RecordingState) => {
    recordingStateRef.current = nextState;
    setRecordingState(nextState);
  };

  const applyRecordingBeat = (beat: number) => {
    const nextBeat = Math.max(0, beat);
    currentRecordingBeatRef.current = nextBeat;

    const currentGridWidth = Math.max(
      gridRef.current?.scrollWidth ?? 0,
      gridTotalCols * GRID_COL_WIDTH,
    );
    const maxLeft = Math.max(currentGridWidth - 2, 0);
    const left = Math.min(Math.max(nextBeat * PIANO_STEPS_PER_BEAT * GRID_COL_WIDTH, 0), maxLeft);
    if (livePlayheadRef.current) {
      livePlayheadRef.current.style.transform = `translateX(${left}px)`;
    }

    const visibleGridBeats = currentGridWidth / (PIANO_STEPS_PER_BEAT * GRID_COL_WIDTH);
    const visibleLengthBeats = Math.max(clipLengthBeats, visibleGridBeats, nextBeat + 0.25, 0.25);
    const progressPercent = recordingStateRef.current === 'idle'
      ? 4
      : Math.max(Math.min((nextBeat / visibleLengthBeats) * 100, 100), 4);
    if (captureProgressRef.current) {
      captureProgressRef.current.style.width = `${progressPercent}%`;
    }

    const now = performance.now();
    if (
      recordingStateRef.current === 'recording'
      && now - lastClipGrowthUpdateRef.current >= HUMMING_CLIP_GROWTH_UPDATE_MS
    ) {
      lastClipGrowthUpdateRef.current = now;
      onRealtimeHummingProgress(nextBeat);
    }

    if (
      recordingStateRef.current === 'recording'
      && gridRef.current
      && now - lastAutoScrollUpdateRef.current >= HUMMING_AUTOSCROLL_UPDATE_MS
    ) {
      lastAutoScrollUpdateRef.current = now;
      gridRef.current.scrollLeft = Math.max(0, left - gridRef.current.clientWidth * 0.58);
    }
  };

  useEffect(() => {
    if (recordingState === 'idle' && livePlayheadRef.current) {
      const currentGridWidth = Math.max(
        gridRef.current?.scrollWidth ?? 0,
        gridTotalCols * GRID_COL_WIDTH,
      );
      const maxLeft = Math.max(currentGridWidth - 2, 0);
      const left = Math.min(Math.max(playheadBeat * PIANO_STEPS_PER_BEAT * GRID_COL_WIDTH, 0), maxLeft);
      livePlayheadRef.current.style.transform = `translateX(${left}px)`;

      // Auto scroll to keep playhead in view during playback
      if (isPlaying && gridRef.current) {
        const scrollContainer = gridRef.current;
        const visibleWidth = scrollContainer.clientWidth;
        const scrollLeft = scrollContainer.scrollLeft;
        if (left > scrollLeft + visibleWidth - 100 || left < scrollLeft + 50) {
          scrollContainer.scrollLeft = Math.max(0, left - visibleWidth * 0.25);
        }
      }
    }
  }, [playheadBeat, gridTotalCols, recordingState, isPlaying]);

  const loadMicrophoneDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((device) => device.kind === 'audioinput');

    setMicrophoneDevices(audioInputs);
    if (!selectedInputDeviceId && audioInputs[0]) {
      setSelectedInputDeviceId(audioInputs[0].deviceId);
    }
  };

  const stopRecordingClock = () => {
    if (recordingFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }
    recordingStartTimeRef.current = null;
  };

  const startRecordingClock = () => {
    stopRecordingClock();
    recordingStartTimeRef.current = performance.now();
    lastRecordingBeatUiUpdateRef.current = 0;
    lastAutoScrollUpdateRef.current = 0;
    lastClipGrowthUpdateRef.current = 0;
    applyRecordingBeat(0);

    const tick = () => {
      if (recordingStartTimeRef.current === null) {
        return;
      }

      const now = performance.now();
      if (now - lastRecordingBeatUiUpdateRef.current >= HUMMING_CLOCK_UI_UPDATE_MS) {
        lastRecordingBeatUiUpdateRef.current = now;
        const elapsedSeconds = (now - recordingStartTimeRef.current) / 1000;
        const elapsedBeats = Math.min(elapsedSeconds * (bpm / 60), maxRecordingBeats);
        applyRecordingBeat(Math.max(currentRecordingBeatRef.current, elapsedBeats));
      }
      recordingFrameRef.current = window.requestAnimationFrame(tick);
    };

    recordingFrameRef.current = window.requestAnimationFrame(tick);
  };

  const stopAudioCapture = () => {
    if (onStopPlayback) {
      onStopPlayback();
    }
    if (stopFallbackTimerRef.current !== null) {
      window.clearTimeout(stopFallbackTimerRef.current);
      stopFallbackTimerRef.current = null;
    }
    stopRecordingClock();
    pendingAudioChunksRef.current = [];

    if (audioProcessorRef.current) {
      audioProcessorRef.current.port.onmessage = null;
      audioProcessorRef.current.port.close();
      audioProcessorRef.current.disconnect();
    }
    audioSourceRef.current?.disconnect();
    monitorGainRef.current?.disconnect();
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    monitorGainRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const closeRealtimeSocket = () => {
    const socket = websocketRef.current;
    websocketRef.current = null;
    pendingAudioChunksRef.current = [];
    if (!socket) {
      return;
    }

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };

  const stopRealtimeHummingRecording = () => {
    recordingSessionRef.current += 1;
    cancelPreparingRef.current?.();
    cancelPreparingRef.current = null;
    setRecordingMode('stopping');
    setStreamStatus('Stopping');
    stopAudioCapture();

    const socket = websocketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'stop' }));
      stopFallbackTimerRef.current = window.setTimeout(() => {
        closeRealtimeSocket();
        setRecordingMode('idle');
        setStreamStatus('Offline');
        applyRecordingBeat(0);
      }, 1200);
      return;
    }

    closeRealtimeSocket();
    setRecordingMode('idle');
    setStreamStatus('Offline');
    applyRecordingBeat(0);
  };

  const handleStreamEvent = (event: HummingStreamEvent) => {
    if (event.type === 'ready') {
      setStreamStatus(event.source.toUpperCase());
      console.info('[Humming] backend ready', {
        liveSource: event.source,
        sourceSampleRate: event.sourceSampleRate,
        analysisSampleRate: event.analysisSampleRate,
        bpm: event.bpm,
        clipLengthBeats: event.clipLengthBeats,
      });
      return;
    }

    if (event.type === 'pitch') {
      const now = performance.now();
      if (now - lastPitchUiUpdateRef.current >= HUMMING_PITCH_UI_UPDATE_MS) {
        lastPitchUiUpdateRef.current = now;
        applyRecordingBeat(Math.max(currentRecordingBeatRef.current, event.beat, 0));
        setPitchConfidence(event.confidence);
        if (event.voiced && event.note) {
          setDetectedNoteLabel(event.note);
        }
      }
      if (event.timestampMs - lastBackendPitchLogRef.current > 1000 || lastBackendPitchLogRef.current === 0) {
        lastBackendPitchLogRef.current = event.timestampMs;
        console.debug('[Humming] backend pitch', {
          source: event.source,
          voiced: event.voiced,
          note: event.note,
          f0Hz: event.f0Hz,
          confidence: event.confidence,
          rms: event.rms,
          beat: event.beat,
        });
      }
      return;
    }

    if (event.type === 'note_on' || event.type === 'note_update' || event.type === 'note_off') {
      const now = performance.now();
      if (event.type === 'note_update' && now - lastNoteUiUpdateRef.current < HUMMING_NOTE_UI_UPDATE_MS) {
        return;
      }

      lastNoteUiUpdateRef.current = now;
      setDetectedNoteLabel(event.note.note);
      setPitchConfidence(event.note.confidence);
      applyRecordingBeat(Math.max(currentRecordingBeatRef.current, event.note.startBeat + event.note.durationBeats, 0));
      if (event.type === 'note_on') {
        setStreamedNoteCount((count) => count + 1);
      }
      onRealtimeHummingEvent(event);
      return;
    }

    if (event.type === 'complete') {
      setDetectedKey(event.key);
      setStreamedNoteCount(event.notes.length);
      console.info('[Humming] complete', {
        liveSource: event.liveSource,
        finalSource: event.source,
        finalNotes: event.notes.length,
        liveNotes: event.liveNotes?.length ?? 0,
        key: event.key,
      });
      onRealtimeHummingEvent(event);
      closeRealtimeSocket();
      stopAudioCapture();
      setRecordingMode('idle');
      setStreamStatus('Offline');
      applyRecordingBeat(0);
      return;
    }

    if (event.type === 'error') {
      setHummingError(event.message);
      console.error('[Humming] backend error', event.message);
    }
  };

  const startHummingRecording = async () => {
    if (!onPrepareRealtimeHumming()) {
      return;
    }

    setHummingError('');
    setDetectedKey('--');
    setDetectedNoteLabel('D3');
    setPitchConfidence(null);
    applyRecordingBeat(0);
    setStreamedNoteCount(0);
    lastBackendPitchLogRef.current = 0;
    lastPitchUiUpdateRef.current = 0;
    lastNoteUiUpdateRef.current = 0;
    const sessionId = recordingSessionRef.current + 1;
    recordingSessionRef.current = sessionId;

    if (!navigator.mediaDevices?.getUserMedia) {
      setHummingError('Microphone recording is not supported in this browser.');
      return;
    }

    setRecordingMode('preparing');
    setStreamStatus('Preparing');
    console.info('[Humming] record start', {
      mode: 'backend_rmvpe',
      bpm,
      maxRecordingBeats,
    });

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const streamUrl = getHummingStreamUrl({
        sampleRate: audioContext.sampleRate,
        bpm,
        clipLengthBeats: maxRecordingBeats,
        quantize: '1/16',
      });
      console.info('[Humming] websocket open', streamUrl);
      const socket = new WebSocket(streamUrl);
      socket.binaryType = 'arraybuffer';
      websocketRef.current = socket;

      const socketOpenPromise = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('Humming AI socket timed out.'));
        }, HUMMING_SOCKET_OPEN_TIMEOUT_MS);

        socket.addEventListener('open', () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });

        socket.addEventListener('error', () => {
          window.clearTimeout(timeout);
          reject(new Error('Humming AI stream failed. Check backend server.'));
        }, { once: true });
      });

      let backendReady = false;
      let resolveBackendReady: (() => void) | null = null;
      let rejectBackendReady: ((error: Error) => void) | null = null;
      const backendReadyPromise = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('Humming AI backend is still preparing. Try again after the model loads.'));
        }, HUMMING_BACKEND_READY_TIMEOUT_MS);

        resolveBackendReady = () => {
          backendReady = true;
          window.clearTimeout(timeout);
          resolve();
        };

        rejectBackendReady = (error: Error) => {
          window.clearTimeout(timeout);
          reject(error);
        };
      });
      cancelPreparingRef.current = () => {
        rejectBackendReady?.(new Error('Recording canceled.'));
      };

      socket.onmessage = (message) => {
        if (typeof message.data !== 'string') {
          return;
        }

        const streamEvent = JSON.parse(message.data) as HummingStreamEvent;
        if (streamEvent.type === 'ready' && resolveBackendReady) {
          resolveBackendReady();
          resolveBackendReady = null;
        }
        if (streamEvent.type === 'error' && rejectBackendReady && !backendReady) {
          rejectBackendReady(new Error(streamEvent.message));
          rejectBackendReady = null;
        }
        handleStreamEvent(streamEvent);
      };

      socket.onerror = () => {
        rejectBackendReady?.(new Error('Humming AI stream failed. Check backend server.'));
        rejectBackendReady = null;
        setHummingError('Humming AI stream failed. Check backend server.');
        console.error('[Humming] websocket error');
        stopAudioCapture();
        setRecordingMode('idle');
        setStreamStatus('Offline');
        applyRecordingBeat(0);
      };

      socket.onclose = () => {
        if (!backendReady && rejectBackendReady) {
          rejectBackendReady(new Error('Humming AI stream closed before it was ready.'));
          rejectBackendReady = null;
        }
        console.info('[Humming] websocket closed');
        stopAudioCapture();
        setRecordingMode('idle');
        setStreamStatus('Offline');
        applyRecordingBeat(0);
      };

      const streamPromise = navigator.mediaDevices.getUserMedia({
        audio: selectedInputDeviceId ? { deviceId: { exact: selectedInputDeviceId } } : true,
      });

      const [stream] = await Promise.all([streamPromise, socketOpenPromise, backendReadyPromise]);
      if (recordingSessionRef.current !== sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        closeRealtimeSocket();
        return;
      }
      mediaStreamRef.current = stream;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = await createHummingAudioWorkletNode(audioContext);
      const monitorGain = audioContext.createGain();

      monitorGain.gain.value = 0;

      processor.port.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) {
          return;
        }

        if (socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        } else if (socket.readyState === WebSocket.CONNECTING) {
          pendingAudioChunksRef.current.push(event.data);
          if (pendingAudioChunksRef.current.length > MAX_PENDING_AUDIO_CHUNKS) {
            pendingAudioChunksRef.current.shift();
          }
        }
      };

      audioSourceRef.current = source;
      audioProcessorRef.current = processor;
      monitorGainRef.current = monitorGain;

      await loadMicrophoneDevices();
      if (recordingSessionRef.current !== sessionId) {
        stopAudioCapture();
        closeRealtimeSocket();
        return;
      }

      const countInBeatMs = 60_000 / bpm;
      for (let beat = 1; beat <= 4; beat += 1) {
        if (recordingSessionRef.current !== sessionId) {
          stopAudioCapture();
          closeRealtimeSocket();
          return;
        }
        setStreamStatus(`Count-in ${5 - beat}`);
        onRealtimeHummingCountInBeat(beat);
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, countInBeatMs);
        });
      }

      await onStartRealtimeHummingPlayback();
      if (recordingSessionRef.current !== sessionId) {
        stopAudioCapture();
        closeRealtimeSocket();
        return;
      }

      source.connect(processor);
      processor.connect(monitorGain);
      monitorGain.connect(audioContext.destination);

      setRecordingMode('recording');
      setStreamStatus((status) => (status === 'Preparing' ? 'Streaming' : status));
      startRecordingClock();
      console.info('[Humming] capture streaming', {
        sampleRate: audioContext.sampleRate,
        inputDeviceId: selectedInputDeviceId || 'default',
      });
    } catch (error) {
      if (recordingSessionRef.current !== sessionId) {
        stopAudioCapture();
        closeRealtimeSocket();
        return;
      }

      stopAudioCapture();
      closeRealtimeSocket();
      setRecordingMode('idle');
      setStreamStatus('Offline');
      applyRecordingBeat(0);
      setHummingError(error instanceof Error ? error.message : 'Recording failed.');
    } finally {
      if (recordingSessionRef.current === sessionId) {
        cancelPreparingRef.current = null;
      }
    }
  };

  const handleAudioFileUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (!onPrepareRealtimeHumming()) {
      return;
    }

    setIsUploadingAudio(true);
    setHummingError('');
    setDetectedKey('--');
    setPitchConfidence(null);
    setStreamedNoteCount(0);
    setStreamStatus('Uploading');

    try {
      console.info('[Humming] file upload start', {
        name: file.name,
        type: file.type,
        size: file.size,
      });
      const result = await transcribeHummingAudio(file, bpm, maxRecordingBeats, '1/16');
      setDetectedKey(result.key);
      setStreamedNoteCount(result.notes.length);
      setStreamStatus('File Result');
      console.info('[Humming] file upload complete', {
        key: result.key,
        notes: result.notes.length,
      });
      onRealtimeHummingEvent({
        type: 'complete',
        key: result.key,
        notes: result.notes,
        source: 'backend_file',
        liveSource: 'file_upload',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Audio file transcription failed.';
      setHummingError(message);
      setStreamStatus('Offline');
      console.error('[Humming] file upload failed', message);
    } finally {
      setIsUploadingAudio(false);
      if (audioFileInputRef.current) {
        audioFileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      closeRealtimeSocket();
      stopAudioCapture();
    };
  }, []);

  useEffect(() => {
    if (isHummingPanelOpen) {
      void loadMicrophoneDevices();
    }
  }, [isHummingPanelOpen]);

  useEffect(() => {
    const handleDeviceSettingsChange = (event: Event) => {
      const settings = (event as CustomEvent<AudioDeviceSettings>).detail ?? getDeviceSettings();
      setSelectedInputDeviceId(settings.inputDeviceId);
    };

    window.addEventListener(DEVICE_SETTINGS_CHANGE_EVENT, handleDeviceSettingsChange);
    return () => window.removeEventListener(DEVICE_SETTINGS_CHANGE_EVENT, handleDeviceSettingsChange);
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void loadMicrophoneDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [selectedInputDeviceId]);

  const getWheelPointStyle = (angleDeg: number, radiusPercent: number) => {
    const radian = (angleDeg * Math.PI) / 180;
    const x = 50 + Math.cos(radian) * radiusPercent;
    const y = 50 + Math.sin(radian) * radiusPercent;
    return {
      left: `${x}%`,
      top: `${y}%`,
    };
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-background flex flex-col overflow-hidden select-none">
      <header className="bg-[#0e0e0e] text-[#f4ffc6] font-['Inter'] font-mono text-[11px] tracking-widest uppercase flex justify-between items-center w-full px-4 h-12">
        <div className="flex items-center gap-8">
          <span className="text-lg font-black tracking-tighter text-[#f4ffc6] uppercase">Bach Studio</span>
          <span className="text-[9px] text-zinc-500 uppercase">Piano Roll · {activeTrackName}</span>
        </div>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1"
          title="Close Piano Roll"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="bg-[#131313] w-16 border-r-0 flex flex-col items-center py-4 space-y-1 z-40">
          <button
            onClick={() => onSetPianoTool('select')}
            className={`w-12 h-12 flex flex-col items-center justify-center transition-all duration-75 ${pianoTool === 'select' ? 'bg-[#20201f] text-[#f4ffc6] border-l-2 border-[#f4ffc6]' : 'text-zinc-600 hover:bg-[#2c2c2c]'}`}
          >
            <span className="material-symbols-outlined text-[20px]">near_me</span>
            <span className="text-[8px] font-bold mt-1 uppercase">Select</span>
          </button>
          <button
            onClick={() => onSetPianoTool('draw')}
            className={`w-12 h-12 flex flex-col items-center justify-center transition-all duration-75 ${pianoTool === 'draw' ? 'bg-[#20201f] text-[#f4ffc6] border-l-2 border-[#f4ffc6]' : 'text-zinc-600 hover:bg-[#2c2c2c]'}`}
          >
            <span className="material-symbols-outlined text-[20px]">edit</span>
            <span className="text-[8px] font-bold mt-1 uppercase">Draw</span>
          </button>
        </aside>

        <main className="flex-1 flex flex-col bg-surface-container-low overflow-hidden">
          <div className="h-10 bg-surface flex items-center px-4 gap-6 border-b border-outline-variant/20">

            <div className="flex-1"></div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsHummingPanelOpen((prev) => !prev)}
                className={`h-7 px-3 border text-[9px] font-black uppercase tracking-widest transition-all ${isHummingPanelOpen ? 'bg-[#ff9ba4] text-black border-[#ffc4ca]' : 'bg-[#17191d] text-[#f3f5fb] border-white/15 hover:border-[#ff9ba4]/70 hover:text-[#ffb2ba]'}`}
                title="Toggle Humming AI"
              >
                Humming AI
              </button>
              <div className="flex items-center gap-4 text-[10px] font-mono text-primary">
                <span className="text-on-surface-variant">BPM:</span> {bpmLabel}
              </div>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            <div className="flex h-full overflow-hidden">
              <div
                ref={pianoKeysRef}
                onScroll={() => onSyncVerticalScroll('keys')}
                className="w-20 flex-shrink-0 bg-surface-container-highest overflow-y-auto overflow-x-hidden border-r border-outline-variant/20 no-scrollbar"
              >
                <div className="sticky top-0 h-6 bg-[#131313] border-b border-outline-variant/30 border-r border-outline-variant/20 z-50 flex items-center justify-center text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                  Pitch
                </div>
                {pianoRows.map((key) => (
                  <button
                    key={key.row}
                    onMouseDown={() => {
                      onPreviewPitch(key.row, 0.45);
                    }}
                    className="block h-[23px] mb-px relative w-full text-left"
                  >
                    {key.icon ? (
                      <div className="h-full w-full bg-[#1b1c21] border-r border-outline-variant/35 flex items-center justify-between px-2 text-[#ff9ba4]">
                        <span className="material-symbols-outlined text-[12px]">
                          {key.icon === 'kick' ? 'circle' : key.icon === 'snare' ? 'menu' : key.icon === 'hat' ? 'toll' : 'pan_tool'}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-300">{key.label}</span>
                      </div>
                    ) : (
                      <>
                        {key.isBlack ? (
                          <div className="h-full w-[70%] bg-[#0a0a0a] border-r border-black/70"></div>
                        ) : (
                          <div className="h-full w-full bg-[#d8d8d8] border-r border-zinc-500/50"></div>
                        )}
                        {key.label && (
                          <span className={`absolute right-1 bottom-0.5 text-[8px] font-bold ${key.isBlack ? 'text-zinc-200' : 'text-zinc-800'}`}>
                            {key.label}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ))}
              </div>

              <div
                ref={gridRef}
                onMouseDown={onGridMouseDown}
                onDoubleClick={onGridDoubleClick}
                onScroll={() => onSyncVerticalScroll('grid')}
                className="flex-1 relative overflow-auto select-none no-scrollbar"
                style={{
                  cursor: pianoTool === 'draw' ? 'crosshair' : 'default',
                }}
              >
                <div 
                  className="sticky top-0 h-6 bg-[#131313] border-b border-outline-variant/30 z-50 flex select-none" 
                  style={{ width: `${gridTotalCols * GRID_COL_WIDTH}px` }}
                >
                  {beatMarkings.map((beat) => (
                    <div 
                      key={`ruler-beat-${beat}`} 
                      className="absolute border-l border-outline-variant/20 h-full flex items-end pb-1 pl-1 text-[9px] font-mono text-zinc-400"
                      style={{ 
                        left: `${beat * PIANO_STEPS_PER_BEAT * GRID_COL_WIDTH}px`,
                        width: `${PIANO_STEPS_PER_BEAT * GRID_COL_WIDTH}px`
                      }}
                    >
                      <span className="font-bold text-zinc-300">{beat + 1}</span>
                      <div className="absolute left-1/4 bottom-0 h-1 border-l border-zinc-600/30"></div>
                      <div className="absolute left-2/4 bottom-0 h-2 border-l border-[#ff9ba4]/20"></div>
                      <div className="absolute left-3/4 bottom-0 h-1 border-l border-zinc-600/30"></div>
                    </div>
                  ))}
                </div>

                <div
                  className="relative"
                  style={{
                    width: `${gridTotalCols * GRID_COL_WIDTH}px`,
                    height: `${pianoRows.length * GRID_ROW_HEIGHT}px`,
                    backgroundSize: `${GRID_COL_WIDTH}px ${GRID_ROW_HEIGHT}px`,
                    backgroundImage: 'linear-gradient(to right, #262626 1px, transparent 1px)',
                  }}
                >
                  <div className="absolute inset-0 pointer-events-none z-0">
                    {pianoRows.map((key) => (
                      <div
                        key={`row-bg-${key.row}`}
                        className={`absolute left-0 right-0 border-b border-black/35 ${key.isBlack ? 'bg-black/20' : 'bg-white/[0.02]'}`}
                        style={{
                          top: `${key.row * GRID_ROW_HEIGHT}px`,
                          height: `${GRID_ROW_HEIGHT}px`,
                        }}
                      ></div>
                    ))}
                  </div>
                  <div
                    ref={livePlayheadRef}
                    className="absolute top-0 bottom-0 left-0 w-[2px] bg-primary z-30 shadow-[0_0_10px_rgba(244,255,198,0.5)] will-change-transform"
                    style={{ transform: 'translateX(0px)' }}
                  ></div>

                  {activeTrackNotes.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                      <span className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
                        {pianoTool === 'draw'
                          ? 'Empty Piano Roll · Click Grid To Add Notes'
                          : 'Empty Piano Roll · Drag To Select Area / Switch To Draw To Add Notes'}
                      </span>
                    </div>
                  )}

                  {selectionBox && (
                    <div
                      className="absolute border border-primary bg-primary/20 pointer-events-none z-40"
                      style={{
                        left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
                        top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
                        width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
                        height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
                      }}
                    ></div>
                  )}

                  {activeTrackNotes.map((note) => (
                    <div
                      key={note.id}
                      data-note="1"
                      onMouseDown={(event) => onNoteMouseDown(event, note)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        onDeleteNote(note.id);
                      }}
                      className={`absolute text-black flex items-center px-2 text-[9px] font-bold border-l-2 ${pianoTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${selectedNoteIds.includes(note.id) ? 'bg-primary border-primary-container ring-1 ring-white/60' : 'bg-primary/80 border-primary-container/70'}`}
                      style={{
                        top: `${note.pitch * GRID_ROW_HEIGHT}px`,
                        left: `${note.start * GRID_COL_WIDTH}px`,
                        width: `${note.length * GRID_COL_WIDTH}px`,
                        height: `${GRID_ROW_HEIGHT}px`,
                      }}
                      title="Select mode: click to select, drag to move, drag right resize handle to resize, right-click to delete"
                    >
                      {pianoTool === 'select' && (
                        <span
                          onMouseDown={(event) => {
                            event.stopPropagation();
                            onNoteMouseDown(event, note, 'resize');
                          }}
                          className="absolute right-0 top-0 h-full w-2 border-l border-black/30 bg-black/20 hover:bg-black/35 cursor-ew-resize"
                          title="Resize note"
                        ></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside
              className={`absolute top-0 right-0 h-full w-[360px] border-l border-white/10 bg-[#14171d]/95 backdrop-blur-md shadow-[-24px_0_40px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out ${isHummingPanelOpen ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none'}`}
            >
              <div className="h-full flex flex-col px-5 py-4 gap-4 overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#ff9ba4]">graphic_eq</span>
                    <span className="text-[12px] font-black tracking-widest uppercase text-[#ffb4bb]">Humming AI</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHummingPanelOpen(false)}
                    className="text-zinc-400 hover:text-white"
                    title="Close Humming AI"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Input Device</span>
                  <select
                    value={selectedInputDeviceId}
                    onChange={(event) => {
                      const inputDeviceId = event.target.value;
                      setSelectedInputDeviceId(inputDeviceId);
                      setDeviceSettings({ ...getDeviceSettings(), inputDeviceId });
                    }}
                    disabled={recordingState !== 'idle'}
                    className="h-9 bg-[#191c23] border border-white/10 text-[10px] font-mono uppercase tracking-wider text-[#f3f5fb] px-2 outline-none focus:border-[#ff9ba4]/70 disabled:opacity-50"
                  >
                    {microphoneDevices.length === 0 ? (
                      <option value="">Default Microphone</option>
                    ) : (
                      microphoneDevices.map((device, index) => (
                        <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
                          {device.label || `Microphone ${index + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <div className="rounded-md border border-white/10 bg-[#191c23] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Realtime Pitch Wheel</span>
                    <span className="text-[10px] font-mono text-[#ff9ba4]">{detectedNoteLabel}</span>
                  </div>

                  <div className="mt-3 mx-auto relative h-[260px] w-[260px]">
                    <svg viewBox="0 0 260 260" className="h-full w-full drop-shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                      <circle cx="130" cy="130" r="126" fill="#1d2129" />
                      <circle cx="130" cy="130" r="126" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />

                      <circle cx="130" cy="130" r="98" fill="#252a33" />
                      <circle cx="130" cy="130" r="98" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                      <circle cx="130" cy="130" r="74" fill="#20242c" />
                      <circle cx="130" cy="130" r="74" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                      <circle cx="130" cy="130" r="50" fill="#1a1f27" />
                      <circle cx="130" cy="130" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

                      <g
                        style={{
                          transform: `rotate(${wheelRotationDeg}deg)`,
                          transformOrigin: '130px 130px',
                          transition: 'transform 180ms ease-out',
                        }}
                      >
                        <path d="M130 130 L219 55 A116 116 0 0 1 245 114 Z" fill="rgba(255, 162, 171, 0.96)" />
                        <path d="M130 130 L198 74 A86 86 0 0 1 215 118 Z" fill="rgba(255, 162, 171, 0.6)" />
                        <path d="M130 130 L174 92 A58 58 0 0 1 187 123 Z" fill="rgba(255, 162, 171, 0.38)" />
                      </g>

                      <circle cx="130" cy="130" r="28" fill="#11161f" />
                      <circle cx="130" cy="130" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                      <text x="130" y="142" textAnchor="middle" className="fill-[#ff8f99] text-[18px] font-black tracking-tight">{detectedNoteLabel}</text>
                    </svg>

                    {HUMMING_WHEEL_NOTES.map((note) => (
                      <span
                        key={`humming-wheel-${note.label}`}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 text-[16px] font-black tracking-tight ${note.label === activeHummingNote ? 'bg-[#ff9ba4] text-[#151922] px-2 py-0.5 rounded-sm' : 'text-zinc-100'}`}
                        style={getWheelPointStyle(note.angleDeg, 42)}
                      >
                        {note.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="rounded-sm border border-white/10 bg-[#1a1e26] p-3">
                    <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500">Pitch Stability</span>
                    <span className="mt-1 block font-mono text-[#ffb4bb]">
                      {pitchConfidence !== null ? `${Math.round(pitchConfidence * 100)}%` : '--'}
                    </span>
                  </div>
                  <div className="rounded-sm border border-white/10 bg-[#1a1e26] p-3">
                    <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500">Detected Key</span>
                    <span className="mt-1 block font-mono text-[#ffb4bb]">{detectedKey}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Capture Status</span>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      ref={captureProgressRef}
                      className="h-full bg-[#ff9ba4]"
                      style={{ width: '4%' }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[9px] font-mono uppercase tracking-widest text-zinc-500">
                    <span>{streamStatus}</span>
                    <span>{streamedNoteCount} notes</span>
                  </div>
                </div>

                {hummingError && (
                  <div className="rounded-sm border border-red-400/30 bg-red-500/10 px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-red-200">
                    {hummingError}
                  </div>
                )}

                <div className="mt-auto">
                  <input
                    ref={audioFileInputRef}
                    type="file"
                    accept="audio/*,.wav,.mp3,.webm,.m4a,.ogg,.flac"
                    className="hidden"
                    onChange={(event) => {
                      void handleAudioFileUpload(event.target.files?.[0] ?? null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => audioFileInputRef.current?.click()}
                    disabled={recordingState !== 'idle' || isUploadingAudio}
                    className="mb-2 h-10 border border-white/15 bg-[#17191d] text-[#f3f5fb] font-black text-[10px] uppercase tracking-[0.14em] transition-colors hover:border-[#ff9ba4]/70 hover:text-[#ffb2ba] disabled:opacity-40 disabled:cursor-not-allowed w-full"
                  >
                    {isUploadingAudio ? 'Analyzing File' : 'Test Audio File'}
                  </button>
                  <button
                    type="button"
                    onClick={recordingState === 'idle' ? startHummingRecording : stopRealtimeHummingRecording}
                    disabled={recordingState === 'stopping' || isUploadingAudio}
                    className={`h-10 border font-black text-[10px] uppercase tracking-[0.14em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      recordingState === 'recording' || recordingState === 'preparing'
                        ? 'border-red-300/70 bg-red-500/20 text-red-100'
                        : 'border-white/15 bg-[#17191d] text-[#f3f5fb] hover:border-[#ff9ba4]/70 hover:text-[#ffb2ba]'
                    } w-full`}
                  >
                    {recordingState === 'recording'
                      ? 'Stop'
                      : recordingState === 'preparing'
                        ? 'Preparing'
                        : recordingState === 'stopping'
                          ? 'Stopping'
                          : 'Record'}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
