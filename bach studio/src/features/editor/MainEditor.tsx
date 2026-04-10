import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Tone from 'tone';
import { AddTrackModal } from './AddTrackModal';
import {
  AUDIO_SOURCE_OPTIONS,
  BLACK_SEMITONES,
  CLIP_DEFAULT_LENGTH_BEATS,
  CLIP_SNAP_BEATS,
  CLIP_CLASS_BY_TYPE,
  DEFAULT_TRACK_SETTINGS,
  DRUM_KIT_OPTIONS,
  GRID_COL_WIDTH,
  GRID_ROW_HEIGHT,
  GRID_TOTAL_ROWS,
  INSTRUMENT_PRESET_OPTIONS,
  MIDI_HIGH,
  MIDI_LOW,
  NOTE_NAMES,
  PIANO_STEPS_PER_BEAT,
  TIMELINE_TOTAL_BEATS,
  TRACK_TYPE_LABEL,
  TRACK_TYPE_OPTIONS,
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

export function MainEditor() {
  const [searchParams] = useSearchParams();
  const [isAICoreVisible, setIsAICoreVisible] = useState(false);
  const [isAddTrackModalOpen, setIsAddTrackModalOpen] = useState(false);
  const [isPianoRollOpen, setIsPianoRollOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [activePianoTrackId, setActivePianoTrackId] = useState<number | null>(null);
  const [activePianoClipId, setActivePianoClipId] = useState<number | null>(null);
  const [selectedTrackType, setSelectedTrackType] = useState<TrackType>('Instrument');
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

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
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
  const playbackSessionRef = useRef<null | {
    startWallTime: number;
    startBeat: number;
    nextEventIndex: number;
    bpm: number;
    events: PlaybackNoteEvent[];
  }>(null);

  const projectName = searchParams.get('projectName') ?? 'SESSION_2023_X4';
  const bpmRaw = Number.parseFloat(searchParams.get('bpm') ?? '128');
  const safeBpm = Number.isFinite(bpmRaw) && bpmRaw > 0 ? bpmRaw : 128;
  const bpmLabel = safeBpm.toFixed(2);

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
  const busTracks = tracks.filter((track) => track.type === 'Bus');

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const toGainFillPercent = (db: number) => ((clamp(db, -24, 12) + 24) / 36) * 100;
  const formatTimecode = (beat: number) => {
    const totalSeconds = (Math.max(0, beat) * 60) / safeBpm;
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
    effectiveVolumeDb: number,
  ) => {
    const player = audioPlayersRef.current[sourceId];
    if (!player || !player.loaded) {
      return;
    }

    player.volume.value = effectiveVolumeDb;
    player.start(undefined, 0, Math.max(0.1, durationSeconds));
  };

  const triggerPlaybackEvent = (event: PlaybackNoteEvent) => {
    const velocity = dbToVelocity(event.effectiveVolumeDb);

    if (event.trackType === 'Instrument' && event.pitch !== null) {
      triggerInstrumentNote(event.instrumentPresetId, event.pitch, event.durationSeconds, velocity);
      return;
    }

    if (event.trackType === 'Drums' && event.pitch !== null) {
      triggerDrumNote(event.drumKitId, event.pitch, event.durationSeconds, velocity);
      return;
    }

    if (event.trackType === 'Audio') {
      triggerAudioClip(event.audioSourceId, event.durationSeconds, event.effectiveVolumeDb);
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

  const buildPlaybackEvents = (): PlaybackNoteEvent[] => {
    const beatSeconds = 60 / safeBpm;
    const events: PlaybackNoteEvent[] = [];

    tracks.forEach((track) => {
      if (track.type === 'Bus') {
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

    const currentBeat = getCurrentSessionBeat();
    setPlayheadBeat(currentBeat);

    while (session.nextEventIndex < session.events.length && session.events[session.nextEventIndex].startBeat <= currentBeat + 0.0001) {
      const event = session.events[session.nextEventIndex];
      triggerPlaybackEvent(event);
      session.nextEventIndex += 1;
    }

    if (currentBeat >= TIMELINE_TOTAL_BEATS) {
      setIsPlaying(false);
      playbackSessionRef.current = null;
      cancelPlaybackTimer();
      setPlayheadBeat(TIMELINE_TOTAL_BEATS);
      return;
    }
  };

  const startPlayback = async (startBeat: number) => {
    const start = clamp(startBeat, 0, TIMELINE_TOTAL_BEATS);
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
      bpm: safeBpm,
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

  const triggerTrackPreview = async (track: Track, pitch: number, durationSeconds = 0.35) => {
    try {
      await ensureToneReady();
      const velocity = dbToVelocity(getEffectiveTrackVolumeDb(track));

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
        player.volume.value = getEffectiveTrackVolumeDb(track);
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

  const handleAddTrack = () => {
    const selectedOption = TRACK_TYPE_OPTIONS.find((option) => option.id === selectedTrackType) ?? TRACK_TYPE_OPTIONS[0];
    const nextIndex = tracks.length + 1;
    const defaultOutputBusId = selectedOption.id === 'Bus' ? null : (busTracks[0]?.id ?? null);
    const createdTrack: Track = {
      id: Date.now() + nextIndex,
      type: selectedOption.id,
      name: `${String(nextIndex).padStart(2, '0')} ${selectedOption.id.toUpperCase()} TRACK`,
      icon: selectedOption.icon,
      clipClass: CLIP_CLASS_BY_TYPE[selectedOption.id] ?? 'bg-primary/10 border-primary/20',
      clips: [],
      ...DEFAULT_TRACK_SETTINGS,
      outputBusId: defaultOutputBusId,
    };

    setTracks((prev) => [...prev, createdTrack]);
    setSelectedTrackId(createdTrack.id);

    setIsAddTrackModalOpen(false);
  };

  const handleTrackClick = (trackId: number) => {
    setSelectedTrackId(trackId);
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

  const handleSelectedTrackAudioSourceChange = (sourceId: AudioSourceId) => {
    if (!selectedTrack) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, audioSourceId: sourceId }));
    void ensureAudioPlayer(sourceId);
  };

  const handleSelectedTrackOutputBusChange = (rawValue: string) => {
    if (!selectedTrack || selectedTrack.type === 'Bus') {
      return;
    }

    const outputBusId = rawValue === 'master' ? null : Number.parseInt(rawValue, 10);
    updateTrackById(selectedTrack.id, (track) => ({
      ...track,
      outputBusId: Number.isFinite(outputBusId as number) ? outputBusId : null,
    }));
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

  const handleSelectedBusGainChange = (rawValue: string) => {
    if (!selectedTrack || selectedTrack.type !== 'Bus') {
      return;
    }

    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({ ...track, busGainDb: clamp(parsed, -24, 12) }));
  };

  const nudgeSelectedBusGain = (delta: number) => {
    if (!selectedTrack || selectedTrack.type !== 'Bus') {
      return;
    }

    updateTrackById(selectedTrack.id, (track) => ({
      ...track,
      busGainDb: clamp(track.busGainDb + delta, -24, 12),
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
      openPianoRollForClip(trackId, createdClip.id);
      return;
    }

    openPianoRollForClip(trackId, targetTrack.clips[0].id);
  };

  const handleTrackLaneDoubleClick = (event: ReactMouseEvent<HTMLDivElement>, trackId: number) => {
    setSelectedTrackId(trackId);
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

    updateTrackClips(trackId, (clips) => [
      ...clips,
      {
        id: Date.now() + snappedStart,
        start: snappedStart,
        length: clippedLength,
        notes: [],
      },
    ]);
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
          <nav className="flex items-center gap-4">
            <a className="text-[#f4ffc6] border-b-2 border-[#f4ffc6] pb-1 font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">Track</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">File</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">Edit</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">Mix</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">View</a>
          </nav>
        </div>

        <div className="flex items-center bg-surface-container-low px-4 py-1 gap-8 ghost-border">
          <div className="flex items-center gap-4">
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
            <button className="text-error active:scale-95"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span></button>
          </div>
          <div className="flex gap-6 font-mono text-[13px] text-primary">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">BPM</span>
              <span>{bpmLabel}</span>
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
          <button
            onClick={() => setIsAICoreVisible((prev) => !prev)}
            className={`hover:bg-[#2c2c2c] transition-colors p-1 ${isAICoreVisible ? 'text-primary' : 'text-zinc-500'}`}
            title="Toggle AI Core"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isAICoreVisible ? "'FILL' 1" : "'FILL' 0" }}>bolt</span>
          </button>
          <button className="hover:bg-[#2c2c2c] transition-colors p-1 text-zinc-500"><span className="material-symbols-outlined">help</span></button>
          <button className="hover:bg-[#2c2c2c] transition-colors p-1 text-zinc-500"><span className="material-symbols-outlined">settings</span></button>
          <button className="bg-primary text-on-primary px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-widest active:bg-white transition-all">Export</button>
        </div>
      </header>

      <section className="h-14 bg-[#101010] border-y border-outline-variant/20 px-4 flex items-center overflow-x-auto">
        {selectedTrack ? (
          <div className="w-full min-w-max flex items-center gap-3">
            <div className="h-10 px-3 rounded-sm bg-[#171717] border border-[#2d2d2d] flex flex-col justify-center">
              <span className="text-[11px] font-bold uppercase tracking-wide text-primary whitespace-nowrap">
                {selectedTrack.name} / {TRACK_TYPE_LABEL[selectedTrack.type]}
              </span>
            </div>

            {selectedTrack.type === 'Instrument' && (
              <label className="editor-control-card w-[220px]">
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
            )}

            {selectedTrack.type === 'Drums' && (
              <label className="editor-control-card w-[220px]">
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
            )}

            {selectedTrack.type === 'Audio' && (
              <label className="editor-control-card w-[220px]">
                <span className="editor-control-label">Audio Source</span>
                <select
                  value={selectedTrack.audioSourceId}
                  onChange={(event) => handleSelectedTrackAudioSourceChange(event.target.value as AudioSourceId)}
                  className="editor-control-select"
                >
                  {AUDIO_SOURCE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}

            {selectedTrack.type !== 'Bus' && (
              <label className="editor-control-card w-[320px]">
                <span className="editor-control-label">Volume</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => nudgeSelectedTrackVolume(-1)}
                    className="editor-step-button"
                    title="Lower volume"
                  >
                    -
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
                    +
                  </button>
                  <span className="editor-value-badge">{selectedTrack.volumeDb.toFixed(0)}dB</span>
                </div>
              </label>
            )}

            {selectedTrack.type !== 'Bus' && (
              <label className="editor-control-card w-[190px]">
                <span className="editor-control-label">Output</span>
                <select
                  value={selectedTrack.outputBusId === null ? 'master' : String(selectedTrack.outputBusId)}
                  onChange={(event) => handleSelectedTrackOutputBusChange(event.target.value)}
                  className="editor-control-select"
                >
                  <option value="master">Master</option>
                  {busTracks.map((busTrack) => (
                    <option key={busTrack.id} value={busTrack.id}>{busTrack.name}</option>
                  ))}
                </select>
              </label>
            )}

            {selectedTrack.type === 'Bus' && (
              <label className="editor-control-card w-[320px]">
                <span className="editor-control-label">Bus Gain</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => nudgeSelectedBusGain(-1)}
                    className="editor-step-button"
                    title="Lower gain"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={-24}
                    max={12}
                    step={1}
                    value={selectedTrack.busGainDb}
                    onChange={(event) => handleSelectedBusGainChange(event.target.value)}
                    className="editor-fader"
                    style={{
                      background: `linear-gradient(90deg, #88f6d7 ${toGainFillPercent(selectedTrack.busGainDb)}%, #2a2a2a ${toGainFillPercent(selectedTrack.busGainDb)}%)`,
                    }}
                  />
                  <button
                    onClick={() => nudgeSelectedBusGain(1)}
                    className="editor-step-button"
                    title="Raise gain"
                  >
                    +
                  </button>
                  <span className="editor-value-badge text-[#88f6d7]">{selectedTrack.busGainDb.toFixed(0)}dB</span>
                </div>
              </label>
            )}

            {selectedTrack.type !== 'Bus' && (
              <button
                onClick={handlePreviewSelectedTrack}
                className="ml-auto h-10 px-5 bg-[#181818] hover:bg-[#202020] text-primary text-[11px] font-bold uppercase tracking-widest border border-primary/30 transition-colors"
              >
                Preview
              </button>
            )}
          </div>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Select a track to edit sound and routing</span>
        )}
      </section>

      <main className="flex flex-1 overflow-hidden bg-[#131313] gap-[2px]">
        <aside className="bg-[#131313] flex flex-col items-center py-4 space-y-1 w-16 border-r-0">
          <div className="mb-4">
            <span className="font-['Inter'] text-[10px] font-bold uppercase text-zinc-600 tracking-tighter">TOOLS</span>
          </div>
          <button className="bg-[#20201f] text-[#f4ffc6] border-l-2 border-[#f4ffc6] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">near_me</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Select</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">content_cut</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Cut</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">edit</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Draw</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">volume_off</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Mute</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">search</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Zoom</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">swap_horiz</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Slip</span>
          </button>
        </aside>

        <TimelinePanel
          tracks={tracks}
          selectedTrackId={selectedTrackId}
          selectedTrackName={selectedTrack?.name ?? null}
          playheadBeat={playheadBeat}
          onOpenAddTrack={() => setIsAddTrackModalOpen(true)}
          onTrackClick={handleTrackClick}
          onTrackDoubleClick={handleTrackDoubleClick}
          onTrackLaneDoubleClick={handleTrackLaneDoubleClick}
          onClipMouseDown={handleClipMouseDown}
          onClipDoubleClick={handleClipDoubleClick}
          onClipResizeMouseDown={handleClipResizeMouseDown}
        />

        {isAICoreVisible && (
          <aside className="w-72 bg-surface-container-low flex flex-col p-4 gap-6">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                <span className="text-[12px] font-black uppercase tracking-widest text-primary">AI Core</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-500">v2.4 Engine</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container p-3 flex flex-col">
                <span className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Inference</span>
                <span className="text-xs font-mono text-primary">0ms</span>
              </div>
              <div className="bg-surface-container p-3 flex flex-col">
                <span className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Confidence</span>
                <span className="text-xs font-mono text-primary">0%</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Mumble Sensitivity</label>
                  <span className="text-[10px] font-mono text-primary">74%</span>
                </div>
                <div className="h-1 bg-surface-container-highest relative">
                  <div className="absolute top-0 left-0 h-full w-[74%] bg-primary"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 left-[74%] w-3 h-3 bg-white -ml-1.5 cursor-pointer"></div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Quantize Amount</label>
                  <span className="text-[10px] font-mono text-primary">0.5s</span>
                </div>
                <div className="h-1 bg-surface-container-highest relative">
                  <div className="absolute top-0 left-0 h-full w-[40%] bg-primary"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 left-[40%] w-3 h-3 bg-white -ml-1.5 cursor-pointer"></div>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <button className="w-full bg-surface-container-highest text-zinc-500 font-bold uppercase py-3 text-[11px] tracking-widest transition-all" disabled>
                Generate Pattern
              </button>
            </div>
          </aside>
        )}
      </main>

      <footer className="w-full flex justify-between items-center px-4 bg-[#0e0e0e] h-6 border-t border-[#484847]/20 z-50">
        <div className="flex items-center">
          <span className="font-mono text-[9px] uppercase tracking-tighter text-zinc-500">Bach Studio Engine v2.4 | CPU: 14% | RAM: 2.4GB</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="font-mono text-[9px] uppercase tracking-tighter text-zinc-600 hover:text-white" href="#">Buffer: 128</a>
          <a className="font-mono text-[9px] uppercase tracking-tighter text-[#f4ffc6] hover:text-white" href="#">44.1kHz</a>
          <a className="font-mono text-[9px] uppercase tracking-tighter text-zinc-600 hover:text-white" href="#">24-bit</a>
        </div>
      </footer>

      <PianoRollOverlay
        isOpen={isPianoRollOpen}
        activeTrackName={activeTrackName}
        bpmLabel={bpmLabel}
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
      />

      <AddTrackModal
        isOpen={isAddTrackModalOpen}
        selectedTrackType={selectedTrackType}
        onClose={() => setIsAddTrackModalOpen(false)}
        onAddTrack={handleAddTrack}
        onSelectTrackType={setSelectedTrackType}
      />
    </div>
  );
}
