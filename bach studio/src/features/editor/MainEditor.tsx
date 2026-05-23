import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import lamejs from 'lamejs';
import * as Tone from 'tone';
import {
  loadProject,
  loadProjectFromBackend,
  saveProject,
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
  effectiveVolumeDb: number;
};

type CopiedMidiChunk = {
  clips: Clip[];
};

type SelectedTimelineClip = {
  trackId: number;
  clipId: number;
};

type ExportFormat = 'wav' | 'mp3';
const MAX_REALTIME_HUMMING_BEATS = TIMELINE_TOTAL_BEATS;

export function MainEditor() {
  const [searchParams] = useSearchParams();
  const [isPianoRollOpen, setIsPianoRollOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [activePianoTrackId, setActivePianoTrackId] = useState<number | null>(null);
  const [activePianoClipId, setActivePianoClipId] = useState<number | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [pianoTool, setPianoTool] = useState<PianoTool>('select');
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
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
  const [saveNotification, setSaveNotification] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [loopRange, setLoopRange] = useState<{ startBeat: number; endBeat: number }>({
    startBeat: 0,
    endBeat: TIMELINE_BEATS_PER_BAR * 4,
  });
  const [isModified, setIsModified] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const originalTracksRef = useRef<Track[]>([]);
  const originalBpmRef = useRef<number>(128);
  const navigate = useNavigate();
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const analogSynthRef = useRef<Tone.PolySynth | null>(null);
  const organSynthRef = useRef<Tone.PolySynth | null>(null);
  const bassSynthRef = useRef<Tone.MonoSynth | null>(null);
  const kickSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const snareSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const hatSynthRef = useRef<Tone.MetalSynth | null>(null);
  const clapSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const audioPlayersRef = useRef<Partial<Record<AudioSourceId, Tone.Player>>>({});
  const playbackTimerRef = useRef<number | null>(null);
  const liveHummingNoteIdRef = useRef<number | null>(null);
  const liveHummingNoteIdsRef = useRef<number[]>([]);
  const playbackSessionRef = useRef<null | {
    startWallTime: number;
    startBeat: number;
    nextEventIndex: number;
    bpm: number;
    events: PlaybackNoteEvent[];
  }>(null);

  const projectName = searchParams.get('projectName') ?? 'SESSION_2023_X4';
  const bpmRaw = Number.parseFloat(searchParams.get('bpm') ?? '128');
  const initialBpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? bpmRaw : 128;
  const [bpm, setBpm] = useState(initialBpm);
  const bpmLabel = bpm.toFixed(2);

  const pianoRows = Array.from({ length: GRID_TOTAL_ROWS }, (_, row) => {
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
  const canUsePianoRoll = (track: Track | null) => track !== null && track.type === 'Instrument';

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

  const ensurePianoSampler = async () => {
    await ensureToneReady();

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
      await Tone.loaded();
    }

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

  const ensureDrumSynths = async () => {
    await ensureToneReady();

    if (!kickSynthRef.current) {
      kickSynthRef.current = new Tone.MembraneSynth({
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

  const ensurePlaybackEngines = async () => {
    await ensureToneReady();

    const instrumentPresets = new Set(tracks.filter((track) => track.type === 'Instrument').map((track) => track.instrumentPresetId));
    const hasDrumTrack = tracks.some((track) => track.type === 'Drums');
    const audioSources = new Set(tracks.filter((track) => track.type === 'Audio').map((track) => track.audioSourceId));

    if (instrumentPresets.has('piano')) {
      await ensurePianoSampler();
    }
    if (instrumentPresets.has('analog')) {
      await ensureAnalogSynth();
    }
    if (instrumentPresets.has('organ')) {
      await ensureOrganSynth();
    }
    if (instrumentPresets.has('bass')) {
      await ensureBassSynth();
    }
    if (hasDrumTrack) {
      await ensureDrumSynths();
    }

    await Promise.all(
      Array.from(audioSources).map(async (sourceId) => {
        try {
          await ensureAudioPlayer(sourceId);
        } catch {
          // Keep playback alive even if a remote one-shot failed to load.
        }
      }),
    );
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

    snareSynthRef.current.set({ noise: { type: 'white' }, envelope: { decay: 0.18 } });
    hatSynthRef.current.set({ harmonicity: 5.1, modulationIndex: 32, resonance: 4200 });
    clapSynthRef.current.set({ noise: { type: 'pink' }, envelope: { decay: 0.12 } });
  };

  const triggerInstrumentNote = (
    presetId: Track['instrumentPresetId'],
    pitch: number,
    durationSeconds: number,
    velocity: number,
  ) => {
    const noteName = pitchToNoteName(pitch);
    const duration = Math.max(0.05, durationSeconds);

    if (presetId === 'piano' && samplerRef.current) {
      samplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'analog' && analogSynthRef.current) {
      analogSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'organ' && organSynthRef.current) {
      organSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      return;
    }

    if (presetId === 'bass' && bassSynthRef.current) {
      bassSynthRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
    }
  };

  const resolveDrumLane = (pitch: number) => {
    const laneOrder = ['kick', 'snare', 'hat', 'clap'] as const;
    const laneIndex = Math.abs(GRID_TOTAL_ROWS - 1 - pitch) % laneOrder.length;
    return laneOrder[laneIndex];
  };

  const triggerDrumNote = (
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
      const kickNote = kitId === 'trap808' ? 'C1' : kitId === 'acoustic' ? 'D1' : 'E1';
      kickSynthRef.current.triggerAttackRelease(kickNote, Math.max(0.08, durationSeconds), undefined, velocity);
      return;
    }

    if (lane === 'snare') {
      snareSynthRef.current.triggerAttackRelease('16n', undefined, velocity);
      return;
    }

    if (lane === 'hat') {
      hatSynthRef.current.triggerAttackRelease('32n', Tone.now(), velocity);
      return;
    }

    clapSynthRef.current.triggerAttackRelease('16n', undefined, velocity * 0.9);
  };

  const triggerAudioClip = (
    sourceId: AudioSourceId,
    durationSeconds: number,
    compensatedVolumeDb: number,
  ) => {
    const player = audioPlayersRef.current[sourceId];
    if (!player || !player.loaded) {
      return;
    }

    player.volume.value = compensatedVolumeDb;
    player.start(undefined, 0, Math.max(0.1, durationSeconds));
  };

  const triggerPlaybackEvent = (event: PlaybackNoteEvent) => {
    const compensatedDb = event.effectiveVolumeDb + getEventOutputCompDb(event);
    const velocity = dbToVelocity(compensatedDb);

    if (event.trackType === 'Instrument' && event.pitch !== null) {
      triggerInstrumentNote(event.instrumentPresetId, event.pitch, event.durationSeconds, velocity);
      return;
    }

    if (event.trackType === 'Drums' && event.pitch !== null) {
      triggerDrumNote(event.drumKitId, event.pitch, event.durationSeconds, velocity);
      return;
    }

    if (event.trackType === 'Audio') {
      triggerAudioClip(event.audioSourceId, event.durationSeconds, compensatedDb);
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
    setPlayheadBeat(currentBeat);

    while (session.nextEventIndex < session.events.length && session.events[session.nextEventIndex].startBeat <= currentBeat + 0.0001) {
      const event = session.events[session.nextEventIndex];
      triggerPlaybackEvent(event);
      session.nextEventIndex += 1;
    }

    if (isLoopPlaybackOn && currentBeat >= playbackEndBeat) {
      const nextEventIndex = session.events.findIndex((event) => event.startBeat >= loopStartBeat - 0.0001);
      playbackSessionRef.current = {
        ...session,
        startWallTime: performance.now(),
        startBeat: loopStartBeat,
        nextEventIndex: nextEventIndex === -1 ? session.events.length : nextEventIndex,
      };
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
    playbackTimerRef.current = window.setInterval(runPlaybackFrame, 16);
    runPlaybackFrame();
  };

  const pausePlayback = () => {
    const currentBeat = getCurrentSessionBeat();
    setPlayheadBeat(currentBeat);
    setIsPlaying(false);
    playbackSessionRef.current = null;
    cancelPlaybackTimer();
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setPlayheadBeat(0);
    playbackSessionRef.current = null;
    cancelPlaybackTimer();
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
    handleBpmChange(String(clamp(bpm + delta, 40, 240)));
  };

  const handleLoopToggle = () => {
    setIsLoopPlaybackOn((prev) => !prev);
  };

  const handleLoopRangeUpdate = (nextRange: { startBeat: number; endBeat: number }) => {
    const loopSnapBeats = Math.max(CLIP_SNAP_BEATS, 1 / PIANO_STEPS_PER_BEAT);
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

  const handleDeleteSelectedMidiClip = () => {
    if (!selectedTimelineClip) {
      return;
    }

    const targetTrack = tracks.find((track) => track.id === selectedTimelineClip.trackId) ?? null;
    if (!targetTrack || !canUsePianoRoll(targetTrack)) {
      return;
    }

    const targetClip = targetTrack.clips.find((clip) => clip.id === selectedTimelineClip.clipId);
    if (!targetClip) {
      setSelectedTimelineClip(null);
      return;
    }

    const remainingClips = targetTrack.clips.filter((clip) => clip.id !== selectedTimelineClip.clipId);
    updateTrackClips(selectedTimelineClip.trackId, (clips) =>
      clips.filter((clip) => clip.id !== selectedTimelineClip.clipId),
    );

    if (activePianoTrackId === selectedTimelineClip.trackId && activePianoClipId === selectedTimelineClip.clipId) {
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

  const handleSaveProject = async () => {
    const localSuccess = saveProject(projectName, tracks, bpm);
    const backendSuccess = await saveProjectToBackend(projectName, tracks, bpm);

    if (localSuccess || backendSuccess) {
      originalTracksRef.current = JSON.parse(JSON.stringify(tracks));
      originalBpmRef.current = bpm;
      setIsModified(false);
      setSaveNotification({
        message: backendSuccess ? `Saved: ${projectName}` : `Saved locally: ${projectName}`,
        visible: true,
      });
    } else {
      setSaveNotification({ message: 'Save failed', visible: true });
    }

    setTimeout(() => {
      setSaveNotification({ message: '', visible: false });
    }, 2000);
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

      await Tone.loaded();

      events.forEach((event) => {
        if (event.pitch === null) {
          return;
        }

        const noteName = pitchToNoteName(event.pitch);
        const startTime = event.startBeat * beatSeconds;
        const duration = Math.max(0.05, event.durationSeconds);
        const compensatedDb = event.effectiveVolumeDb + getEventOutputCompDb(event);
        const velocity = dbToVelocity(compensatedDb);

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

        bassSynth.triggerAttackRelease(noteName, duration, startTime, velocity);
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

  const audioBufferToMp3Blob = (buffer: AudioBuffer) => {
    const left = channelToInt16(buffer.getChannelData(0));
    const right = channelToInt16(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
    const encoder = new lamejs.Mp3Encoder(2, buffer.sampleRate, 192);
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
    const events = buildPlaybackEvents().filter((event) => event.trackType === 'Instrument' && event.pitch !== null);
    const safeProjectName = projectName.trim().replace(/[\\/:*?"<>|]/g, '_') || 'bach-studio-project';

    if (events.length === 0) {
      showSaveNotification('No piano notes to export');
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

  const handleLoadProject = () => {
    if (isModified) {
      const shouldSave = window.confirm(
        '저장하지 않은 변경사항이 있습니다.\n저장하시겠습니까?'
      );
      if (shouldSave) {
        void handleSaveProject();
      }
    }
    navigate('/projects');
  };

  useEffect(() => {
    let isCancelled = false;

    const applyProject = (loadedProject: { tracks: Track[]; bpm: number }) => {
      if (isCancelled) {
        return;
      }

      setTracks(loadedProject.tracks);
      setBpm(loadedProject.bpm);
      originalTracksRef.current = JSON.parse(JSON.stringify(loadedProject.tracks));
      originalBpmRef.current = loadedProject.bpm;
      setIsModified(false);
    };

    const loadedProject = loadProject(projectName);
    if (loadedProject) {
      applyProject(loadedProject);
      return () => {
        isCancelled = true;
      };
    }

    if (!projectName.startsWith('SESSION_')) {
      void loadProjectFromBackend(projectName).then((backendProject) => {
        if (backendProject) {
          applyProject(backendProject);
        }
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [projectName]);

  // 변경 감지: tracks나 bpm이 원본과 다르면 isModified = true
  useEffect(() => {
    const hasChanges =
      JSON.stringify(tracks) !== JSON.stringify(originalTracksRef.current) ||
      bpm !== originalBpmRef.current;
    setIsModified(hasChanges);
  }, [tracks, bpm]);

  // 페이지 떠나기 전에 경고 (뒤로가기, 새 페이지로 이동)
  useEffect(() => {
    if (!isModified) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handlePopState = () => {
      if (
        window.confirm(
          '저장하지 않은 변경사항이 있습니다.\n저장하시겠습니까?'
        )
      ) {
        void handleSaveProject();
      } else {
        // 사용자가 "아니오"를 선택해도 이미 navigate가 일어났으므로,
        // 돌아가도록 forward를 누르거나 그냥 진행
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isModified, tracks, bpm]);

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
        } else {
          await ensureBassSynth();
        }

        triggerInstrumentNote(track.instrumentPresetId, pitch, durationSeconds, velocity);
        return;
      }

      if (track.type === 'Drums') {
        await ensureDrumSynths();
        triggerDrumNote(track.drumKitId, pitch, durationSeconds, velocity);
        return;
      }

      if (track.type === 'Audio') {
        const player = await ensureAudioPlayer(track.audioSourceId);
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
      samplerRef.current = null;
      analogSynthRef.current = null;
      organSynthRef.current = null;
      bassSynthRef.current = null;
      kickSynthRef.current = null;
      snareSynthRef.current = null;
      hatSynthRef.current = null;
      clapSynthRef.current = null;
      audioPlayersRef.current = {};
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
      const isDelete = event.key === 'Delete' || event.key === 'Backspace';

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

      if (isDelete && selectedTimelineClip) {
        event.preventDefault();
        handleDeleteSelectedMidiClip();
        return;
      }

      if (isCopy && selectedTrack && canUsePianoRoll(selectedTrack)) {
        event.preventDefault();
        handleCopySelectedMidiTrack();
        return;
      }

      if (isPaste && copiedMidiChunk && selectedTrack && canUsePianoRoll(selectedTrack)) {
        event.preventDefault();
        handlePasteMidiTrack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    selectedTrack,
    copiedMidiChunk,
    selectedTimelineClip,
    tracks,
    projectName,
    bpm,
    handleCopySelectedMidiTrack,
    handlePasteMidiTrack,
    handleDeleteSelectedMidiClip,
    handleSaveProject,
    handlePlayToggle,
  ]);

  const updateActiveClipNotes = (updater: (notes: Note[]) => Note[]) => {
    if (activePianoTrackId === null || activePianoClipId === null) {
      return;
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

  const updateTrackClips = (trackId: number, updater: (clips: Clip[]) => Clip[]) => {
    setTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, clips: updater(track.clips) } : track)),
    );
  };

  const updateTrackById = (trackId: number, updater: (track: Track) => Track) => {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? updater(track) : track)));
  };

  const getPointerInGrid = (clientX: number, clientY: number, totalCols: number) => {
    if (!gridRef.current) {
      return { x: 0, y: 0 };
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left + gridRef.current.scrollLeft;
    const y = clientY - rect.top + gridRef.current.scrollTop;

    return {
      x: clamp(Math.floor(x), 0, totalCols * GRID_COL_WIDTH),
      y: clamp(Math.floor(y), 0, GRID_TOTAL_ROWS * GRID_ROW_HEIGHT),
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

  const extendActiveClipForRealtimeBeat = (targetBeat: number) => {
    if (!activeTrack || !activeClip) {
      return CLIP_DEFAULT_LENGTH_BEATS;
    }

    const snappedLength = Math.ceil(Math.max(targetBeat, activeClip.length, CLIP_SNAP_BEATS) / CLIP_SNAP_BEATS) * CLIP_SNAP_BEATS;
    const nextLength = clamp(snappedLength, activeClip.length, MAX_REALTIME_HUMMING_BEATS);

    if (nextLength > activeClip.length) {
      updateTrackClips(activeTrack.id, (clips) =>
        clips.map((clip) => (clip.id === activeClip.id ? { ...clip, length: Math.max(clip.length, nextLength) } : clip)),
      );
    }

    return nextLength;
  };

  const handleStartRealtimeHumming = () => {
    if (!activeTrack || !activeClip) {
      showSaveNotification('Open a piano roll clip before recording');
      return false;
    }

    liveHummingNoteIdRef.current = null;
    liveHummingNoteIdsRef.current = [];
    setSelectedNoteIds([]);
    return true;
  };

  const handleRealtimeHummingEvent = (event: HummingStreamEvent) => {
    if (!activeTrack || !activeClip) {
      return;
    }

    if (event.type === 'complete') {
      const latestClipLength = extendActiveClipForRealtimeBeat(
        Math.max(CLIP_SNAP_BEATS, ...event.notes.map((note) => note.startBeat + note.durationBeats + CLIP_SNAP_BEATS)),
      );
      const liveIds = new Set(liveHummingNoteIdsRef.current);
      const nextIds = event.notes.map((note, index) => Date.now() + Math.round(note.startBeat * 1000) + note.midi + index);
      const finalNotes = event.notes.map((note, index) => ({
        id: nextIds[index],
        ...convertHummingNoteToPianoRollNote(note, latestClipLength),
      }));

      updateActiveClipNotes((notes) => [
        ...notes.filter((note) => !liveIds.has(note.id)),
        ...finalNotes,
      ]);
      liveHummingNoteIdRef.current = null;
      liveHummingNoteIdsRef.current = [];
      setSelectedNoteIds(nextIds);
      return;
    }

    if (event.type !== 'note_on' && event.type !== 'note_update' && event.type !== 'note_off') {
      if (event.type === 'pitch') {
        extendActiveClipForRealtimeBeat(event.beat + CLIP_SNAP_BEATS);
      }
      return;
    }

    const noteEndBeat = event.note.startBeat + event.note.durationBeats + CLIP_SNAP_BEATS;
    const realtimeClipLength = extendActiveClipForRealtimeBeat(noteEndBeat);
    const convertedNote = convertHummingNoteToPianoRollNote(event.note, realtimeClipLength);

    if (event.type === 'note_on' || liveHummingNoteIdRef.current === null) {
      const noteId = Date.now() + Math.round(event.note.startBeat * 1000) + event.note.midi;
      liveHummingNoteIdRef.current = noteId;
      liveHummingNoteIdsRef.current = [...liveHummingNoteIdsRef.current, noteId];
      updateActiveClipNotes((notes) => [...notes, { id: noteId, ...convertedNote }]);
      setSelectedNoteIds([noteId]);
      return;
    }

    const noteId = liveHummingNoteIdRef.current;
    updateActiveClipNotes((notes) =>
      notes.map((note) => (note.id === noteId ? { ...note, ...convertedNote } : note)),
    );
    setSelectedNoteIds([noteId]);

    if (event.type === 'note_off') {
      liveHummingNoteIdRef.current = null;
    }
  };

  const handleAddTrack = () => {
    const nextIndex = tracks.length + 1;
    const createdTrack: Track = {
      id: Date.now() + nextIndex,
      type: 'Instrument',
      name: `${String(nextIndex).padStart(2, '0')} PIANO TRACK`,
      icon: 'piano',
      clipClass: CLIP_CLASS_BY_TYPE.Instrument,
      clips: [],
      muted: false,
      soloed: false,
      ...DEFAULT_TRACK_SETTINGS,
      outputBusId: null,
    };

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

  const handleSelectedTrackNameChange = (name: string) => {
    if (!selectedTrack) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, name }));
  };

  const handleSelectedTrackNameBlur = () => {
    if (!selectedTrack || selectedTrack.name.trim()) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, name: `${String(track.id).slice(-2)} PIANO TRACK` }));
  };

  const handleToggleTrackMute = (trackId: number) => {
    updateTrackById(trackId, (track) => ({ ...track, muted: track.muted !== true }));
  };

  const handleToggleTrackSolo = (trackId: number) => {
    updateTrackById(trackId, (track) => ({ ...track, soloed: track.soloed !== true }));
  };

  const handleSelectedTrackVolumeChange = (rawValue: string) => {
    if (!selectedTrack || selectedTrack.type === 'Bus') {
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, volumeDb: clamp(parsed, -24, 12) }));
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

  const handlePreviewSelectedTrack = () => {
    if (!selectedTrack) {
      return;
    }

    if (selectedTrack.type === 'Bus') {
      return;
    }

    void triggerTrackPreview(selectedTrack, Math.floor(GRID_TOTAL_ROWS * 0.58), 0.35);
  };

  const openPianoRollForClip = (trackId: number, clipId: number) => {
    const targetTrack = tracks.find((track) => track.id === trackId) ?? null;
    if (!canUsePianoRoll(targetTrack)) {
      return;
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
    if (!targetTrack || targetTrack.type === 'Bus') {
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
    const lane = event.currentTarget.closest('[data-track-lane="1"]') as HTMLDivElement | null;
    if (!lane) {
      return;
    }

    const laneRect = lane.getBoundingClientRect();
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
    const y = event.clientY - rect.top + gridRef.current.scrollTop;
    const snappedStart = clamp(Math.floor(x / GRID_COL_WIDTH), 0, activeClipTotalCols - 1);
    const snappedPitch = clamp(Math.floor(y / GRID_ROW_HEIGHT), 0, GRID_TOTAL_ROWS - 1);
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
    const y = event.clientY - rect.top + gridRef.current.scrollTop;
    const snappedStart = clamp(Math.floor(x / GRID_COL_WIDTH), 0, activeClipTotalCols - 1);
    const snappedPitch = clamp(Math.floor(y / GRID_ROW_HEIGHT), 0, GRID_TOTAL_ROWS - 1);
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

      updateActiveClipNotes((notes) =>
        notes.map((note) => {
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
            pitch: clamp(origin.pitch + deltaRows, 0, GRID_TOTAL_ROWS - 1),
          };
        }),
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
  }, [dragState, activePianoTrackId, activePianoClipId, activeClipTotalCols]);

  useEffect(() => {
    if (!clipDragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaBeats = Math.round((event.clientX - clipDragState.startClientX) / clipDragState.beatWidth);

      updateTrackClips(clipDragState.trackId, (clips) =>
        clips.map((clip) => {
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

      updateTrackClips(clipResizeState.trackId, (clips) =>
        clips.map((clip) => {
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
            <button className="text-error active:scale-95"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span></button>
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
                  onChange={(event) => handleBpmChange(event.target.value)}
                  className="w-16 text-center bg-transparent border border-outline-variant/20 text-primary text-[12px] leading-none py-[1px]"
                />
                <button onClick={() => nudgeBpm(1)} className="text-zinc-500 hover:text-primary text-[11px]">+</button>
              </div>
            </div>
            <div className="flex flex-col items-center border-x border-outline-variant/20 px-6">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">Position</span>
              <span className="text-lg leading-none">{formatTimecode(playheadBeat)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">CPU</span>
              <span className="text-on-surface-variant">14%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="hover:bg-[#2c2c2c] transition-colors p-1 text-zinc-500"><span className="material-symbols-outlined">help</span></button>
          <button className="hover:bg-[#2c2c2c] transition-colors p-1 text-zinc-500"><span className="material-symbols-outlined">settings</span></button>
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

      <section className="h-16 bg-[#101010] border-y border-outline-variant/20 px-4 flex items-center overflow-x-auto">
        {selectedTrack ? (
          <div className="w-full min-w-max flex items-center gap-3">
            <div className="h-11 px-3 rounded-sm bg-[#171717] border border-[#2d2d2d] flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">piano</span>
              <div className="flex flex-col leading-tight">
                <input
                  type="text"
                  value={selectedTrack.name}
                  onChange={(event) => handleSelectedTrackNameChange(event.target.value)}
                  onBlur={handleSelectedTrackNameBlur}
                  className="w-44 bg-transparent text-[11px] font-bold uppercase tracking-wide text-primary whitespace-nowrap outline-none border-b border-transparent focus:border-primary/60"
                  title="Edit track name"
                />
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                  Piano Instrument Track
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

                <button
                  onClick={handlePreviewSelectedTrack}
                  className="h-11 px-4 bg-[#181818] hover:bg-[#202020] text-primary text-[11px] font-bold uppercase tracking-widest border border-primary/30 transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                  Preview
                </button>

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

            {selectedTrack.type !== 'Instrument' && (
              <div className="h-11 px-4 bg-[#171717] border border-[#2d2d2d] flex items-center text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                This build supports piano instrument tracks only
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Add or select a piano track to edit sound and notes</span>
        )}
      </section>

      <main className="flex flex-1 overflow-hidden bg-[#131313]">
        <TimelinePanel
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          selectedTimelineClip={selectedTimelineClip}
          selectedTrackName={selectedTrack?.name ?? null}
          playheadBeat={playheadBeat}
          isLoopPlaybackOn={isLoopPlaybackOn}
          loopRange={loopRange}
          onLoopRangeChange={handleLoopRangeUpdate}
          onSeekBeat={handleSeekBeat}
          onOpenAddTrack={handleAddTrack}
          onTrackClick={handleTrackClick}
          onTrackDoubleClick={handleTrackDoubleClick}
          onToggleTrackMute={handleToggleTrackMute}
          onToggleTrackSolo={handleToggleTrackSolo}
          onTrackLaneDoubleClick={handleTrackLaneDoubleClick}
          onClipMouseDown={handleClipMouseDown}
          onClipDoubleClick={handleClipDoubleClick}
          onClipResizeMouseDown={handleClipResizeMouseDown}
        />
      </main>

      <PianoRollOverlay
        isOpen={isPianoRollOpen}
        activeTrackName={activeTrackName}
        bpm={bpm}
        bpmLabel={bpmLabel}
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
        onStartRealtimeHumming={handleStartRealtimeHumming}
        onRealtimeHummingEvent={handleRealtimeHummingEvent}
      />

      {saveNotification.visible && (
        <div className="fixed bottom-4 right-4 bg-primary text-on-primary px-4 py-2 rounded font-mono text-sm font-bold uppercase tracking-wide z-50 shadow-lg" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {saveNotification.message}
        </div>
      )}
    </div>
  );
}
