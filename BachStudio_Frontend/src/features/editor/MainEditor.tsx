import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import lameJsScriptUrl from 'lamejs/lame.min.js?url';
import * as Tone from 'tone';
import {
  loadProjectFromBackend,
  saveProjectToBackend,
} from './fileUtils';
import type { HummingAiNote, HummingStreamEvent } from './fileUtils';
import {
  AUDIO_OUTPUT_COMP_DB,
  AUDIO_SOURCE_OPTIONS,
  BLACK_SEMITONES,
  CLIP_DEFAULT_LENGTH_BEATS,
  CLIP_SNAP_BEATS,
  CLIP_CLASS_BY_TYPE,
  DEFAULT_TRACK_SETTINGS,
  DRUM_KIT_OPTIONS,
  DRUM_OUTPUT_COMP_DB,
  GRID_COL_WIDTH,
  GRID_ROW_HEIGHT,
  GRID_TOTAL_ROWS,
  INSTRUMENT_OUTPUT_COMP_DB,
  INSTRUMENT_PRESET_OPTIONS,
  MIDI_HIGH,
  MIDI_LOW,
  NOTE_NAMES,
  PIANO_STEPS_PER_BEAT,
  TIMELINE_BEATS_PER_BAR,
  TIMELINE_TOTAL_BEATS,
} from './constants';
import { PianoRollOverlay } from './PianoRollOverlay';
import { TimelinePanel } from './TimelinePanel';
import { HeaderUtilityButtons } from '../ui/HeaderUtilityButtons';
import {
  DEVICE_SETTINGS_CHANGE_EVENT,
  getDeviceSettings,
  type AudioDeviceSettings,
} from '../ui/deviceSettings';
import type {
  AudioSourceId,
  Clip,
  DragState,
  Note,
  PianoTool,
  SelectionBox,
  Track,
  TrackType,
} from './types';

type PlaybackNoteEvent = {
  startBeat: number;
  durationSeconds: number;
  pitch: number | null;
  trackId: number;
  trackType: TrackType;
  instrumentPresetId: Track['instrumentPresetId'];
  drumKitId: Track['drumKitId'];
  audioSourceId: AudioSourceId;
  audioDataUrl?: string;
  audioStartOffset?: number;
  effectiveVolumeDb: number;
};

type TrackEffectChain = {
  input: Tone.Gain;
  distortion: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
};

type CopiedMidiChunk = {
  clips: Clip[];
};

type SelectedTimelineClip = {
  trackId: number;
  clipId: number;
};

type ExportFormat = 'wav' | 'mp3';
type EditorSnapshot = {
  tracks: Track[];
  bpm: number;
  loopRange: { startBeat: number; endBeat: number };
  masterVolumeDb: number;
};
type LameJsRuntime = {
  Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => {
    encodeBuffer: (left: Int16Array, right?: Int16Array) => Int8Array;
    flush: () => Int8Array;
  };
};

const MAX_REALTIME_HUMMING_BEATS = TIMELINE_TOTAL_BEATS;
const PLAYBACK_TIMER_MS = 20;
const PLAYHEAD_UI_UPDATE_MS = 33;
const HUMMING_NOTE_UPDATE_MS = 160;
const REALTIME_CLIP_GROWTH_BEATS = 16;
const HISTORY_LIMIT = 100;
let lameJsRuntimePromise: Promise<LameJsRuntime> | null = null;

const loadLameJsRuntime = () => {
  const existingRuntime = (window as Window & { lamejs?: LameJsRuntime }).lamejs;
  if (existingRuntime?.Mp3Encoder) {
    return Promise.resolve(existingRuntime);
  }

  if (!lameJsRuntimePromise) {
    lameJsRuntimePromise = new Promise<LameJsRuntime>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = lameJsScriptUrl;
      script.async = true;
      script.onload = () => {
        const runtime = (window as Window & { lamejs?: LameJsRuntime }).lamejs;
        if (runtime?.Mp3Encoder) {
          resolve(runtime);
          return;
        }
        reject(new Error('MP3 encoder failed to initialize'));
      };
      script.onerror = () => reject(new Error('MP3 encoder failed to load'));
      document.head.appendChild(script);
    });
  }

  return lameJsRuntimePromise;
};

export function MainEditor() {
  const [searchParams] = useSearchParams();
  const [isPianoRollOpen, setIsPianoRollOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [activePianoTrackId, setActivePianoTrackId] = useState<number | null>(null);
  const [activePianoClipId, setActivePianoClipId] = useState<number | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [pianoTool, setPianoTool] = useState<PianoTool>('select');
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [copiedNotes, setCopiedNotes] = useState<Note[] | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [clipDragState, setClipDragState] = useState<null | {
    trackId: number;
    clipId: number;
    startClientX: number;
    originStart: number;
    beatWidth: number;
  }>(null);
  const [clipResizeState, setClipResizeState] = useState<null | {
    trackId: number;
    clipId: number;
    startClientX: number;
    originLength: number;
    beatWidth: number;
  }>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [playheadBeat, setPlayheadBeat] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copiedMidiChunk, setCopiedMidiChunk] = useState<CopiedMidiChunk | null>(null);
  const [selectedTimelineClip, setSelectedTimelineClip] = useState<SelectedTimelineClip | null>(null);
  const [isLoopPlaybackOn, setIsLoopPlaybackOn] = useState(false);
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  const [saveNotification, setSaveNotification] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [loopRange, setLoopRange] = useState<{ startBeat: number; endBeat: number }>({
    startBeat: 0,
    endBeat: TIMELINE_BEATS_PER_BAR * 4,
  });
  const [isModified, setIsModified] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [masterVolumeDb, setMasterVolumeDb] = useState(0);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [deviceSettings, setCurrentDeviceSettings] = useState<AudioDeviceSettings>(() => getDeviceSettings());

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const originalTracksRef = useRef<Track[]>([]);
  const originalBpmRef = useRef<number>(128);
  const hasUnsavedHistoryGuardRef = useRef(false);
  const allowHistoryNavigationRef = useRef(false);
  const navigate = useNavigate();
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const samplerLoadPromiseRef = useRef<Promise<void> | null>(null);
  const elecGuitarSamplerRef = useRef<Tone.Sampler | null>(null);
  const elecGuitarLoadPromiseRef = useRef<Promise<void> | null>(null);
  const elecBassSamplerRef = useRef<Tone.Sampler | null>(null);
  const elecBassLoadPromiseRef = useRef<Promise<void> | null>(null);
  const celloSamplerRef = useRef<Tone.Sampler | null>(null);
  const celloLoadPromiseRef = useRef<Promise<void> | null>(null);
  const fluteSamplerRef = useRef<Tone.Sampler | null>(null);
  const fluteLoadPromiseRef = useRef<Promise<void> | null>(null);
  const violinSamplerRef = useRef<Tone.Sampler | null>(null);
  const violinLoadPromiseRef = useRef<Promise<void> | null>(null);
  const elecPianoSynthRef = useRef<Tone.PolySynth | null>(null);
  const metronomeSynthRef = useRef<Tone.Synth | null>(null);
  const analogSynthRef = useRef<Tone.PolySynth | null>(null);
  const organSynthRef = useRef<Tone.PolySynth | null>(null);
  const bassSynthRef = useRef<Tone.MonoSynth | null>(null);
  const kickSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const snareSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const hatSynthRef = useRef<Tone.MetalSynth | null>(null);
  const clapSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const audioPlayersRef = useRef<Partial<Record<AudioSourceId, Tone.Player>>>({});
  const recordedAudioPlayersRef = useRef<Map<string, Tone.Player>>(new Map());
  const trackEffectChainsRef = useRef<Map<number, TrackEffectChain>>(new Map());
  const voiceMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceMediaStreamRef = useRef<MediaStream | null>(null);
  const voiceRecordingChunksRef = useRef<Blob[]>([]);
  const voiceRecordingStartRef = useRef<{ time: number; beat: number; trackId: number } | null>(null);
  const audioPreviewJobsRef = useRef<Set<string>>(new Set());
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const midiHeldNotesRef = useRef<Map<number, { noteId: number; startBeat: number }>>(new Map());
  const playbackTimerRef = useRef<number | null>(null);
  const lastPlayheadUiUpdateRef = useRef(0);
  const liveHummingNoteIdRef = useRef<number | null>(null);
  const liveHummingNoteIdsRef = useRef<number[]>([]);
  const lastRealtimeNoteUpdateRef = useRef(0);
  const realtimeClipLengthRef = useRef(CLIP_DEFAULT_LENGTH_BEATS);
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const playbackSessionRef = useRef<null | {
    startWallTime: number;
    startBeat: number;
    nextEventIndex: number;
    bpm: number;
    events: PlaybackNoteEvent[];
    lastMetronomeBeat?: number;
  }>(null);

  const projectName = searchParams.get('projectName') ?? 'SESSION_2023_X4';
  const [projectDescription, setProjectDescription] = useState(searchParams.get('description') ?? '');
  const bpmRaw = Number.parseFloat(searchParams.get('bpm') ?? '128');
  const initialBpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? bpmRaw : 128;
  const [bpm, setBpm] = useState(initialBpm);
  const bpmLabel = bpm.toFixed(2);

  const createSnapshot = (): EditorSnapshot => ({
    tracks: structuredClone(tracks),
    bpm,
    loopRange: { ...loopRange },
    masterVolumeDb,
  });

  const recordHistory = () => {
    const snapshot = createSnapshot();
    const stack = undoStackRef.current;
    const previous = stack[stack.length - 1];
    if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
      return;
    }

    undoStackRef.current = [...stack.slice(-(HISTORY_LIMIT - 1)), snapshot];
    redoStackRef.current = [];
  };

  const applySnapshot = (snapshot: EditorSnapshot) => {
    setTracks(structuredClone(snapshot.tracks));
    setBpm(snapshot.bpm);
    setLoopRange({ ...snapshot.loopRange });
    setMasterVolumeDb(snapshot.masterVolumeDb);
    setSelectedNoteIds([]);
    setSelectedTimelineClip(null);
  };

  const handleUndo = () => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) {
      return;
    }

    redoStackRef.current = [...redoStackRef.current.slice(-(HISTORY_LIMIT - 1)), createSnapshot()];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    applySnapshot(previous);
  };

  const handleRedo = () => {
    const next = redoStackRef.current.at(-1);
    if (!next) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current.slice(-(HISTORY_LIMIT - 1)), createSnapshot()];
    redoStackRef.current = redoStackRef.current.slice(0, -1);
    applySnapshot(next);
  };

  const selectedTrackForRows = tracks.find((track) => track.id === selectedTrackId);
  const isDrumsTrack = selectedTrackForRows?.type === 'Drums';

  const pianoRows = isDrumsTrack
    ? [
        { row: 0, isBlack: false, label: 'Clap', icon: 'clap' },
        { row: 1, isBlack: false, label: 'Hat', icon: 'hat' },
        { row: 2, isBlack: false, label: 'Snare', icon: 'snare' },
        { row: 3, isBlack: false, label: 'Kick', icon: 'kick' },
      ]
    : Array.from({ length: GRID_TOTAL_ROWS }, (_, row) => {
        const midi = MIDI_HIGH - row;
        const semitone = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        const isBlack = BLACK_SEMITONES.has(semitone);
        const label = semitone === 0 || midi === MIDI_LOW || midi === MIDI_HIGH ? `${NOTE_NAMES[semitone]}${octave}` : '';
        return { row, isBlack, label };
      });

  const activeTrack = tracks.find((track) => track.id === activePianoTrackId) ?? null;
  const activeClip = activeTrack?.clips.find((clip) => clip.id === activePianoClipId) ?? null;
  const activeTrackName = activeTrack?.name ?? 'TRACK';
  const activeTrackNotes = activeClip?.notes ?? [];
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? null;
  const hasPianoTrack = tracks.some(
    (track) => track.type === 'Instrument' && track.instrumentPresetId === 'piano',
  );
  const trackEffectSettingsKey = tracks
    .map((track) => `${track.id}:${track.reverbWet}:${track.delayWet}:${track.distortion}`)
    .join('|');

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const toGainFillPercent = (db: number) => ((clamp(db, -24, 12) + 24) / 36) * 100;
  const formatTimecode = (beat: number) => {
    const totalSeconds = (Math.max(0, beat) * 60) / bpm;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = Math.floor(totalSeconds) % 60;
    const frames = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 30);
    return [hours, minutes, seconds, frames].map((value) => String(value).padStart(2, '0')).join(':');
  };
  const getClipTotalCols = (clipLengthBeats: number) => Math.max(1, clipLengthBeats * PIANO_STEPS_PER_BEAT);
  const activeClipTotalCols = activeClip ? getClipTotalCols(activeClip.length) : getClipTotalCols(CLIP_DEFAULT_LENGTH_BEATS);

  const normalizeNotesToClipRange = (notes: Note[], clipLengthBeats: number) => {
    const maxCols = getClipTotalCols(clipLengthBeats);
    return notes.map((note) => {
      const nextStart = clamp(note.start, 0, maxCols - 1);
      const nextLength = clamp(note.length, 1, maxCols - nextStart);
      return {
        ...note,
        start: nextStart,
        length: nextLength,
      };
    });
  };

  const pitchToMidi = (pitch: number) => MIDI_HIGH - pitch;
  const pitchToNoteName = (pitch: number) => Tone.Frequency(pitchToMidi(pitch), 'midi').toNote();
  const canUsePianoRoll = (track: Track | null) => track !== null && (track.type === 'Instrument' || track.type === 'Drums');

  const getAssignedBusTrack = (track: Track) => {
    if (track.outputBusId === null) {
      return null;
    }

    return tracks.find((candidate) => candidate.id === track.outputBusId && candidate.type === 'Bus') ?? null;
  };

  const getEffectiveTrackVolumeDb = (track: Track) => {
    const busTrack = getAssignedBusTrack(track);
    return clamp(track.volumeDb + (busTrack?.busGainDb ?? 0), -36, 12);
  };

  const getTrackOutputCompDb = (track: Track) => {
    if (track.type === 'Instrument') {
      return INSTRUMENT_OUTPUT_COMP_DB[track.instrumentPresetId];
    }
    if (track.type === 'Drums') {
      return DRUM_OUTPUT_COMP_DB[track.drumKitId];
    }
    if (track.type === 'Audio') {
      return AUDIO_OUTPUT_COMP_DB[track.audioSourceId];
    }

    return 0;
  };

  const getEventOutputCompDb = (event: PlaybackNoteEvent) => {
    if (event.audioDataUrl) {
      return 0;
    }
    if (event.trackType === 'Instrument') {
      return INSTRUMENT_OUTPUT_COMP_DB[event.instrumentPresetId];
    }
    if (event.trackType === 'Drums') {
      return DRUM_OUTPUT_COMP_DB[event.drumKitId];
    }
    if (event.trackType === 'Audio') {
      return AUDIO_OUTPUT_COMP_DB[event.audioSourceId];
    }

    return 0;
  };

  const dbToVelocity = (db: number) => clamp(Tone.dbToGain(db), 0.03, 1);

  const ensureToneReady = async () => {
    await Tone.start();
  };

  useEffect(() => {
    Tone.getDestination().volume.rampTo(masterVolumeDb, 0.05);
  }, [masterVolumeDb]);

  useEffect(() => {
    const handlePlayheadUpdate = (e: Event) => {
      const beat = (e as CustomEvent).detail.beat;
      const el = document.querySelector('.playhead-timecode');
      if (el) {
        el.textContent = formatTimecode(beat);
      }
    };
    window.addEventListener('playhead-update', handlePlayheadUpdate);
    return () => {
      window.removeEventListener('playhead-update', handlePlayheadUpdate);
    };
  }, []);

  const ensureTrackEffectChain = (trackId: number) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    const existing = trackEffectChainsRef.current.get(trackId);
    const chain = existing ?? {
      input: new Tone.Gain(),
      distortion: new Tone.Distortion(),
      delay: new Tone.FeedbackDelay('8n', 0.25),
      reverb: new Tone.Reverb({ decay: 1.8, preDelay: 0.01 }),
    };

    if (!existing) {
      chain.input.chain(chain.distortion, chain.delay, chain.reverb, Tone.getDestination());
      trackEffectChainsRef.current.set(trackId, chain);
    }

    chain.distortion.distortion = track?.distortion ?? 0;
    chain.distortion.wet.value = (track?.distortion ?? 0) > 0 ? 1 : 0;
    chain.delay.wet.value = track?.delayWet ?? 0;
    chain.reverb.wet.value = track?.reverbWet ?? 0;
    return chain;
  };

  const routeSourceToTrack = (source: Tone.ToneAudioNode, trackId: number) => {
    source.disconnect();
    source.connect(ensureTrackEffectChain(trackId).input);
  };

  useEffect(() => {
    trackEffectSettingsKey.split('|').forEach((serializedSettings) => {
      if (!serializedSettings) {
        return;
      }

      const [trackId, reverbWet, delayWet, distortion] = serializedSettings
        .split(':')
        .map(Number);
      const chain = trackEffectChainsRef.current.get(trackId);
      if (!chain) {
        return;
      }

      chain.distortion.distortion = distortion;
      chain.distortion.wet.value = distortion > 0 ? 1 : 0;
      chain.delay.wet.value = delayWet;
      chain.reverb.wet.value = reverbWet;
    });
  }, [trackEffectSettingsKey]);

  const createPianoSampler = () => {
    if (!samplerRef.current) {
      samplerRef.current = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3',
          C1: 'C1.mp3',
          'D#1': 'Ds1.mp3',
          'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',
          C2: 'C2.mp3',
          'D#2': 'Ds2.mp3',
          'F#2': 'Fs2.mp3',
          A2: 'A2.mp3',
          C3: 'C3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          A3: 'A3.mp3',
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
          C5: 'C5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
          A5: 'A5.mp3',
          C6: 'C6.mp3',
          'D#6': 'Ds6.mp3',
          'F#6': 'Fs6.mp3',
          A6: 'A6.mp3',
          C7: 'C7.mp3',
          'D#7': 'Ds7.mp3',
          'F#7': 'Fs7.mp3',
          A7: 'A7.mp3',
          C8: 'C8.mp3',
        },
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      samplerLoadPromiseRef.current = Tone.loaded().catch((error) => {
        console.warn('Piano sample preload failed:', error);
      });
    }

    return samplerRef.current;
  };

  const ensurePianoSampler = async () => {
    await ensureToneReady();
    createPianoSampler();
    await samplerLoadPromiseRef.current;
    return samplerRef.current;
  };

  const ensureAnalogSynth = async () => {
    await ensureToneReady();
    if (!analogSynthRef.current) {
      analogSynthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.35, release: 0.3 },
      }).toDestination();
    }

    return analogSynthRef.current;
  };

  const ensureOrganSynth = async () => {
    await ensureToneReady();
    if (!organSynthRef.current) {
      organSynthRef.current = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 2.2,
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.7, release: 0.5 },
      }).toDestination();
    }

    return organSynthRef.current;
  };

  const ensureBassSynth = async () => {
    await ensureToneReady();
    if (!bassSynthRef.current) {
      bassSynthRef.current = new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2.4, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.25 },
        filterEnvelope: { attack: 0.01, decay: 0.08, sustain: 0.25, release: 0.25, baseFrequency: 180, octaves: 2.5 },
      }).toDestination();
    }

    return bassSynthRef.current;
  };

  const ensureElecGuitarSampler = async () => {
    await ensureToneReady();
    if (!elecGuitarSamplerRef.current) {
      elecGuitarSamplerRef.current = new Tone.Sampler({
        urls: {
          'D#3': 'Ds3.mp3',
          'D#4': 'Ds4.mp3',
          'D#5': 'Ds5.mp3',
          'E2': 'E2.mp3',
          'F#2': 'Fs2.mp3',
          'F#3': 'Fs3.mp3',
          'F#4': 'Fs4.mp3',
          'F#5': 'Fs5.mp3',
          'A2': 'A2.mp3',
          'A3': 'A3.mp3',
          'A4': 'A4.mp3',
          'A5': 'A5.mp3',
          'C3': 'C3.mp3',
          'C4': 'C4.mp3',
          'C5': 'C5.mp3',
          'C6': 'C6.mp3',
          'C#2': 'Cs2.mp3'
        },
        release: 1,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/',
      }).toDestination();
      elecGuitarLoadPromiseRef.current = Tone.loaded().catch((error) => {
        console.warn('Electric guitar sample preload failed:', error);
      });
    }
    await elecGuitarLoadPromiseRef.current;
    return elecGuitarSamplerRef.current;
  };

  const ensureElecBassSampler = async () => {
    await ensureToneReady();
    if (!elecBassSamplerRef.current) {
      elecBassSamplerRef.current = new Tone.Sampler({
        urls: {
          'A#1': 'As1.mp3',
          'A#2': 'As2.mp3',
          'A#3': 'As3.mp3',
          'A#4': 'As4.mp3',
          'C#1': 'Cs1.mp3',
          'C#2': 'Cs2.mp3',
          'C#3': 'Cs3.mp3',
          'C#4': 'Cs4.mp3',
          'E1': 'E1.mp3',
          'E2': 'E2.mp3',
          'E3': 'E3.mp3',
          'E4': 'E4.mp3',
          'G1': 'G1.mp3',
          'G2': 'G2.mp3',
          'G3': 'G3.mp3',
          'G4': 'G4.mp3'
        },
        release: 1.2,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/bass-electric/',
      }).toDestination();
      elecBassLoadPromiseRef.current = Tone.loaded().catch((error) => {
        console.warn('Electric bass sample preload failed:', error);
      });
    }
    await elecBassLoadPromiseRef.current;
    return elecBassSamplerRef.current;
  };

  const ensureCelloSampler = async () => {
    await ensureToneReady();
    if (!celloSamplerRef.current) {
      celloSamplerRef.current = new Tone.Sampler({
        urls: {
          'A2': 'A2.mp3',
          'A3': 'A3.mp3',
          'A4': 'A4.mp3',
          'A5': 'A5.mp3',
          'C2': 'C2.mp3',
          'C3': 'C3.mp3',
          'C4': 'C4.mp3',
          'C5': 'C5.mp3',
          'D#2': 'Ds2.mp3',
          'D#3': 'Ds3.mp3',
          'D#4': 'Ds4.mp3',
          'D#5': 'Ds5.mp3',
          'F#2': 'Fs2.mp3',
          'F#3': 'Fs3.mp3',
          'F#4': 'Fs4.mp3',
          'F#5': 'Fs5.mp3'
        },
        release: 1,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/cello/',
      }).toDestination();
      celloLoadPromiseRef.current = Tone.loaded().catch((error) => {
        console.warn('Cello sample preload failed:', error);
      });
    }
    await celloLoadPromiseRef.current;
    return celloSamplerRef.current;
  };

  const ensureFluteSampler = async () => {
    await ensureToneReady();
    if (!fluteSamplerRef.current) {
      fluteSamplerRef.current = new Tone.Sampler({
        urls: {
          'A4': 'A4.mp3',
          'A5': 'A5.mp3',
          'A6': 'A6.mp3',
          'C4': 'C4.mp3',
          'C5': 'C5.mp3',
          'C6': 'C6.mp3',
          'C7': 'C7.mp3',
          'D#4': 'Ds4.mp3',
          'D#5': 'Ds5.mp3',
          'D#6': 'Ds6.mp3',
          'F#4': 'Fs4.mp3',
          'F#5': 'Fs5.mp3',
          'F#6': 'Fs6.mp3'
        },
        release: 1,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/flute/',
      }).toDestination();
      fluteLoadPromiseRef.current = Tone.loaded().catch((error) => {
        console.warn('Flute sample preload failed:', error);
      });
    }
    await fluteLoadPromiseRef.current;
    return fluteSamplerRef.current;
  };

  const ensureViolinSampler = async () => {
    await ensureToneReady();
    if (!violinSamplerRef.current) {
      violinSamplerRef.current = new Tone.Sampler({
        urls: {
          'A3': 'A3.mp3',
          'A4': 'A4.mp3',
          'A5': 'A5.mp3',
          'A6': 'A6.mp3',
          'C4': 'C4.mp3',
          'C5': 'C5.mp3',
          'C6': 'C6.mp3',
          'C7': 'C7.mp3',
          'D#4': 'Ds4.mp3',
          'D#5': 'Ds5.mp3',
          'D#6': 'Ds6.mp3',
          'F#4': 'Fs4.mp3',
          'F#5': 'Fs5.mp3',
          'F#6': 'Fs6.mp3',
          'G3': 'G3.mp3',
          'G4': 'G4.mp3',
          'G5': 'G5.mp3',
          'G6': 'G6.mp3'
        },
        release: 1.2,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/violin/',
      }).toDestination();
      violinLoadPromiseRef.current = Tone.loaded().catch((error) => {
        console.warn('Violin sample preload failed:', error);
      });
    }
    await violinLoadPromiseRef.current;
    return violinSamplerRef.current;
  };

  const ensureElecPianoSynth = async () => {
    await ensureToneReady();
    if (!elecPianoSynthRef.current) {
      elecPianoSynthRef.current = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 1.5, sustain: 0.1, release: 1 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 1 }
      }).toDestination();
    }
    return elecPianoSynthRef.current;
  };

  const ensureMetronomeSynth = () => {
    if (!metronomeSynthRef.current) {
      metronomeSynthRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 }
      }).toDestination();
    }
    return metronomeSynthRef.current;
  };

  const triggerMetronomeClick = (beat: number) => {
    try {
      const synth = ensureMetronomeSynth();
      if (!synth) {
        return;
      }
      const isDownbeat = beat % TIMELINE_BEATS_PER_BAR === 0;
      const pitch = isDownbeat ? 'C6' : 'C5';
      const velocity = isDownbeat ? 1.0 : 0.6;
      synth.triggerAttackRelease(pitch, '32n', undefined, velocity);
    } catch {
      // Ignore context errors
    }
  };

  const ensureDrumSynths = async () => {
    await ensureToneReady();

    if (!kickSynthRef.current) {
      kickSynthRef.current = new Tone.MembraneSynth({
        volume: 10,
        pitchDecay: 0.04,
        octaves: 8,
        envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 },
      }).toDestination();
    }

    if (!snareSynthRef.current) {
      snareSynthRef.current = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      }).toDestination();
    }

    if (!hatSynthRef.current) {
      hatSynthRef.current = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.12, release: 0.06 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4200,
        octaves: 1.5,
      }).toDestination();
    }

    if (!clapSynthRef.current) {
      clapSynthRef.current = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();
    }
  };

  const ensureAudioPlayer = async (sourceId: AudioSourceId) => {
    await ensureToneReady();

    const existingPlayer = audioPlayersRef.current[sourceId];
    if (existingPlayer) {
      return existingPlayer;
    }

    const source = AUDIO_SOURCE_OPTIONS.find((option) => option.id === sourceId);
    if (!source) {
      throw new Error('Audio source not found');
    }

    const player = new Tone.Player({
      url: source.url,
      fadeOut: 0.04,
    }).toDestination();

    audioPlayersRef.current[sourceId] = player;
    await Tone.loaded();

    return player;
  };

  const ensureRecordedAudioPlayer = async (audioDataUrl: string) => {
    await ensureToneReady();
    const existingPlayer = recordedAudioPlayersRef.current.get(audioDataUrl);
    if (existingPlayer) {
      return existingPlayer;
    }

    const player = new Tone.Player({
      url: audioDataUrl,
      fadeIn: 0.01,
      fadeOut: 0.04,
    }).toDestination();
    recordedAudioPlayersRef.current.set(audioDataUrl, player);
    await Tone.loaded();
    return player;
  };

  const ensurePlaybackEngines = async () => {
    await ensureToneReady();

    const instrumentPresets = new Set(tracks.filter((track) => track.type === 'Instrument').map((track) => track.instrumentPresetId));
    const hasDrumTrack = tracks.some((track) => track.type === 'Drums');
    const audioSources = new Set(tracks.filter((track) => track.type === 'Audio').map((track) => track.audioSourceId));
    const recordedAudioUrls = new Set(
      tracks.flatMap((track) => track.clips.map((clip) => clip.audioDataUrl).filter((url): url is string => Boolean(url))),
    );

    await Promise.all([
      instrumentPresets.has('piano') ? ensurePianoSampler() : Promise.resolve(),
      instrumentPresets.has('analog') ? ensureAnalogSynth() : Promise.resolve(),
      instrumentPresets.has('organ') ? ensureOrganSynth() : Promise.resolve(),
      instrumentPresets.has('bass') ? ensureBassSynth() : Promise.resolve(),
      instrumentPresets.has('elec_guitar') ? ensureElecGuitarSampler() : Promise.resolve(),
      instrumentPresets.has('elec_bass') ? ensureElecBassSampler() : Promise.resolve(),
      instrumentPresets.has('cello') ? ensureCelloSampler() : Promise.resolve(),
      instrumentPresets.has('flute') ? ensureFluteSampler() : Promise.resolve(),
      instrumentPresets.has('violin') ? ensureViolinSampler() : Promise.resolve(),
      instrumentPresets.has('elec_piano') ? ensureElecPianoSynth() : Promise.resolve(),
      hasDrumTrack ? ensureDrumSynths() : Promise.resolve(),
      ...Array.from(audioSources).map(async (sourceId) => {
        try {
          await ensureAudioPlayer(sourceId);
        } catch {
          // Keep playback alive even if a remote one-shot failed to load.
        }
      }),
      ...Array.from(recordedAudioUrls).map(async (audioDataUrl) => {
        try {
          await ensureRecordedAudioPlayer(audioDataUrl);
        } catch {
          // Keep playback available for other tracks if a recording cannot be decoded.
        }
      }),
    ]);
  };

  const applyDrumKitTweaks = (kitId: Track['drumKitId']) => {
    if (!kickSynthRef.current || !snareSynthRef.current || !hatSynthRef.current || !clapSynthRef.current) {
      return;
    }

    if (kitId === 'acoustic') {
      snareSynthRef.current.set({ noise: { type: 'pink' }, envelope: { decay: 0.14 } });
      hatSynthRef.current.set({ harmonicity: 4.2, modulationIndex: 20, resonance: 3200 });
      clapSynthRef.current.set({ noise: { type: 'brown' }, envelope: { decay: 0.09 } });
      return;
    }

    if (kitId === 'trap808') {
      snareSynthRef.current.set({ noise: { type: 'white' }, envelope: { decay: 0.2 } });
      hatSynthRef.current.set({ harmonicity: 6.5, modulationIndex: 42, resonance: 7000 });
      clapSynthRef.current.set({ noise: { type: 'white' }, envelope: { decay: 0.14 } });
      return;
    }

    if (kitId === 'synthwave') {
      snareSynthRef.current.set({ noise: { type: 'pink' }, envelope: { decay: 0.3 } });
      hatSynthRef.current.set({ harmonicity: 6.0, modulationIndex: 35, resonance: 5000 });
      clapSynthRef.current.set({ noise: { type: 'pink' }, envelope: { decay: 0.2 } });
      return;
    }

    if (kitId === 'jazz') {
      snareSynthRef.current.set({ noise: { type: 'white' }, envelope: { decay: 0.08 } });
      hatSynthRef.current.set({ harmonicity: 3.5, modulationIndex: 15, resonance: 2000 });
      clapSynthRef.current.set({ noise: { type: 'pink' }, envelope: { decay: 0.06 } });
      return;
    }

    snareSynthRef.current.set({ noise: { type: 'white' }, envelope: { decay: 0.18 } });
    hatSynthRef.current.set({ harmonicity: 5.1, modulationIndex: 32, resonance: 4200 });
    clapSynthRef.current.set({ noise: { type: 'pink' }, envelope: { decay: 0.12 } });
  };

  const triggerInstrumentNote = (
    trackId: number,
    presetId: Track['instrumentPresetId'],
    pitch: number,
    durationSeconds: number,
    velocity: number,
  ) => {
    const noteName = pitchToNoteName(pitch);
    const duration = Math.max(0.05, durationSeconds);

    if (presetId === 'piano' && samplerRef.current) {
      routeSourceToTrack(samplerRef.current, trackId);
      samplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'analog' && analogSynthRef.current) {
      routeSourceToTrack(analogSynthRef.current, trackId);
      analogSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'organ' && organSynthRef.current) {
      routeSourceToTrack(organSynthRef.current, trackId);
      organSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'bass' && bassSynthRef.current) {
      routeSourceToTrack(bassSynthRef.current, trackId);
      bassSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'elec_guitar' && elecGuitarSamplerRef.current) {
      routeSourceToTrack(elecGuitarSamplerRef.current, trackId);
      elecGuitarSamplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'elec_bass' && elecBassSamplerRef.current) {
      routeSourceToTrack(elecBassSamplerRef.current, trackId);
      elecBassSamplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'cello' && celloSamplerRef.current) {
      routeSourceToTrack(celloSamplerRef.current, trackId);
      celloSamplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'flute' && fluteSamplerRef.current) {
      routeSourceToTrack(fluteSamplerRef.current, trackId);
      fluteSamplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'violin' && violinSamplerRef.current) {
      routeSourceToTrack(violinSamplerRef.current, trackId);
      violinSamplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'elec_piano' && elecPianoSynthRef.current) {
      routeSourceToTrack(elecPianoSynthRef.current, trackId);
      elecPianoSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }
  };

  const resolveDrumLane = (pitch: number) => {
    const laneOrder = ['kick', 'snare', 'hat', 'clap'] as const;
    const laneIndex = Math.abs(GRID_TOTAL_ROWS - 1 - pitch) % laneOrder.length;
    return laneOrder[laneIndex];
  };

  const triggerDrumNote = (
    trackId: number,
    kitId: Track['drumKitId'],
    pitch: number,
    durationSeconds: number,
    velocity: number,
  ) => {
    if (!kickSynthRef.current || !snareSynthRef.current || !hatSynthRef.current || !clapSynthRef.current) {
      return;
    }

    applyDrumKitTweaks(kitId);
    const lane = resolveDrumLane(pitch);

    if (lane === 'kick') {
      routeSourceToTrack(kickSynthRef.current, trackId);
      const kickNote = kitId === 'trap808' ? 'C1' : kitId === 'acoustic' ? 'D1' : kitId === 'synthwave' ? 'D1' : kitId === 'jazz' ? 'G1' : 'E1';
      kickSynthRef.current.triggerAttackRelease(kickNote, Math.max(0.08, durationSeconds), undefined, velocity);
      return;
    }

    if (lane === 'snare') {
      routeSourceToTrack(snareSynthRef.current, trackId);
      snareSynthRef.current.triggerAttackRelease('16n', undefined, velocity);
      return;
    }

    if (lane === 'hat') {
      routeSourceToTrack(hatSynthRef.current, trackId);
      hatSynthRef.current.triggerAttackRelease('C6', '32n', undefined, velocity);
      return;
    }

    routeSourceToTrack(clapSynthRef.current, trackId);
    clapSynthRef.current.triggerAttackRelease('16n', undefined, velocity * 1.6);
  };

  const triggerAudioClip = (
    trackId: number,
    sourceId: AudioSourceId,
    audioDataUrl: string | undefined,
    durationSeconds: number,
    compensatedVolumeDb: number,
    offsetSeconds = 0,
  ) => {
    const player = audioDataUrl
      ? recordedAudioPlayersRef.current.get(audioDataUrl)
      : audioPlayersRef.current[sourceId];
    if (!player || !player.loaded) {
      return;
    }

    routeSourceToTrack(player, trackId);
    player.volume.value = compensatedVolumeDb;
    player.start(undefined, offsetSeconds, Math.max(0.1, durationSeconds));
  };

  const triggerPlaybackEvent = (event: PlaybackNoteEvent) => {
    const compensatedDb = event.effectiveVolumeDb + getEventOutputCompDb(event);
    const velocity = dbToVelocity(compensatedDb);
    const beatSeconds = 60 / bpm;

    if (event.trackType === 'Instrument' && event.pitch !== null) {
      triggerInstrumentNote(event.trackId, event.instrumentPresetId, event.pitch, event.durationSeconds, velocity);
      return;
    }

    if (event.trackType === 'Drums' && event.pitch !== null) {
      triggerDrumNote(event.trackId, event.drumKitId, event.pitch, event.durationSeconds, velocity);
      return;
    }

    if (event.trackType === 'Audio') {
      triggerAudioClip(
        event.trackId,
        event.audioSourceId,
        event.audioDataUrl,
        event.durationSeconds,
        compensatedDb,
        event.audioStartOffset ? event.audioStartOffset * beatSeconds : 0
      );
    }
  };

  const cancelPlaybackTimer = () => {
    if (playbackTimerRef.current !== null) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  const getCurrentSessionBeat = () => {
    const session = playbackSessionRef.current;
    if (!session) {
      return playheadBeat;
    }

    const elapsedSeconds = (performance.now() - session.startWallTime) / 1000;
    return clamp(session.startBeat + (elapsedSeconds * session.bpm) / 60, 0, TIMELINE_TOTAL_BEATS);
  };

  const buildPlaybackEvents = (options?: { respectMuteSolo?: boolean; trackId?: number }): PlaybackNoteEvent[] => {
    const beatSeconds = 60 / bpm;
    const events: PlaybackNoteEvent[] = [];
    const respectMuteSolo = options?.respectMuteSolo ?? true;
    const hasSoloedTrack = tracks.some((track) => track.soloed === true);

    tracks.forEach((track) => {
      if (options?.trackId !== undefined && track.id !== options.trackId) {
        return;
      }

      if (track.type === 'Bus') {
        return;
      }

      if (respectMuteSolo && (track.muted === true || (hasSoloedTrack && track.soloed !== true))) {
        return;
      }

      const effectiveVolumeDb = getEffectiveTrackVolumeDb(track);

      track.clips.forEach((clip) => {
        if (track.type === 'Audio') {
          const startBeat = clip.start;
          if (startBeat < TIMELINE_TOTAL_BEATS) {
            events.push({
              startBeat,
              durationSeconds: Math.max(0.1, clip.length * beatSeconds),
              pitch: null,
              trackId: track.id,
              trackType: track.type,
              instrumentPresetId: track.instrumentPresetId,
              drumKitId: track.drumKitId,
              audioSourceId: track.audioSourceId,
              audioDataUrl: clip.audioDataUrl,
              audioStartOffset: clip.audioStartOffset,
              effectiveVolumeDb,
            });
          }
          return;
        }

        clip.notes.forEach((note) => {
          const startBeat = clip.start + note.start / PIANO_STEPS_PER_BEAT;
          if (startBeat >= TIMELINE_TOTAL_BEATS) {
            return;
          }

          const durationBeats = Math.max(1 / PIANO_STEPS_PER_BEAT, note.length / PIANO_STEPS_PER_BEAT);
          events.push({
            startBeat,
            durationSeconds: durationBeats * beatSeconds,
            pitch: note.pitch,
            trackId: track.id,
            trackType: track.type,
            instrumentPresetId: track.instrumentPresetId,
            drumKitId: track.drumKitId,
            audioSourceId: track.audioSourceId,
            effectiveVolumeDb,
          });
        });
      });
    });

    return events.sort((a, b) => a.startBeat - b.startBeat);
  };

  const runPlaybackFrame = () => {
    const session = playbackSessionRef.current;
    if (!session) {
      cancelPlaybackTimer();
      return;
    }

    const minLoopLength = 1 / PIANO_STEPS_PER_BEAT;
    const loopStartBeat = clamp(loopRange.startBeat, 0, TIMELINE_TOTAL_BEATS - minLoopLength);
    const loopEndBeat = clamp(loopRange.endBeat, loopStartBeat + minLoopLength, TIMELINE_TOTAL_BEATS);
    const playbackEndBeat = isLoopPlaybackOn ? loopEndBeat : TIMELINE_TOTAL_BEATS;
    const currentBeat = getCurrentSessionBeat();
    const now = performance.now();

    if (now - lastPlayheadUiUpdateRef.current >= PLAYHEAD_UI_UPDATE_MS) {
      lastPlayheadUiUpdateRef.current = now;
      window.dispatchEvent(new CustomEvent('playhead-update', { detail: { beat: currentBeat } }));
    }

    // Metronome click scheduling
    if (isMetronomeOn) {
      const start = session.startBeat;
      const lastTick = session.lastMetronomeBeat ?? (start - 0.0001);
      const startIntegerBeat = Math.floor(lastTick) + 1;
      const endIntegerBeat = Math.floor(currentBeat);

      for (let beat = startIntegerBeat; beat <= endIntegerBeat; beat++) {
        if (beat >= start && beat <= playbackEndBeat) {
          triggerMetronomeClick(beat);
          session.lastMetronomeBeat = beat;
        }
      }
    }

    while (session.nextEventIndex < session.events.length && session.events[session.nextEventIndex].startBeat <= currentBeat + 0.0001) {
      const event = session.events[session.nextEventIndex];
      triggerPlaybackEvent(event);
      session.nextEventIndex += 1;
    }

    if (isLoopPlaybackOn && currentBeat >= playbackEndBeat) {
      const nextEventIndex = session.events.findIndex((event) => event.startBeat >= loopStartBeat - 0.0001);
      playbackSessionRef.current = {
        ...session,
        startWallTime: now,
        startBeat: loopStartBeat,
        nextEventIndex: nextEventIndex === -1 ? session.events.length : nextEventIndex,
        lastMetronomeBeat: undefined,
      };
      lastPlayheadUiUpdateRef.current = now;
      setPlayheadBeat(loopStartBeat);
      return;
    }

    if (currentBeat >= playbackEndBeat) {
      setIsPlaying(false);
      playbackSessionRef.current = null;
      cancelPlaybackTimer();
      setPlayheadBeat(playbackEndBeat);
      return;
    }
  };

  const startPlayback = async (startBeat: number) => {
    const minLoopLength = 1 / PIANO_STEPS_PER_BEAT;
    const loopStartBeat = clamp(loopRange.startBeat, 0, TIMELINE_TOTAL_BEATS - minLoopLength);
    const loopEndBeat = clamp(loopRange.endBeat, loopStartBeat + minLoopLength, TIMELINE_TOTAL_BEATS);
    const start = clamp(startBeat, isLoopPlaybackOn ? loopStartBeat : 0, isLoopPlaybackOn ? loopEndBeat : TIMELINE_TOTAL_BEATS);
    lastPlayheadUiUpdateRef.current = performance.now();
    setPlayheadBeat(start);
    setIsPlaying(true);

    try {
      await ensurePlaybackEngines();
    } catch {
      setIsPlaying(false);
      return;
    }

    const events = buildPlaybackEvents();
    const nextEventIndex = events.findIndex((event) => event.startBeat >= start - 0.0001);

    playbackSessionRef.current = {
      startWallTime: performance.now(),
      startBeat: start,
      nextEventIndex: nextEventIndex === -1 ? events.length : nextEventIndex,
      bpm,
      events,
    };

    cancelPlaybackTimer();
    playbackTimerRef.current = window.setInterval(runPlaybackFrame, PLAYBACK_TIMER_MS);
    runPlaybackFrame();
  };

  const silenceAllPlaybackEngines = () => {
    Object.values(audioPlayersRef.current).forEach((player) => {
      if (player && player.state === 'started') {
        player.stop();
      }
    });
    recordedAudioPlayersRef.current.forEach((player) => {
      if (player && player.state === 'started') {
        player.stop();
      }
    });

    samplerRef.current?.releaseAll();
    elecGuitarSamplerRef.current?.releaseAll();
    elecBassSamplerRef.current?.releaseAll();
    celloSamplerRef.current?.releaseAll();
    fluteSamplerRef.current?.releaseAll();
    violinSamplerRef.current?.releaseAll();
    elecPianoSynthRef.current?.releaseAll();
    analogSynthRef.current?.releaseAll();
    organSynthRef.current?.releaseAll();
    bassSynthRef.current?.triggerRelease();
    kickSynthRef.current?.triggerRelease();
    snareSynthRef.current?.triggerRelease();
    hatSynthRef.current?.triggerRelease();
    clapSynthRef.current?.triggerRelease();
  };

  const pausePlayback = () => {
    const currentBeat = getCurrentSessionBeat();
    setPlayheadBeat(currentBeat);
    setIsPlaying(false);
    playbackSessionRef.current = null;
    cancelPlaybackTimer();
    silenceAllPlaybackEngines();
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setPlayheadBeat(0);
    playbackSessionRef.current = null;
    cancelPlaybackTimer();
    silenceAllPlaybackEngines();
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      pausePlayback();
      return;
    }

    void startPlayback(playheadBeat);
  };

  const handleReturnToStart = () => {
    if (isPlaying) {
      pausePlayback();
    }
    setPlayheadBeat(0);
  };

  const handleSeekBeat = (targetBeat: number) => {
    const target = clamp(targetBeat, 0, TIMELINE_TOTAL_BEATS);
    if (!isPlaying) {
      setPlayheadBeat(target);
      return;
    }

    void (async () => {
      pausePlayback();
      await startPlayback(target);
    })();
  };

  const handleBpmChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const nextBpm = clamp(parsed, 40, 240);
    setBpm(nextBpm);

    if (isPlaying) {
      const currentBeat = getCurrentSessionBeat();
      void (async () => {
        pausePlayback();
        await startPlayback(currentBeat);
      })();
    }
  };

  const nudgeBpm = (delta: number) => {
    recordHistory();
    handleBpmChange(String(clamp(bpm + delta, 40, 240)));
  };

  const handleLoopToggle = () => {
    setIsLoopPlaybackOn((prev) => !prev);
  };

  const handleLoopRangeUpdate = (nextRange: { startBeat: number; endBeat: number }) => {
    const loopSnapBeats = 1 / PIANO_STEPS_PER_BEAT;
    const snapBeat = (value: number) => Math.round(value / loopSnapBeats) * loopSnapBeats;
    const minLen = loopSnapBeats;
    const normalizedStart = clamp(snapBeat(nextRange.startBeat), 0, TIMELINE_TOTAL_BEATS - minLen);
    const normalizedEnd = clamp(snapBeat(nextRange.endBeat), normalizedStart + minLen, TIMELINE_TOTAL_BEATS);

    setLoopRange({
      startBeat: normalizedStart,
      endBeat: normalizedEnd,
    });
  };

  const deepCloneClip = (clip: Clip, seed: number, clipIndex: number, startBeat = clip.start): Clip => {
    return {
      ...clip,
      start: startBeat,
      id: seed + clipIndex * 1000 + 1,
      notes: clip.notes.map((note, noteIndex) => ({
        ...note,
        id: seed + clipIndex * 1000 + noteIndex + 2,
      })),
    };
  };

  const handleCopySelectedMidiTrack = () => {
    if (!selectedTrack || !canUsePianoRoll(selectedTrack)) {
      return;
    }

    setCopiedMidiChunk({
      clips: selectedTrack.clips.map((clip) => ({
        ...clip,
        notes: clip.notes.map((note) => ({ ...note })),
      })),
    });
  };

  const handlePasteMidiTrack = () => {
    if (!copiedMidiChunk || copiedMidiChunk.clips.length === 0) {
      return;
    }

    if (!selectedTrack || !canUsePianoRoll(selectedTrack)) {
      return;
    }

    const copiedStartBeat = copiedMidiChunk.clips.reduce((min, clip) => Math.min(min, clip.start), Number.POSITIVE_INFINITY);
    const copiedEndBeat = copiedMidiChunk.clips.reduce((max, clip) => Math.max(max, clip.start + clip.length), Number.NEGATIVE_INFINITY);
    const copiedLengthBeat = Math.max(CLIP_SNAP_BEATS, copiedEndBeat - copiedStartBeat);
    const snappedPlayheadBeat = clamp(
      Math.round(playheadBeat / CLIP_SNAP_BEATS) * CLIP_SNAP_BEATS,
      0,
      TIMELINE_TOTAL_BEATS,
    );
    const anchorStartBeat = clamp(
      snappedPlayheadBeat,
      0,
      Math.max(TIMELINE_TOTAL_BEATS - copiedLengthBeat, 0),
    );
    const seed = Date.now() + Math.floor(Math.random() * 1000);

    updateTrackClips(selectedTrack.id, (clips) => {
      const pastedClips = copiedMidiChunk.clips.map((clip, clipIndex) => {
        const relativeStartBeat = clip.start - copiedStartBeat;
        const nextStartBeat = anchorStartBeat + relativeStartBeat;
        return deepCloneClip(clip, seed, clipIndex, nextStartBeat);
      });

      return [...clips, ...pastedClips].sort((left, right) => left.start - right.start || left.id - right.id);
    });

    setSelectedTimelineClip({
      trackId: selectedTrack.id,
      clipId: seed + 1,
    });
  };

  const handleCopySelectedNotes = () => {
    if (selectedNoteIds.length === 0) return;
    const notesToCopy = activeTrackNotes.filter((note) => selectedNoteIds.includes(note.id));
    setCopiedNotes(notesToCopy.map((note) => ({ ...note })));
  };

  const handlePasteNotes = () => {
    if (!copiedNotes || copiedNotes.length === 0 || !activeClip) return;
    const minStart = Math.min(...copiedNotes.map((n) => n.start));
    
    const playheadStep = Math.round((playheadBeat - activeClip.start) * PIANO_STEPS_PER_BEAT);
    const anchorStep = clamp(playheadStep, 0, activeClipTotalCols - 1);
    
    const seed = Date.now();
    const newNotes: Note[] = [];
    const newSelectedIds: number[] = [];

    copiedNotes.forEach((n, idx) => {
      const relativeStart = n.start - minStart;
      const nextStart = anchorStep + relativeStart;
      if (nextStart < activeClipTotalCols) {
        const nextId = seed + idx + Math.floor(Math.random() * 1000);
        const length = Math.min(n.length, activeClipTotalCols - nextStart);
        newNotes.push({
          id: nextId,
          start: nextStart,
          pitch: n.pitch,
          length: Math.max(1, length),
        });
        newSelectedIds.push(nextId);
      }
    });

    if (newNotes.length > 0) {
      updateActiveClipNotes((notes) => [...notes, ...newNotes]);
      setSelectedNoteIds(newSelectedIds);
    }
  };

  const handleDeleteTrack = (trackId: number) => {
    recordHistory();
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
    if (selectedTrackId === trackId) {
      setSelectedTrackId(null);
      setSelectedTimelineClip(null);
    }
  };

  const handleSplitClip = (trackId: number, clipId: number, splitBeat: number) => {
    recordHistory();
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const targetClip = track.clips.find((c) => c.id === clipId);
        if (!targetClip) return track;

        if (splitBeat <= targetClip.start || splitBeat >= targetClip.start + targetClip.length) {
          return track;
        }

        const leftLength = splitBeat - targetClip.start;
        const rightLength = targetClip.start + targetClip.length - splitBeat;

        const leftClip: Clip = {
          ...targetClip,
          id: Date.now(),
          length: leftLength,
          notes: targetClip.notes
            .filter((n) => n.start < leftLength * PIANO_STEPS_PER_BEAT)
            .map((n) => ({ ...n })),
          audioStartOffset: targetClip.audioStartOffset || 0,
        };

        const rightClipStartOffset = (targetClip.audioStartOffset || 0) + leftLength;
        const rightClip: Clip = {
          ...targetClip,
          id: Date.now() + 1,
          start: splitBeat,
          length: rightLength,
          notes: targetClip.notes
            .filter((n) => n.start >= leftLength * PIANO_STEPS_PER_BEAT)
            .map((n) => ({
              ...n,
              id: n.id + 1000 + Math.floor(Math.random() * 1000),
              start: n.start - Math.round(leftLength * PIANO_STEPS_PER_BEAT),
            })),
          audioStartOffset: rightClipStartOffset,
        };

        const otherClips = track.clips.filter((c) => c.id !== clipId);
        return {
          ...track,
          clips: [...otherClips, leftClip, rightClip].sort((a, b) => a.start - b.start),
        };
      })
    );
  };

  const handleMergeClipWithNext = (trackId: number, clipId: number) => {
    recordHistory();
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const clips = [...track.clips].sort((a, b) => a.start - b.start);
        const clipIndex = clips.findIndex((c) => c.id === clipId);
        if (clipIndex === -1 || clipIndex === clips.length - 1) return track;

        const leftClip = clips[clipIndex];
        const rightClip = clips[clipIndex + 1];

        const mergedNotes = [
          ...leftClip.notes.map((n) => ({ ...n })),
          ...rightClip.notes.map((n) => ({
            ...n,
            id: n.id + 2000 + Math.floor(Math.random() * 1000),
            start: n.start + Math.round((rightClip.start - leftClip.start) * PIANO_STEPS_PER_BEAT),
          })),
        ];

        const mergedLength = rightClip.start + rightClip.length - leftClip.start;

        const mergedClip: Clip = {
          ...leftClip,
          id: Date.now(),
          length: mergedLength,
          notes: mergedNotes,
          audioStartOffset: leftClip.audioStartOffset || 0,
        };

        const otherClips = clips.filter((c) => c.id !== leftClip.id && c.id !== rightClip.id);
        return {
          ...track,
          clips: [...otherClips, mergedClip].sort((a, b) => a.start - b.start),
        };
      })
    );
  };

  const handleDeleteTimelineClip = (trackId: number, clipId: number) => {
    const targetTrack = tracks.find((track) => track.id === trackId) ?? null;
    if (!targetTrack || targetTrack.type === 'Bus') {
      return;
    }

    const targetClip = targetTrack.clips.find((clip) => clip.id === clipId);
    if (!targetClip) {
      setSelectedTimelineClip(null);
      return;
    }

    const remainingClips = targetTrack.clips.filter((clip) => clip.id !== clipId);
    updateTrackClips(trackId, (clips) =>
      clips.filter((clip) => clip.id !== clipId),
    );

    if (activePianoTrackId === trackId && activePianoClipId === clipId) {
      if (remainingClips.length > 0) {
        setActivePianoClipId(remainingClips[0].id);
      } else {
        setIsPianoRollOpen(false);
        setActivePianoTrackId(null);
        setActivePianoClipId(null);
      }

      setSelectedNoteIds([]);
      setSelectionBox(null);
      setDragState(null);
    }

    setSelectedTimelineClip(null);
  };

  const handleDeleteSelectedTimelineClip = () => {
    if (!selectedTimelineClip) {
      return;
    }
    handleDeleteTimelineClip(selectedTimelineClip.trackId, selectedTimelineClip.clipId);
  };

  const handleDeleteSelectedPianoNotes = () => {
    if (
      activePianoTrackId === null
      || activePianoClipId === null
      || selectedNoteIds.length === 0
    ) {
      return;
    }

    const selectedIds = new Set(selectedNoteIds);
    recordHistory();
    setTracks((prev) => prev.map((track) => (
      track.id === activePianoTrackId
        ? {
            ...track,
            clips: track.clips.map((clip) => (
              clip.id === activePianoClipId
                ? { ...clip, notes: clip.notes.filter((note) => !selectedIds.has(note.id)) }
                : clip
            )),
          }
        : track
    )));
    setSelectedNoteIds([]);
  };

  const handleSaveProject = async () => {
    const backendSuccess = await saveProjectToBackend(projectName, tracks, bpm, projectDescription);

    if (backendSuccess) {
      originalTracksRef.current = JSON.parse(JSON.stringify(tracks));
      originalBpmRef.current = bpm;
      setIsModified(false);
      if (
        hasUnsavedHistoryGuardRef.current
        && window.history.state?.bachStudioUnsavedGuard
      ) {
        allowHistoryNavigationRef.current = true;
        hasUnsavedHistoryGuardRef.current = false;
        window.history.back();
        window.setTimeout(() => {
          allowHistoryNavigationRef.current = false;
        }, 0);
      }
      setSaveNotification({
        message: `Saved online: ${projectName}`,
        visible: true,
      });
    } else {
      setSaveNotification({ message: 'Online save failed', visible: true });
    }

    setTimeout(() => {
      setSaveNotification({ message: '', visible: false });
    }, 2000);

    return backendSuccess;
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const showSaveNotification = (message: string) => {
    setSaveNotification({ message, visible: true });
    setTimeout(() => {
      setSaveNotification({ message: '', visible: false });
    }, 2000);
  };

  const writeAscii = (view: DataView, offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  const audioBufferToWavBlob = (buffer: AudioBuffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = buffer.length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(arrayBuffer);
    const channelData = Array.from({ length: numChannels }, (_, channel) => buffer.getChannelData(channel));
    let offset = 44;

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
      for (let channel = 0; channel < numChannels; channel += 1) {
        const sample = clamp(channelData[channel][sampleIndex], -1, 1);
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += bytesPerSample;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  const encodeVariableLengthQuantity = (value: number) => {
    let buffer = value & 0x7f;
    const bytes = [];

    while ((value >>= 7) > 0) {
      buffer <<= 8;
      buffer |= (value & 0x7f) | 0x80;
    }

    while (true) {
      bytes.push(buffer & 0xff);
      if (buffer & 0x80) {
        buffer >>= 8;
      } else {
        break;
      }
    }

    return bytes;
  };

  const numberToBytes = (value: number, byteCount: number) =>
    Array.from({ length: byteCount }, (_, index) => (value >> ((byteCount - index - 1) * 8)) & 0xff);

  const exportMidiFile = (events: PlaybackNoteEvent[], safeProjectName: string) => {
    const ticksPerBeat = 480;
    const tempoMicroseconds = Math.round(60000000 / bpm);
    const trackBytes: number[] = [
      0x00,
      0xff,
      0x51,
      0x03,
      ...numberToBytes(tempoMicroseconds, 3),
      0x00,
      0xc0,
      0x00,
    ];
    const midiEvents = events
      .filter((event) => event.pitch !== null)
      .flatMap((event) => {
        const startTick = Math.max(0, Math.round(event.startBeat * ticksPerBeat));
        const durationBeats = Math.max(1 / ticksPerBeat, (event.durationSeconds * bpm) / 60);
        const endTick = startTick + Math.max(1, Math.round(durationBeats * ticksPerBeat));
        const midiNote = pitchToMidi(event.pitch ?? 0);
        const velocity = Math.round(dbToVelocity(event.effectiveVolumeDb + getEventOutputCompDb(event)) * 100);

        return [
          { tick: startTick, bytes: [0x90, midiNote, clamp(velocity, 1, 127)] },
          { tick: endTick, bytes: [0x80, midiNote, 0x40] },
        ];
      })
      .sort((first, second) => first.tick - second.tick || first.bytes[0] - second.bytes[0]);
    let previousTick = 0;

    midiEvents.forEach((event) => {
      trackBytes.push(...encodeVariableLengthQuantity(event.tick - previousTick), ...event.bytes);
      previousTick = event.tick;
    });

    trackBytes.push(0x00, 0xff, 0x2f, 0x00);

    const header = [
      0x4d,
      0x54,
      0x68,
      0x64,
      0x00,
      0x00,
      0x00,
      0x06,
      0x00,
      0x00,
      0x00,
      0x01,
      ...numberToBytes(ticksPerBeat, 2),
    ];
    const trackHeader = [0x4d, 0x54, 0x72, 0x6b, ...numberToBytes(trackBytes.length, 4)];
    const midiBlob = new Blob([new Uint8Array([...header, ...trackHeader, ...trackBytes])], { type: 'audio/midi' });

    downloadBlob(midiBlob, `${safeProjectName}.mid`);
  };

  const renderProjectAudioBuffer = async (events: PlaybackNoteEvent[]) => {
    const sampleRate = 44100;
    const beatSeconds = 60 / bpm;
    const endBeat = Math.min(
      TIMELINE_TOTAL_BEATS,
      Math.max(4, ...events.map((event) => event.startBeat + event.durationSeconds / beatSeconds)),
    );
    const durationSeconds = Math.max(1, endBeat * beatSeconds + 1);
    const renderedToneBuffer = await Tone.Offline(async () => {
      const sampler = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3',
          C1: 'C1.mp3',
          'D#1': 'Ds1.mp3',
          'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',
          C2: 'C2.mp3',
          'D#2': 'Ds2.mp3',
          'F#2': 'Fs2.mp3',
          A2: 'A2.mp3',
          C3: 'C3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          A3: 'A3.mp3',
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
          C5: 'C5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
          A5: 'A5.mp3',
          C6: 'C6.mp3',
          'D#6': 'Ds6.mp3',
          'F#6': 'Fs6.mp3',
          A6: 'A6.mp3',
          C7: 'C7.mp3',
          'D#7': 'Ds7.mp3',
          'F#7': 'Fs7.mp3',
          A7: 'A7.mp3',
          C8: 'C8.mp3',
        },
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      const analogSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.35, release: 0.3 },
      }).toDestination();
      const organSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 2.2,
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.7, release: 0.5 },
      }).toDestination();
      const bassSynth = new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2.4, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.2, release: 0.25 },
        filterEnvelope: { attack: 0.005, decay: 0.18, sustain: 0.15, release: 0.2, baseFrequency: 80, octaves: 3 },
      }).toDestination();
      const elecGuitarSampler = new Tone.Sampler({
        urls: {
          'D#3': 'Ds3.mp3',
          'D#4': 'Ds4.mp3',
          'D#5': 'Ds5.mp3',
          'E2': 'E2.mp3',
          'F#2': 'Fs2.mp3',
          'F#3': 'Fs3.mp3',
          'F#4': 'Fs4.mp3',
          'F#5': 'Fs5.mp3',
          'A2': 'A2.mp3',
          'A3': 'A3.mp3',
          'A4': 'A4.mp3',
          'A5': 'A5.mp3',
          'C3': 'C3.mp3',
          'C4': 'C4.mp3',
          'C5': 'C5.mp3',
          'C6': 'C6.mp3',
          'C#2': 'Cs2.mp3'
        },
        release: 1,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/',
      }).toDestination();
      const elecBassSampler = new Tone.Sampler({
        urls: {
          'A#1': 'As1.mp3',
          'A#2': 'As2.mp3',
          'A#3': 'As3.mp3',
          'A#4': 'As4.mp3',
          'C#1': 'Cs1.mp3',
          'C#2': 'Cs2.mp3',
          'C#3': 'Cs3.mp3',
          'C#4': 'Cs4.mp3',
          'E1': 'E1.mp3',
          'E2': 'E2.mp3',
          'E3': 'E3.mp3',
          'E4': 'E4.mp3',
          'G1': 'G1.mp3',
          'G2': 'G2.mp3',
          'G3': 'G3.mp3',
          'G4': 'G4.mp3'
        },
        release: 1.2,
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/bass-electric/',
      }).toDestination();
      const elecPianoSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 1.5, sustain: 0.1, release: 1 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 1 }
      }).toDestination();
      const kickSynth = new Tone.MembraneSynth({
        volume: 10,
        pitchDecay: 0.04,
        octaves: 8,
        envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.2 },
      }).toDestination();
      const snareSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      }).toDestination();
      const hatSynth = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.12, release: 0.06 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4200,
        octaves: 1.5,
      }).toDestination();
      const clapSynth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
      }).toDestination();

      await Tone.loaded();

      events.forEach((event) => {
        if (event.pitch === null) {
          return;
        }

        const noteName = pitchToNoteName(event.pitch);
        const startTime = event.startBeat * beatSeconds;
        const duration = Math.max(0.05, event.durationSeconds);
        const compensatedDb = event.effectiveVolumeDb + getEventOutputCompDb(event) + masterVolumeDb;
        const velocity = dbToVelocity(compensatedDb);

        if (event.trackType === 'Drums') {
          const lane = resolveDrumLane(event.pitch);
          if (lane === 'kick') {
            const kickNote = event.drumKitId === 'trap808'
              ? 'C1'
              : event.drumKitId === 'jazz'
                ? 'G1'
                : event.drumKitId === 'electro'
                  ? 'E1'
                  : 'D1';
            kickSynth.triggerAttackRelease(kickNote, Math.max(0.08, duration), startTime, velocity);
          } else if (lane === 'snare') {
            snareSynth.triggerAttackRelease('16n', startTime, velocity);
          } else if (lane === 'hat') {
            hatSynth.triggerAttackRelease('C6', '32n', startTime, velocity);
          } else {
            clapSynth.triggerAttackRelease('16n', startTime, Math.min(1, velocity * 1.6));
          }
          return;
        }

        if (event.instrumentPresetId === 'piano') {
          sampler.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }

        if (event.instrumentPresetId === 'analog') {
          analogSynth.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }

        if (event.instrumentPresetId === 'organ') {
          organSynth.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }

        if (event.instrumentPresetId === 'bass') {
          bassSynth.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }

        if (event.instrumentPresetId === 'elec_guitar') {
          elecGuitarSampler.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }

        if (event.instrumentPresetId === 'elec_bass') {
          elecBassSampler.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }

        if (event.instrumentPresetId === 'elec_piano') {
          elecPianoSynth.triggerAttackRelease(noteName, duration, startTime, velocity);
          return;
        }
      });
    }, durationSeconds, 2, sampleRate);
    const renderedBuffer = renderedToneBuffer.get();

    if (!renderedBuffer) {
      throw new Error('Rendered buffer is empty');
    }

    return renderedBuffer;
  };

  const channelToInt16 = (channel: Float32Array) => {
    const samples = new Int16Array(channel.length);

    for (let index = 0; index < channel.length; index += 1) {
      const sample = clamp(channel[index], -1, 1);
      samples[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return samples;
  };

  const audioBufferToMp3Blob = async (buffer: AudioBuffer) => {
    const lameJsRuntime = await loadLameJsRuntime();
    const left = channelToInt16(buffer.getChannelData(0));
    const right = channelToInt16(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
    const encoder = new lameJsRuntime.Mp3Encoder(2, buffer.sampleRate, 192);
    const chunkSize = 1152;
    const mp3Chunks: ArrayBuffer[] = [];
    const copyToArrayBuffer = (bytes: Int8Array) => {
      const copy = new Uint8Array(bytes.length);
      copy.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      return copy.buffer;
    };

    for (let start = 0; start < left.length; start += chunkSize) {
      const leftChunk = left.subarray(start, start + chunkSize);
      const rightChunk = right.subarray(start, start + chunkSize);
      const encoded = encoder.encodeBuffer(leftChunk, rightChunk);

      if (encoded.length > 0) {
        mp3Chunks.push(copyToArrayBuffer(encoded));
      }
    }

    const flushed = encoder.flush();
    if (flushed.length > 0) {
      mp3Chunks.push(copyToArrayBuffer(flushed));
    }

    return new Blob(mp3Chunks, { type: 'audio/mpeg' });
  };

  const handleExportProject = async (format: ExportFormat) => {
    setIsExportMenuOpen(false);
    const events = buildPlaybackEvents().filter(
      (event) => (event.trackType === 'Instrument' || event.trackType === 'Drums') && event.pitch !== null,
    );
    const safeProjectName = projectName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'bach-studio-project';

    if (events.length === 0) {
      showSaveNotification('No instrument or drum notes to export');
      return;
    }

    setSaveNotification({ message: `Rendering ${format.toUpperCase()}...`, visible: true });

    try {
      const renderedBuffer = await renderProjectAudioBuffer(events);

      if (format === 'mp3') {
        const mp3Blob = await audioBufferToMp3Blob(renderedBuffer);
        downloadBlob(mp3Blob, `${safeProjectName}.mp3`);
        showSaveNotification(`Exported MP3: ${safeProjectName}`);
        return;
      }

      const wavBlob = audioBufferToWavBlob(renderedBuffer);
      downloadBlob(wavBlob, `${safeProjectName}.wav`);
      showSaveNotification(`Exported WAV: ${safeProjectName}`);
    } catch (error) {
      console.error(`Failed to export ${format}:`, error);
      showSaveNotification(error instanceof Error ? error.message : `${format.toUpperCase()} export failed`);
    }
  };

  const handleExportSelectedTrackMidi = () => {
    if (!selectedTrack || selectedTrack.type !== 'Instrument') {
      showSaveNotification('Select an instrument track first');
      return;
    }

    const events = buildPlaybackEvents({ respectMuteSolo: false, trackId: selectedTrack.id }).filter(
      (event) => event.trackType === 'Instrument' && event.pitch !== null,
    );

    if (events.length === 0) {
      showSaveNotification('Selected track has no MIDI notes');
      return;
    }

    const safeProjectName = projectName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'bach-studio-project';
    const safeTrackName = selectedTrack.name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'track';

    exportMidiFile(events, `${safeProjectName}-${safeTrackName}`);
    showSaveNotification(`Exported MIDI: ${safeTrackName}`);
  };

  const handleLoadProject = async () => {
    if (isModified) {
      const shouldSave = window.confirm(
        '저장하지 않은 변경사항이 있습니다.\n저장하시겠습니까?'
      );
      if (shouldSave) {
        const isSaved = await handleSaveProject();
        if (!isSaved) {
          return;
        }
      }
    }
    navigate('/projects');
  };

  useEffect(() => {
    let isCancelled = false;

    const applyProject = (loadedProject: { tracks: Track[]; bpm: number; description?: string }) => {
      if (isCancelled) {
        return;
      }

      const normalizedTracks = loadedProject.tracks.map((track) => ({
        ...DEFAULT_TRACK_SETTINGS,
        ...track,
        reverbWet: track.reverbWet ?? 0,
        delayWet: track.delayWet ?? 0,
        distortion: track.distortion ?? 0,
        clips: track.clips.map((clip) => ({ ...clip, notes: clip.notes ?? [] })),
      }));
      setTracks(normalizedTracks);
      setBpm(loadedProject.bpm);
      setProjectDescription(loadedProject.description ?? '');
      undoStackRef.current = [];
      redoStackRef.current = [];
      originalTracksRef.current = JSON.parse(JSON.stringify(normalizedTracks));
      originalBpmRef.current = loadedProject.bpm;
      setIsModified(false);
    };

    void loadProjectFromBackend(projectName).then((backendProject) => {
      if (backendProject) {
        applyProject(backendProject);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [projectName]);

  useEffect(() => {
    if (hasPianoTrack) {
      createPianoSampler();
    }
  }, [hasPianoTrack]);

  // 변경 감지: tracks나 bpm이 원본과 다르면 isModified = true
  useEffect(() => {
    if (isModified) {
      return;
    }

    const hasChanges =
      JSON.stringify(tracks) !== JSON.stringify(originalTracksRef.current) ||
      bpm !== originalBpmRef.current;
    if (hasChanges) {
      setIsModified(true);
    }
  }, [tracks, bpm, isModified]);

  // 페이지 떠나기 전에 경고 (뒤로가기, 새 페이지로 이동)
  useEffect(() => {
    if (!isModified) return;

    if (!hasUnsavedHistoryGuardRef.current) {
      window.history.pushState(
        { ...window.history.state, bachStudioUnsavedGuard: true },
        '',
        window.location.href,
      );
      hasUnsavedHistoryGuardRef.current = true;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handlePopState = async () => {
      if (allowHistoryNavigationRef.current) {
        return;
      }

      const shouldSave = window.confirm(
        '저장하지 않은 변경사항이 있습니다.\n저장하시겠습니까?'
      );

      if (shouldSave) {
        const isSaved = await handleSaveProject();
        if (!isSaved) {
          window.history.forward();
          return;
        }
      }

      allowHistoryNavigationRef.current = true;
      hasUnsavedHistoryGuardRef.current = false;
      window.history.back();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isModified, tracks, bpm, projectDescription]);

  const triggerTrackPreview = async (track: Track, pitch: number, durationSeconds = 0.35) => {
    try {
      await ensureToneReady();
      const compensatedDb = getEffectiveTrackVolumeDb(track) + getTrackOutputCompDb(track);
      const velocity = dbToVelocity(compensatedDb);

      if (track.type === 'Instrument') {
        if (track.instrumentPresetId === 'piano') {
          await ensurePianoSampler();
        } else if (track.instrumentPresetId === 'analog') {
          await ensureAnalogSynth();
        } else if (track.instrumentPresetId === 'organ') {
          await ensureOrganSynth();
        } else if (track.instrumentPresetId === 'bass') {
          await ensureBassSynth();
        } else if (track.instrumentPresetId === 'elec_guitar') {
          await ensureElecGuitarSampler();
        } else if (track.instrumentPresetId === 'elec_bass') {
          await ensureElecBassSampler();
        } else if (track.instrumentPresetId === 'elec_piano') {
          await ensureElecPianoSynth();
        } else if (track.instrumentPresetId === 'cello') {
          await ensureCelloSampler();
        } else if (track.instrumentPresetId === 'flute') {
          await ensureFluteSampler();
        } else if (track.instrumentPresetId === 'violin') {
          await ensureViolinSampler();
        }

        triggerInstrumentNote(track.id, track.instrumentPresetId, pitch, durationSeconds, velocity);
        return;
      }

      if (track.type === 'Drums') {
        await ensureDrumSynths();
        triggerDrumNote(track.id, track.drumKitId, pitch, durationSeconds, velocity);
        return;
      }

      if (track.type === 'Audio') {
        const player = await ensureAudioPlayer(track.audioSourceId);
        routeSourceToTrack(player, track.id);
        player.volume.value = compensatedDb;
        player.start(undefined, 0, Math.max(0.1, durationSeconds));
      }
    } catch {
      // Ignore audio context errors until the browser allows a valid gesture.
    }
  };

  useEffect(() => {
    return () => {
      playbackSessionRef.current = null;
      cancelPlaybackTimer();
      samplerRef.current?.dispose();
      analogSynthRef.current?.dispose();
      organSynthRef.current?.dispose();
      bassSynthRef.current?.dispose();
      kickSynthRef.current?.dispose();
      snareSynthRef.current?.dispose();
      hatSynthRef.current?.dispose();
      clapSynthRef.current?.dispose();
      Object.values(audioPlayersRef.current).forEach((player) => player?.dispose());
      recordedAudioPlayersRef.current.forEach((player) => player.dispose());
      trackEffectChainsRef.current.forEach((chain) => {
        chain.input.dispose();
        chain.distortion.dispose();
        chain.delay.dispose();
        chain.reverb.dispose();
      });
      voiceMediaRecorderRef.current?.stop();
      voiceMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      samplerRef.current = null;
      samplerLoadPromiseRef.current = null;
      analogSynthRef.current = null;
      organSynthRef.current = null;
      bassSynthRef.current = null;
      kickSynthRef.current = null;
      snareSynthRef.current = null;
      hatSynthRef.current = null;
      clapSynthRef.current = null;
      audioPlayersRef.current = {};
      recordedAudioPlayersRef.current.clear();
      trackEffectChainsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea' || target?.isContentEditable) {
        return;
      }

      const isSpacebar = event.code === 'Space' || event.key === ' ';
      const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c';
      const isPaste = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v';
      const isSave = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
      const isUndo = (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
      const isRedo = (event.ctrlKey || event.metaKey)
        && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'));
      const isDelete = event.key === 'Delete' || event.key === 'Backspace';

      if (isUndo) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (isRedo) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (isSpacebar) {
        event.preventDefault();
        handlePlayToggle();
        return;
      }

      if (isSave) {
        event.preventDefault();
        void handleSaveProject();
        return;
      }

      if (isDelete && isPianoRollOpen) {
        if (selectedNoteIds.length > 0) {
          event.preventDefault();
          handleDeleteSelectedPianoNotes();
        }
        return;
      }

      if (isDelete && selectedTimelineClip) {
        event.preventDefault();
        handleDeleteSelectedTimelineClip();
        return;
      }

      if (isCopy) {
        event.preventDefault();
        if (isPianoRollOpen) {
          handleCopySelectedNotes();
        } else if (selectedTrack && canUsePianoRoll(selectedTrack)) {
          handleCopySelectedMidiTrack();
        }
        return;
      }

      if (isPaste) {
        event.preventDefault();
        if (isPianoRollOpen) {
          handlePasteNotes();
        } else if (copiedMidiChunk && selectedTrack && canUsePianoRoll(selectedTrack)) {
          handlePasteMidiTrack();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedTrack,
    copiedMidiChunk,
    copiedNotes,
    selectedTimelineClip,
    selectedNoteIds,
    isPianoRollOpen,
    tracks,
    projectName,
    bpm,
    handleCopySelectedMidiTrack,
    handlePasteMidiTrack,
    handleCopySelectedNotes,
    handlePasteNotes,
    handleDeleteSelectedTimelineClip,
    handleDeleteSelectedPianoNotes,
    handleSaveProject,
    handlePlayToggle,
    handleUndo,
    handleRedo,
  ]);

  const updateActiveClipNotes = (updater: (notes: Note[]) => Note[], addToHistory = true) => {
    if (activePianoTrackId === null || activePianoClipId === null) {
      return;
    }

    if (addToHistory) {
      recordHistory();
    }
    setTracks((prev) => {
      return prev.map((track) => {
        if (track.id !== activePianoTrackId) {
          return track;
        }

        return {
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === activePianoClipId ? { ...clip, notes: updater(clip.notes) } : clip,
          ),
        };
      });
    });
  };

  const updateTrackClips = (trackId: number, updater: (clips: Clip[]) => Clip[], addToHistory = true) => {
    if (addToHistory) {
      recordHistory();
    }
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, clips: updater(track.clips) } : track)),
    );
  };

  const updateTrackById = (trackId: number, updater: (track: Track) => Track, addToHistory = true) => {
    if (addToHistory) {
      recordHistory();
    }
    setTracks((prev) => prev.map((track) => (track.id === trackId ? updater(track) : track)));
  };



  const getPointerInGrid = (clientX: number, clientY: number, totalCols: number) => {
    if (!gridRef.current) {
      return { x: 0, y: 0 };
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left + gridRef.current.scrollLeft;
    const y = clientY - rect.top + gridRef.current.scrollTop - 24;

    return {
      x: clamp(Math.floor(x), 0, totalCols * GRID_COL_WIDTH),
      y: clamp(Math.floor(y), 0, pianoRows.length * GRID_ROW_HEIGHT),
    };
  };

  const syncVerticalScroll = (source: 'grid' | 'keys') => {
    if (!gridRef.current || !pianoKeysRef.current || isSyncingScrollRef.current) {
      return;
    }

    isSyncingScrollRef.current = true;
    if (source === 'grid') {
      pianoKeysRef.current.scrollTop = gridRef.current.scrollTop;
    } else {
      gridRef.current.scrollTop = pianoKeysRef.current.scrollTop;
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const convertHummingNoteToPianoRollNote = (note: HummingAiNote, clipLengthBeats: number) => {
    const maxCols = getClipTotalCols(clipLengthBeats);
    const start = clamp(Math.round(note.startBeat * PIANO_STEPS_PER_BEAT), 0, maxCols - 1);
    const length = clamp(Math.round(note.durationBeats * PIANO_STEPS_PER_BEAT), 1, maxCols - start);
    const pitch = clamp(MIDI_HIGH - (note.pitch ?? note.midi), 0, GRID_TOTAL_ROWS - 1);

    return { start, pitch, length };
  };

  const getRealtimeClipLength = (targetBeat: number) => {
    if (!activeTrack || !activeClip) {
      return CLIP_DEFAULT_LENGTH_BEATS;
    }

    const currentLength = Math.max(realtimeClipLengthRef.current, activeClip.length);
    if (targetBeat <= currentLength) {
      return currentLength;
    }

    const snappedLength = Math.ceil(
      Math.max(targetBeat, currentLength, CLIP_SNAP_BEATS) / REALTIME_CLIP_GROWTH_BEATS,
    ) * REALTIME_CLIP_GROWTH_BEATS;
    const nextLength = clamp(snappedLength, currentLength, MAX_REALTIME_HUMMING_BEATS);

    if (nextLength > currentLength) {
      realtimeClipLengthRef.current = nextLength;
    }

    return nextLength;
  };

  const updateRealtimeActiveClip = (
    nextLength: number,
    notesUpdater: (notes: Note[]) => Note[],
  ) => {
    if (activePianoTrackId === null || activePianoClipId === null) {
      return;
    }

    setTracks((prev) => prev.map((track) => {
      if (track.id !== activePianoTrackId) {
        return track;
      }

      return {
        ...track,
        clips: track.clips.map((clip) => (
          clip.id === activePianoClipId
            ? {
                ...clip,
                length: Math.max(clip.length, nextLength),
                notes: notesUpdater(clip.notes),
              }
            : clip
        )),
      };
    }));
  };

  const handleRealtimeHummingProgress = (beat: number) => {
    if (activePianoTrackId === null || activePianoClipId === null) {
      return;
    }

    const previousLength = realtimeClipLengthRef.current;
    const nextLength = getRealtimeClipLength(
      Math.min(beat + REALTIME_CLIP_GROWTH_BEATS / 2, MAX_REALTIME_HUMMING_BEATS),
    );
    if (nextLength <= previousLength) {
      return;
    }

    setTracks((prev) => prev.map((track) => (
      track.id === activePianoTrackId
        ? {
            ...track,
            clips: track.clips.map((clip) => (
              clip.id === activePianoClipId
                ? { ...clip, length: Math.max(clip.length, nextLength) }
                : clip
            )),
          }
        : track
    )));
  };

  const handleStartRealtimeHumming = () => {
    if (!activeTrack || !activeClip) {
      showSaveNotification('Open a piano roll clip before recording');
      return false;
    }

    liveHummingNoteIdRef.current = null;
    liveHummingNoteIdsRef.current = [];
    lastRealtimeNoteUpdateRef.current = 0;
    realtimeClipLengthRef.current = activeClip.length;
    recordHistory();
    setSelectedNoteIds([]);

    return true;
  };

  const handleStartRealtimeHummingPlayback = async () => {
    await startPlayback(0);
  };

  const handleRealtimeHummingCountInBeat = (beat: number) => {
    triggerMetronomeClick(beat - 1);
  };

  const handleRealtimeHummingEvent = (event: HummingStreamEvent) => {
    if (!activeTrack || !activeClip) {
      return;
    }

    if (event.type === 'complete') {
      const latestClipLength = getRealtimeClipLength(
        Math.max(CLIP_SNAP_BEATS, ...event.notes.map((note) => note.startBeat + note.durationBeats + CLIP_SNAP_BEATS)),
      );
      const liveIds = new Set(liveHummingNoteIdsRef.current);
      const nextIds = event.notes.map((note, index) => Date.now() + Math.round(note.startBeat * 1000) + note.midi + index);
      const finalNotes = event.notes.map((note, index) => ({
        id: nextIds[index],
        ...convertHummingNoteToPianoRollNote(note, latestClipLength),
      }));

      updateRealtimeActiveClip(latestClipLength, (notes) => [
        ...notes.filter((note) => !liveIds.has(note.id)),
        ...finalNotes,
      ]);
      liveHummingNoteIdRef.current = null;
      liveHummingNoteIdsRef.current = [];
      setSelectedNoteIds(nextIds);
      return;
    }

    if (event.type !== 'note_on' && event.type !== 'note_update' && event.type !== 'note_off') {
      return;
    }

    if (event.type === 'note_update') {
      const now = performance.now();
      if (now - lastRealtimeNoteUpdateRef.current < HUMMING_NOTE_UPDATE_MS) {
        return;
      }
      lastRealtimeNoteUpdateRef.current = now;
    }

    const noteEndBeat = event.note.startBeat + event.note.durationBeats + CLIP_SNAP_BEATS;
    const realtimeClipLength = getRealtimeClipLength(noteEndBeat);
    const convertedNote = convertHummingNoteToPianoRollNote(event.note, realtimeClipLength);

    if (event.type === 'note_on' || liveHummingNoteIdRef.current === null) {
      const noteId = Date.now() + Math.round(event.note.startBeat * 1000) + event.note.midi;
      liveHummingNoteIdRef.current = noteId;
      liveHummingNoteIdsRef.current = [...liveHummingNoteIdsRef.current, noteId];
      updateRealtimeActiveClip(
        realtimeClipLength,
        (notes) => [...notes, { id: noteId, ...convertedNote }],
      );
      setSelectedNoteIds([noteId]);
      return;
    }

    const noteId = liveHummingNoteIdRef.current;
    updateRealtimeActiveClip(
      realtimeClipLength,
      (notes) => notes.map((note) => (note.id === noteId ? { ...note, ...convertedNote } : note)),
    );

    if (event.type === 'note_off') {
      liveHummingNoteIdRef.current = null;
    }
  };

  const handleAddTrack = (type: TrackType) => {
    const nextIndex = tracks.length + 1;
    const isVoiceTrack = type === 'Audio';
    const isDrumTrack = type === 'Drums';
    const createdTrack: Track = {
      id: Date.now() + nextIndex,
      type,
      name: `${String(nextIndex).padStart(2, '0')} ${isVoiceTrack ? 'VOICE RECORDING' : isDrumTrack ? 'DRUMS KIT' : 'PIANO TRACK'}`,
      icon: isVoiceTrack ? 'mic' : isDrumTrack ? 'album' : 'piano',
      clipClass: CLIP_CLASS_BY_TYPE[type],
      clips: [],
      muted: false,
      soloed: false,
      ...DEFAULT_TRACK_SETTINGS,
      outputBusId: null,
    };

    recordHistory();
    setTracks((prev) => [...prev, createdTrack]);
    setSelectedTrackId(createdTrack.id);
  };

  const handleTrackClick = (trackId: number) => {
    setSelectedTrackId(trackId);
    setSelectedTimelineClip(null);
  };

  const handleSelectedTrackInstrumentChange = (presetId: Track['instrumentPresetId']) => {
    if (!selectedTrack) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, instrumentPresetId: presetId }));
  };

  const handleSelectedTrackDrumKitChange = (kitId: Track['drumKitId']) => {
    if (!selectedTrack) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, drumKitId: kitId }));
  };

  const handleSelectedTrackNameChange = (name: string) => {
    if (!selectedTrack) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, name }), false);
  };

  const handleSelectedTrackNameBlur = () => {
    if (!selectedTrack || selectedTrack.name.trim()) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, name: `${String(track.id).slice(-2)} PIANO TRACK` }));
  };

  const handleToggleTrackMute = (trackId: number) => {
    updateTrackById(trackId, (track) => {
      const nextMuted = track.muted !== true;
      return {
        ...track,
        muted: nextMuted,
        soloed: nextMuted ? false : track.soloed,
      };
    });
  };

  const handleToggleTrackSolo = (trackId: number) => {
    updateTrackById(trackId, (track) => {
      const nextSoloed = track.soloed !== true;
      return {
        ...track,
        soloed: nextSoloed,
        muted: nextSoloed ? false : track.muted,
      };
    });
  };

  const handleSelectedTrackVolumeChange = (rawValue: string) => {
    if (!selectedTrack || selectedTrack.type === 'Bus') {
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, volumeDb: clamp(parsed, -24, 12) }), false);
  };

  const nudgeSelectedTrackVolume = (delta: number) => {
    if (!selectedTrack || selectedTrack.type === 'Bus') {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({
      ...track,
      volumeDb: clamp(track.volumeDb + delta, -24, 12),
    }));
  };

  const handleSelectedTrackEffectChange = (
    effect: 'reverbWet' | 'delayWet' | 'distortion',
    rawValue: string,
  ) => {
    if (!selectedTrack || selectedTrack.type === 'Bus') {
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    updateTrackById(
      selectedTrack.id,
      (track) => ({ ...track, [effect]: clamp(parsed, 0, 1) }),
      false,
    );
  };

  const handleMasterVolumeChange = (rawValue: string) => {
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setMasterVolumeDb(clamp(parsed, -60, 6));
  };

  useEffect(() => {
    const handleDeviceSettingsChange = (event: Event) => {
      const settings = (event as CustomEvent<AudioDeviceSettings>).detail ?? getDeviceSettings();
      setCurrentDeviceSettings(settings);
    };

    window.addEventListener(DEVICE_SETTINGS_CHANGE_EVENT, handleDeviceSettingsChange);
    return () => window.removeEventListener(DEVICE_SETTINGS_CHANGE_EVENT, handleDeviceSettingsChange);
  }, []);

  useEffect(() => {
    const rawContext = Tone.getContext().rawContext as AudioContext & {
      setSinkId?: (sinkId: string) => Promise<void>;
    };
    if (rawContext.setSinkId) {
      void rawContext.setSinkId(deviceSettings.outputDeviceId || 'default').catch((error) => {
        console.warn('Audio output selection failed:', error);
      });
    }
  }, [deviceSettings.outputDeviceId]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      return;
    }

    let disposed = false;
    let activeInput: MIDIInput | null = null;

    void navigator.requestMIDIAccess().then((access) => {
      if (disposed) {
        return;
      }

      midiAccessRef.current = access;
      activeInput = deviceSettings.midiInputId
        ? access.inputs.get(deviceSettings.midiInputId) ?? null
        : access.inputs.values().next().value ?? null;

      if (!activeInput) {
        return;
      }

      activeInput.onmidimessage = (message) => {
        if (!message.data) {
          return;
        }
        const [status = 0, midiNote = 0, velocity = 0] = Array.from(message.data);
        const command = status & 0xf0;
        const isNoteOn = command === 0x90 && velocity > 0;
        const isNoteOff = command === 0x80 || (command === 0x90 && velocity === 0);
        const midiTrack = activeTrack?.type === 'Instrument'
          ? activeTrack
          : selectedTrack?.type === 'Instrument'
            ? selectedTrack
            : null;
        if ((!isNoteOn && !isNoteOff) || !midiTrack) {
          return;
        }

        const pitch = clamp(MIDI_HIGH - midiNote, 0, GRID_TOTAL_ROWS - 1);
        if (isNoteOn) {
          void triggerTrackPreview(midiTrack, pitch, 0.3);
        }
        if (!activeTrack || !activeClip || activeTrack.id !== midiTrack.id) {
          return;
        }

        const currentBeat = isPlaying ? getCurrentSessionBeat() : playheadBeat;
        const relativeBeat = clamp(currentBeat - activeClip.start, 0, activeClip.length);
        const startStep = clamp(Math.round(relativeBeat * PIANO_STEPS_PER_BEAT), 0, activeClipTotalCols - 1);

        if (isNoteOn) {
          recordHistory();
          const noteId = Date.now() + midiNote;
          midiHeldNotesRef.current.set(midiNote, { noteId, startBeat: relativeBeat });
          updateActiveClipNotes((notes) => [
            ...notes,
            {
              id: noteId,
              start: startStep,
              pitch,
              length: 1,
            },
          ], false);
          setSelectedNoteIds([noteId]);
          return;
        }

        const heldNote = midiHeldNotesRef.current.get(midiNote);
        if (!heldNote) {
          return;
        }

        const lengthSteps = Math.max(
          1,
          Math.round((relativeBeat - heldNote.startBeat) * PIANO_STEPS_PER_BEAT),
        );
        updateActiveClipNotes(
          (notes) => notes.map((note) => (
            note.id === heldNote.noteId
              ? { ...note, length: clamp(lengthSteps, 1, activeClipTotalCols - note.start) }
              : note
          )),
          false,
        );
        midiHeldNotesRef.current.delete(midiNote);
      };
    }).catch((error) => {
      console.warn('MIDI input failed:', error);
    });

    return () => {
      disposed = true;
      if (activeInput) {
        activeInput.onmidimessage = null;
      }
      midiHeldNotesRef.current.clear();
    };
  }, [
    deviceSettings.midiInputId,
    activeTrack,
    activeClip,
    selectedTrack,
    activeClipTotalCols,
    isPlaying,
    playheadBeat,
  ]);

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Recording conversion failed'));
    reader.readAsDataURL(blob);
  });

  const createAudioPreview = async (blob: Blob) => {
    const previewContext = new AudioContext();
    try {
      const audioBuffer = await previewContext.decodeAudioData(await blob.arrayBuffer());
      const channelData = audioBuffer.getChannelData(0);
      const previewBarCount = 72;
      const samplesPerBar = Math.max(1, Math.floor(channelData.length / previewBarCount));

      return Array.from({ length: previewBarCount }, (_, index) => {
        const start = index * samplesPerBar;
        const end = Math.min(start + samplesPerBar, channelData.length);
        let peak = 0;
        for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
          peak = Math.max(peak, Math.abs(channelData[sampleIndex]));
        }
        return Math.min(1, peak * 1.8);
      });
    } finally {
      await previewContext.close();
    }
  };

  const getAudioDurationSeconds = async (blob: Blob) => {
    const audioContext = new AudioContext();
    try {
      const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
      return audioBuffer.duration;
    } finally {
      await audioContext.close();
    }
  };

  const handleAudioFileDrop = async (file: File, trackId: number, startBeat: number) => {
    const isMp3 = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');
    if (!isMp3) {
      showSaveNotification('Only MP3 files can be added');
      return;
    }

    try {
      const [audioDataUrl, audioPreview, durationSeconds] = await Promise.all([
        blobToDataUrl(file),
        createAudioPreview(file),
        getAudioDurationSeconds(file),
      ]);
      const lengthBeats = Math.max(0.25, durationSeconds * (bpm / 60));
      const clipId = Date.now();

      recordHistory();
      updateTrackClips(trackId, (clips) => [
        ...clips,
        {
          id: clipId,
          start: startBeat,
          length: Math.min(lengthBeats, TIMELINE_TOTAL_BEATS - startBeat),
          notes: [],
          audioDataUrl,
          audioMimeType: file.type || 'audio/mpeg',
          audioFileName: file.name,
          audioPreview,
        },
      ], false);
      setSelectedTrackId(trackId);
      setSelectedTimelineClip({ trackId, clipId });
      void ensureRecordedAudioPlayer(audioDataUrl);
      showSaveNotification(`Added MP3: ${file.name}`);
    } catch (error) {
      console.error('MP3 import failed:', error);
      showSaveNotification('MP3 import failed');
    }
  };

  useEffect(() => {
    const missingPreviews = tracks.flatMap((track) => track.clips
      .filter((clip) => clip.audioDataUrl && (!clip.audioPreview || clip.audioPreview.length === 0))
      .map((clip) => ({
        trackId: track.id,
        clipId: clip.id,
        audioDataUrl: clip.audioDataUrl as string,
      })));

    missingPreviews.forEach(({ trackId, clipId, audioDataUrl }) => {
      const jobKey = `${trackId}:${clipId}`;
      if (audioPreviewJobsRef.current.has(jobKey)) {
        return;
      }
      audioPreviewJobsRef.current.add(jobKey);

      void fetch(audioDataUrl)
        .then((response) => response.blob())
        .then(createAudioPreview)
        .then((audioPreview) => {
          setTracks((prev) => prev.map((track) => (
            track.id === trackId
              ? {
                  ...track,
                  clips: track.clips.map((clip) => (
                    clip.id === clipId && clip.audioDataUrl === audioDataUrl
                      ? { ...clip, audioPreview }
                      : clip
                  )),
                }
              : track
          )));
        })
        .catch((error) => {
          console.warn('Audio preview generation failed:', error);
        })
        .finally(() => {
          audioPreviewJobsRef.current.delete(jobKey);
        });
    });
  }, [tracks]);

  const stopVoiceRecording = () => {
    const recorder = voiceMediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    pausePlayback();
  };

  const startVoiceRecording = async () => {
    if (!selectedTrack || selectedTrack.type !== 'Audio') {
      showSaveNotification('Select a voice recording track first');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showSaveNotification('Voice recording is not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceSettings.inputDeviceId
          ? { deviceId: { exact: deviceSettings.inputDeviceId } }
          : true,
      });
      const preferredMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined);
      
      const activeSession = playbackSessionRef.current;
      const liveBeat = activeSession 
        ? clamp(activeSession.startBeat + ((performance.now() - activeSession.startWallTime) / 1000 * activeSession.bpm) / 60, 0, TIMELINE_TOTAL_BEATS)
        : playheadBeat;
      const startBeat = clamp(liveBeat, 0, TIMELINE_TOTAL_BEATS - 0.25);
      const trackId = selectedTrack.id;

      recordHistory();
      voiceMediaStreamRef.current = stream;
      voiceMediaRecorderRef.current = recorder;
      voiceRecordingChunksRef.current = [];
      voiceRecordingStartRef.current = { time: performance.now(), beat: startBeat, trackId };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceRecordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const recordingStart = voiceRecordingStartRef.current;
        const chunks = voiceRecordingChunksRef.current;
        const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm';

        voiceMediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        voiceMediaStreamRef.current = null;
        voiceMediaRecorderRef.current = null;
        voiceRecordingStartRef.current = null;
        voiceRecordingChunksRef.current = [];
        setIsVoiceRecording(false);

        if (!recordingStart || chunks.length === 0) {
          return;
        }

        const durationSeconds = Math.max(0.05, (performance.now() - recordingStart.time) / 1000);
        const lengthBeats = Math.max(0.25, durationSeconds * (bpm / 60));
        const blob = new Blob(chunks, { type: mimeType });
        void Promise.all([
          blobToDataUrl(blob),
          createAudioPreview(blob).catch(() => []),
        ]).then(([audioDataUrl, audioPreview]) => {
          const clipId = Date.now();
          updateTrackClips(recordingStart.trackId, (clips) => [
            ...clips,
            {
              id: clipId,
              start: recordingStart.beat,
              length: Math.min(lengthBeats, TIMELINE_TOTAL_BEATS - recordingStart.beat),
              notes: [],
              audioDataUrl,
              audioMimeType: mimeType,
              audioPreview,
            },
          ], false);
          setSelectedTimelineClip({ trackId: recordingStart.trackId, clipId });
          void ensureRecordedAudioPlayer(audioDataUrl);
        }).catch((error) => {
          console.error('Voice recording conversion failed:', error);
          showSaveNotification('Voice recording conversion failed');
        });
      };

      recorder.start(250);
      setIsVoiceRecording(true);
      showSaveNotification('Voice recording started');

      if (!playbackSessionRef.current) {
        await startPlayback(startBeat);
      }
    } catch (error) {
      console.error('Voice recording failed:', error);
      showSaveNotification(error instanceof Error ? error.message : 'Voice recording failed');
    }
  };

  const openPianoRollForClip = (trackId: number, clipId: number) => {
    const targetTrack = tracks.find((track) => track.id === trackId) ?? null;
    if (!canUsePianoRoll(targetTrack)) {
      return;
    }

    if (targetTrack && targetTrack.type === 'Drums') {
      updateTrackClips(trackId, (clips) =>
        clips.map((clip) => {
          if (clip.id !== clipId) {
            return clip;
          }
          return {
            ...clip,
            notes: clip.notes.map((note) => {
              if (note.pitch >= 0 && note.pitch < 4) {
                return note;
              }
              const normalized = 3 - (Math.abs(GRID_TOTAL_ROWS - 1 - note.pitch) % 4);
              return { ...note, pitch: normalized };
            }),
          };
        }),
        false
      );
    }

    setSelectedTrackId(trackId);
    setActivePianoTrackId(trackId);
    setActivePianoClipId(clipId);
    setPianoTool('select');
    setSelectedNoteIds([]);
    setSelectionBox(null);
    setIsPianoRollOpen(true);
  };

  const handleTrackDoubleClick = (trackId: number) => {
    const targetTrack = tracks.find((track) => track.id === trackId);
    if (!targetTrack || !canUsePianoRoll(targetTrack)) {
      return;
    }

    if (targetTrack.clips.length === 0) {
      const createdClip: Clip = {
        id: Date.now(),
        start: 0,
        length: CLIP_DEFAULT_LENGTH_BEATS,
        notes: [],
      };

      updateTrackClips(trackId, (clips) => [...clips, createdClip]);
      setSelectedTimelineClip({ trackId, clipId: createdClip.id });
      openPianoRollForClip(trackId, createdClip.id);
      return;
    }

    setSelectedTimelineClip({ trackId, clipId: targetTrack.clips[0].id });
    openPianoRollForClip(trackId, targetTrack.clips[0].id);
  };

  const handleTrackLaneDoubleClick = (event: ReactMouseEvent<HTMLDivElement>, trackId: number) => {
    setSelectedTrackId(trackId);
    setSelectedTimelineClip(null);
    if (event.button !== 0) {
      return;
    }

    const targetTrack = tracks.find((track) => track.id === trackId);
    if (!targetTrack || (targetTrack.type !== 'Instrument' && targetTrack.type !== 'Drums')) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.dataset.clip === '1' || target.closest('[data-clip="1"]')) {
      return;
    }

    const laneRect = event.currentTarget.getBoundingClientRect();
    const beatWidth = laneRect.width / TIMELINE_TOTAL_BEATS;
    const pointerX = event.clientX - laneRect.left;
    const rawBeat = clamp(Math.floor(pointerX / beatWidth), 0, TIMELINE_TOTAL_BEATS - 1);
    const snappedStart = clamp(
      Math.floor(rawBeat / CLIP_SNAP_BEATS) * CLIP_SNAP_BEATS,
      0,
      TIMELINE_TOTAL_BEATS - CLIP_SNAP_BEATS,
    );
    const clippedLength = Math.max(
      CLIP_SNAP_BEATS,
      Math.min(CLIP_DEFAULT_LENGTH_BEATS, TIMELINE_TOTAL_BEATS - snappedStart),
    );

    const createdClipId = Date.now() + snappedStart;
    updateTrackClips(trackId, (clips) => [
      ...clips,
      {
        id: createdClipId,
        start: snappedStart,
        length: clippedLength,
        notes: [],
      },
    ]);
    setSelectedTimelineClip({ trackId, clipId: createdClipId });
  };

  const handleClipMouseDown = (
    event: ReactMouseEvent<HTMLDivElement>,
    trackId: number,
    clip: Clip,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.dataset.clipResize === '1' || target.closest('[data-clip-resize="1"]')) {
      return;
    }

    event.stopPropagation();
    event.currentTarget.focus();
    const lane = event.currentTarget.closest('[data-track-lane="1"]') as HTMLDivElement | null;
    if (!lane) {
      return;
    }

    const laneRect = lane.getBoundingClientRect();
    recordHistory();
    setSelectedTrackId(trackId);
    setSelectedTimelineClip({ trackId, clipId: clip.id });
    setClipDragState({
      trackId,
      clipId: clip.id,
      startClientX: event.clientX,
      originStart: clip.start,
      beatWidth: laneRect.width / TIMELINE_TOTAL_BEATS,
    });
  };

  const handleClipDoubleClick = (
    event: ReactMouseEvent<HTMLDivElement>,
    trackId: number,
    clipId: number,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    const targetTrack = tracks.find((track) => track.id === trackId) ?? null;
    if (!canUsePianoRoll(targetTrack)) {
      return;
    }

    setSelectedTimelineClip({ trackId, clipId });
    openPianoRollForClip(trackId, clipId);
  };

  const handleClipResizeMouseDown = (
    event: ReactMouseEvent<HTMLSpanElement>,
    trackId: number,
    clip: Clip,
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    const lane = event.currentTarget.closest('[data-track-lane="1"]') as HTMLDivElement | null;
    if (!lane) {
      return;
    }

    const laneRect = lane.getBoundingClientRect();
    recordHistory();
    setSelectedTrackId(trackId);
    setSelectedTimelineClip({ trackId, clipId: clip.id });
    setClipResizeState({
      trackId,
      clipId: clip.id,
      startClientX: event.clientX,
      originLength: clip.length,
      beatWidth: laneRect.width / TIMELINE_TOTAL_BEATS,
    });
  };

  const handleGridMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !activeTrack || !activeClip || !gridRef.current) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.dataset.note === '1' || target.closest('[data-note="1"]')) {
      return;
    }

    if (pianoTool === 'select') {
      event.preventDefault();
      const pointer = getPointerInGrid(event.clientX, event.clientY, activeClipTotalCols);
      setSelectedNoteIds([]);
      setSelectionBox({
        startX: pointer.x,
        startY: pointer.y,
        currentX: pointer.x,
        currentY: pointer.y,
      });
      return;
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + gridRef.current.scrollLeft;
    const y = event.clientY - rect.top + gridRef.current.scrollTop - 24;
    const snappedStart = clamp(Math.floor(x / GRID_COL_WIDTH), 0, activeClipTotalCols - 1);
    const snappedPitch = clamp(Math.floor(y / GRID_ROW_HEIGHT), 0, pianoRows.length - 1);
    const createdId = Date.now() + activeTrackNotes.length;
    const createdLength = Math.min(2, activeClipTotalCols - snappedStart);

    updateActiveClipNotes((notes) => [
      ...notes,
      {
        id: createdId,
        start: snappedStart,
        pitch: snappedPitch,
        length: createdLength,
      },
    ]);
    setSelectedNoteIds([createdId]);
    void triggerTrackPreview(activeTrack, snappedPitch);
  };

  const handleGridDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pianoTool !== 'select' || !gridRef.current || !activeTrack || !activeClip) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.dataset.note === '1' || target.closest('[data-note="1"]')) {
      return;
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + gridRef.current.scrollLeft;
    const y = event.clientY - rect.top + gridRef.current.scrollTop - 24;
    const snappedStart = clamp(Math.floor(x / GRID_COL_WIDTH), 0, activeClipTotalCols - 1);
    const snappedPitch = clamp(Math.floor(y / GRID_ROW_HEIGHT), 0, pianoRows.length - 1);
    const createdId = Date.now() + activeTrackNotes.length;
    const createdLength = Math.min(2, activeClipTotalCols - snappedStart);

    updateActiveClipNotes((notes) => [
      ...notes,
      {
        id: createdId,
        start: snappedStart,
        pitch: snappedPitch,
        length: createdLength,
      },
    ]);
    setSelectedNoteIds([createdId]);
    setSelectionBox(null);
    void triggerTrackPreview(activeTrack, snappedPitch);
  };

  const handleNoteMouseDown = (
    event: ReactMouseEvent<HTMLElement>,
    note: Note,
    forcedMode?: 'move' | 'resize',
  ) => {
    if (event.button !== 0 || pianoTool !== 'select') {
      return;
    }

    const dragTargetIds = selectedNoteIds.includes(note.id) && selectedNoteIds.length > 0
      ? selectedNoteIds
      : [note.id];

    if (!selectedNoteIds.includes(note.id)) {
      setSelectedNoteIds([note.id]);
    }

    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xInside = event.clientX - rect.left;
    const mode: 'move' | 'resize' = forcedMode ?? (xInside > rect.width - 10 ? 'resize' : 'move');
    const origins = activeTrackNotes
      .filter((item) => dragTargetIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        start: item.start,
        pitch: item.pitch,
        length: item.length,
      }));

    recordHistory();
    setDragState({
      noteIds: dragTargetIds,
      origins,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  };

  const handleDeleteNote = (noteId: number) => {
    updateActiveClipNotes((notes) => notes.filter((item) => item.id !== noteId));
    if (selectedNoteIds.includes(noteId)) {
      setSelectedNoteIds((prev) => prev.filter((id) => id !== noteId));
    }
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaCols = Math.round((event.clientX - dragState.startClientX) / GRID_COL_WIDTH);
      const deltaRows = Math.round((event.clientY - dragState.startClientY) / GRID_ROW_HEIGHT);
      const maxCols = activeClipTotalCols;

      updateActiveClipNotes(
        (notes) => notes.map((note) => {
          if (!dragState.noteIds.includes(note.id)) {
            return note;
          }

          const origin = dragState.origins.find((item) => item.id === note.id);
          if (!origin) {
            return note;
          }

          if (dragState.mode === 'resize') {
            return {
              ...note,
              length: clamp(origin.length + deltaCols, 1, maxCols - origin.start),
            };
          }

          return {
            ...note,
            start: clamp(origin.start + deltaCols, 0, maxCols - origin.length),
            pitch: clamp(origin.pitch + deltaRows, 0, pianoRows.length - 1),
          };
        }),
        false,
      );
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, activePianoTrackId, activePianoClipId, activeClipTotalCols, pianoRows]);

  useEffect(() => {
    if (!clipDragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaBeats = Math.round((event.clientX - clipDragState.startClientX) / clipDragState.beatWidth);

      updateTrackClips(
        clipDragState.trackId,
        (clips) => clips.map((clip) => {
          if (clip.id !== clipDragState.clipId) {
            return clip;
          }

          const rawStart = clipDragState.originStart + deltaBeats;
          const snappedStart = Math.round(rawStart / CLIP_SNAP_BEATS) * CLIP_SNAP_BEATS;
          return {
            ...clip,
            start: clamp(snappedStart, 0, TIMELINE_TOTAL_BEATS - clip.length),
          };
        }),
        false,
      );
    };

    const handleMouseUp = () => {
      setClipDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clipDragState]);

  useEffect(() => {
    if (!clipResizeState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaBeats = Math.round((event.clientX - clipResizeState.startClientX) / clipResizeState.beatWidth);

      updateTrackClips(
        clipResizeState.trackId,
        (clips) => clips.map((clip) => {
          if (clip.id !== clipResizeState.clipId) {
            return clip;
          }

          const rawLength = clipResizeState.originLength + deltaBeats;
          const snappedLength = Math.max(
            CLIP_SNAP_BEATS,
            Math.round(rawLength / CLIP_SNAP_BEATS) * CLIP_SNAP_BEATS,
          );
          const nextLength = clamp(snappedLength, CLIP_SNAP_BEATS, TIMELINE_TOTAL_BEATS - clip.start);

          return {
            ...clip,
            length: nextLength,
            notes: normalizeNotesToClipRange(clip.notes, nextLength),
          };
        }),
        false,
      );
    };

    const handleMouseUp = () => {
      setClipResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clipResizeState]);

  useEffect(() => {
    if (!selectionBox) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const pointer = getPointerInGrid(event.clientX, event.clientY, activeClipTotalCols);
      setSelectionBox((prev) =>
        prev
          ? {
              ...prev,
              currentX: pointer.x,
              currentY: pointer.y,
            }
          : prev,
      );
    };

    const handleMouseUp = () => {
      setSelectionBox((current) => {
        if (!current) {
          return null;
        }

        const minX = Math.min(current.startX, current.currentX);
        const maxX = Math.max(current.startX, current.currentX);
        const minY = Math.min(current.startY, current.currentY);
        const maxY = Math.max(current.startY, current.currentY);

        const selectedIds = activeTrackNotes
          .filter((note) => {
            const noteLeft = note.start * GRID_COL_WIDTH;
            const noteRight = noteLeft + note.length * GRID_COL_WIDTH;
            const noteTop = note.pitch * GRID_ROW_HEIGHT;
            const noteBottom = noteTop + GRID_ROW_HEIGHT;

            return noteRight >= minX && noteLeft <= maxX && noteBottom >= minY && noteTop <= maxY;
          })
          .map((note) => note.id);

        setSelectedNoteIds(selectedIds);
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectionBox, activeTrackNotes, activeClipTotalCols]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="bg-[#0e0e0e] flex justify-between items-center w-full px-4 h-12 z-50">
        <div className="flex items-center gap-6">
          <div className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-tighter text-[#f4ffc6] uppercase">Bach Studio</span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase">{projectName}</span>
          </div>
        </div>

        <div className="flex items-center bg-surface-container-low px-4 py-1 gap-8 ghost-border">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSaveProject}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Save project (Ctrl+S)"
            >
              <span className="material-symbols-outlined">save</span>
            </button>
            <button
              onClick={handleLoadProject}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Load project"
            >
              <span className="material-symbols-outlined">folder_open</span>
            </button>
            <button
              onClick={handleUndo}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <span className="material-symbols-outlined">undo</span>
            </button>
            <button
              onClick={handleRedo}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <span className="material-symbols-outlined">redo</span>
            </button>
            <div className="w-px h-6 bg-outline/20" />
            <button
              onClick={handleReturnToStart}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Return to start"
            >
              <span className="material-symbols-outlined">skip_previous</span>
            </button>
            <button
              onClick={handlePlayToggle}
              className="text-primary active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <button
              onClick={stopPlayback}
              className="text-on-surface-variant hover:text-primary transition-colors"
              title="Stop"
            >
              <span className="material-symbols-outlined">stop</span>
            </button>
            <button
              onClick={handleLoopToggle}
              className={`transition-colors ${isLoopPlaybackOn ? 'text-[#66d0ff]' : 'text-on-surface-variant hover:text-[#66d0ff]'}`}
              title="Loop Playback"
            >
              <span className="material-symbols-outlined">repeat</span>
            </button>
            <button
              onClick={() => setIsMetronomeOn((prev) => !prev)}
              className={`transition-colors active:scale-95 ${isMetronomeOn ? 'text-[#ff9ba4]' : 'text-on-surface-variant hover:text-[#ff9ba4]'}`}
              title="Metronome"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: isMetronomeOn ? "'FILL' 1" : undefined }}>
                av_timer
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isVoiceRecording) {
                  stopVoiceRecording();
                } else {
                  void startVoiceRecording();
                }
              }}
              className={`transition-colors active:scale-95 ${
                isVoiceRecording
                  ? 'text-error'
                  : selectedTrack?.type === 'Audio'
                    ? 'text-error/80 hover:text-error'
                    : 'text-zinc-700'
              }`}
              title={isVoiceRecording ? 'Stop voice recording' : 'Record selected voice track'}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isVoiceRecording ? 'stop_circle' : 'fiber_manual_record'}
              </span>
            </button>
          </div>
          <div className="flex gap-6 font-mono text-[13px] text-primary">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">BPM</span>
              <div className="flex items-center gap-1">
                <button onClick={() => nudgeBpm(-1)} className="text-zinc-500 hover:text-primary text-[11px]">-</button>
                <input
                  type="number"
                  min={40}
                  max={240}
                  step={1}
                  value={Number.isFinite(bpm) ? bpm : 128}
                  onFocus={recordHistory}
                  onChange={(event) => handleBpmChange(event.target.value)}
                  className="w-16 text-center bg-transparent border border-outline-variant/20 text-primary text-[12px] leading-none py-[1px]"
                />
                <button onClick={() => nudgeBpm(1)} className="text-zinc-500 hover:text-primary text-[11px]">+</button>
              </div>
            </div>
            <div className="flex flex-col items-center border-x border-outline-variant/20 px-6">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">Position</span>
              <span className="text-lg leading-none playhead-timecode">{formatTimecode(playheadBeat)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <HeaderUtilityButtons buttonClassName="h-8 w-8 flex items-center justify-center hover:bg-[#2c2c2c] transition-colors text-zinc-500 hover:text-primary" />
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="bg-primary text-on-primary px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-widest active:bg-white transition-all flex items-center gap-2"
            >
              Export
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 top-8 z-[90] w-36 bg-[#111] border border-primary/30 shadow-[0_12px_30px_rgba(0,0,0,0.45)] py-1">
                {(['wav', 'mp3'] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    onClick={() => {
                      void handleExportProject(format);
                    }}
                    className="w-full px-3 py-2 text-left text-[10px] font-mono uppercase tracking-widest text-zinc-200 hover:bg-primary hover:text-on-primary"
                  >
                    {format.toUpperCase()} (.{format})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="h-16 bg-[#101010] border-y border-outline-variant/20 px-4 flex items-center overflow-x-auto no-scrollbar">
        {selectedTrack ? (
          <div className="w-full min-w-max flex items-center gap-3">
            <div className="h-11 px-3 rounded-sm bg-[#171717] border border-[#2d2d2d] flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">
                {selectedTrack.icon}
              </span>
              <div className="flex flex-col justify-center leading-none">
                <input
                  type="text"
                  value={selectedTrack.name}
                  onFocus={recordHistory}
                  onChange={(event) => handleSelectedTrackNameChange(event.target.value)}
                  onBlur={handleSelectedTrackNameBlur}
                  className="w-48 h-[18px] bg-transparent text-[11px] font-bold uppercase tracking-wide text-primary whitespace-nowrap outline-none border-b border-transparent focus:border-primary/60"
                  title="Edit track name"
                />
                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider whitespace-nowrap mt-[1px]">
                  {selectedTrack.type === 'Audio' ? 'Voice Recording Track' : selectedTrack.type === 'Drums' ? 'Drums Sequencer Track' : 'Piano Instrument Track'}
                </span>
              </div>
            </div>

            {selectedTrack.type === 'Instrument' && (
              <>
                <label className="editor-control-card w-[240px]">
                  <span className="editor-control-label">Instrument</span>
                  <select
                    value={selectedTrack.instrumentPresetId}
                    onChange={(event) => handleSelectedTrackInstrumentChange(event.target.value as Track['instrumentPresetId'])}
                    className="editor-control-select"
                  >
                    {INSTRUMENT_PRESET_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={handleExportSelectedTrackMidi}
                  className="h-11 px-4 bg-[#181818] hover:bg-[#202020] text-[#66d0ff] text-[11px] font-bold uppercase tracking-widest border border-[#66d0ff]/30 transition-colors flex items-center gap-2"
                  title="Export selected track as MIDI"
                >
                  <span className="material-symbols-outlined text-[17px]">download</span>
                  MIDI
                </button>
              </>
            )}

            {selectedTrack.type === 'Drums' && (
              <>
                <label className="editor-control-card w-[240px]">
                  <span className="editor-control-label">Drum Kit</span>
                  <select
                    value={selectedTrack.drumKitId}
                    onChange={(event) => handleSelectedTrackDrumKitChange(event.target.value as Track['drumKitId'])}
                    className="editor-control-select"
                  >
                    {DRUM_KIT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {selectedTrack.type !== 'Bus' && (
              <>
                <label className="editor-control-card w-[360px]">
                  <span className="editor-control-label">Volume</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => nudgeSelectedTrackVolume(-1)}
                      className="editor-step-button"
                      title="Lower volume"
                    >
                      <span className="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <input
                      type="range"
                      min={-24}
                      max={12}
                      step={1}
                      value={selectedTrack.volumeDb}
                      onPointerDown={recordHistory}
                      onChange={(event) => handleSelectedTrackVolumeChange(event.target.value)}
                      className="editor-fader"
                      style={{
                        background: `linear-gradient(90deg, #f4ffc6 ${toGainFillPercent(selectedTrack.volumeDb)}%, #2a2a2a ${toGainFillPercent(selectedTrack.volumeDb)}%)`,
                      }}
                    />
                    <button
                      onClick={() => nudgeSelectedTrackVolume(1)}
                      className="editor-step-button"
                      title="Raise volume"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                    </button>
                    <span className="editor-value-badge">{selectedTrack.volumeDb.toFixed(0)}dB</span>
                  </div>
                </label>
                {([
                  ['Reverb', 'reverbWet', selectedTrack.reverbWet ?? 0],
                  ['Delay', 'delayWet', selectedTrack.delayWet ?? 0],
                  ['Drive', 'distortion', selectedTrack.distortion ?? 0],
                ] as const).map(([label, effect, value]) => (
                  <label key={effect} className="editor-control-card w-[150px]">
                    <span className="editor-control-label">{label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={value}
                        onPointerDown={recordHistory}
                        onChange={(event) => handleSelectedTrackEffectChange(effect, event.target.value)}
                        className="w-24 accent-[#f4ffc6]"
                      />
                      <span className="text-[9px] font-mono text-primary">{Math.round(value * 100)}</span>
                    </div>
                  </label>
                ))}
              </>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Add or select a piano track to edit sound and notes</span>
        )}
      </section>

      {!isPianoRollOpen && (
        <main className="flex flex-1 overflow-hidden bg-[#131313]">
          <TimelinePanel
            tracks={tracks}
            selectedTrackId={selectedTrackId}
            selectedTimelineClip={selectedTimelineClip}
            selectedTrackName={selectedTrack?.name ?? null}
            playheadBeat={playheadBeat}
            masterVolumeDb={masterVolumeDb}
            isLoopPlaybackOn={isLoopPlaybackOn}
            loopRange={loopRange}
            onLoopEditStart={recordHistory}
            onLoopRangeChange={handleLoopRangeUpdate}
            onSeekBeat={handleSeekBeat}
            onMasterEditStart={recordHistory}
            onMasterVolumeChange={handleMasterVolumeChange}
            onAddTrack={handleAddTrack}
            onTrackClick={handleTrackClick}
            onTrackDoubleClick={handleTrackDoubleClick}
            onToggleTrackMute={handleToggleTrackMute}
            onToggleTrackSolo={handleToggleTrackSolo}
            onTrackLaneDoubleClick={handleTrackLaneDoubleClick}
            onAudioFileDrop={handleAudioFileDrop}
            onClipMouseDown={handleClipMouseDown}
            onClipDoubleClick={handleClipDoubleClick}
            onClipResizeMouseDown={handleClipResizeMouseDown}
            onDeleteClip={handleDeleteTimelineClip}
            onDeleteTrack={handleDeleteTrack}
            onSplitClip={handleSplitClip}
            onMergeClipWithNext={handleMergeClipWithNext}
          />
        </main>
      )}

      <PianoRollOverlay
        isOpen={isPianoRollOpen}
        activeTrackName={activeTrackName}
        bpm={bpm}
        bpmLabel={bpmLabel}
        playheadBeat={playheadBeat}
        isPlaying={isPlaying}
        clipLengthBeats={activeClip?.length ?? CLIP_DEFAULT_LENGTH_BEATS}
        maxRecordingBeats={MAX_REALTIME_HUMMING_BEATS}
        pianoTool={pianoTool}
        pianoRows={pianoRows}
        activeTrackNotes={activeTrackNotes}
        gridTotalCols={activeClipTotalCols}
        selectedNoteIds={selectedNoteIds}
        selectionBox={selectionBox}
        gridRef={gridRef}
        pianoKeysRef={pianoKeysRef}
        onClose={() => setIsPianoRollOpen(false)}
        onSetPianoTool={setPianoTool}
        onPreviewPitch={(pitch, durationSeconds) => {
          if (!activeTrack) {
            return;
          }

          void triggerTrackPreview(activeTrack, pitch, durationSeconds);
        }}
        onGridMouseDown={handleGridMouseDown}
        onGridDoubleClick={handleGridDoubleClick}
        onSyncVerticalScroll={syncVerticalScroll}
        onNoteMouseDown={handleNoteMouseDown}
        onDeleteNote={handleDeleteNote}
        onPrepareRealtimeHumming={handleStartRealtimeHumming}
        onRealtimeHummingCountInBeat={handleRealtimeHummingCountInBeat}
        onStartRealtimeHummingPlayback={handleStartRealtimeHummingPlayback}
        onRealtimeHummingProgress={handleRealtimeHummingProgress}
        onRealtimeHummingEvent={handleRealtimeHummingEvent}
        onStopPlayback={stopPlayback}
      />

      {saveNotification.visible && (
        <div className="fixed bottom-4 right-4 bg-primary text-on-primary px-4 py-2 rounded font-mono text-sm font-bold uppercase tracking-wide z-50 shadow-lg" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {saveNotification.message}
        </div>
      )}
    </div>
  );
}
