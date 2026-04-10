import type {
  AudioSourceOption,
  DrumKitOption,
  InstrumentPresetOption,
  TrackType,
  TrackTypeOption,
} from './types';

export const MIDI_LOW = 21;
export const MIDI_HIGH = 108;
export const GRID_COL_WIDTH = 40;
export const GRID_ROW_HEIGHT = 24;
export const GRID_TOTAL_ROWS = MIDI_HIGH - MIDI_LOW + 1;
export const GRID_TOTAL_COLS = 160;
export const PIANO_STEPS_PER_BEAT = 4;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);
export const TIMELINE_BEATS_PER_BAR = 4;
export const TIMELINE_TOTAL_BARS = 17;
export const TIMELINE_TOTAL_BEATS = TIMELINE_BEATS_PER_BAR * TIMELINE_TOTAL_BARS;
export const CLIP_DEFAULT_LENGTH_BEATS = 4;
export const CLIP_SNAP_BEATS = 1;

export const TRACK_TYPE_OPTIONS: TrackTypeOption[] = [
  { id: 'Instrument', icon: 'piano', subtitle: 'Synth / MIDI Architecture' },
  { id: 'Drums', icon: 'album', subtitle: 'Sampler / Kit Matrix' },
  { id: 'Audio', icon: 'mic', subtitle: 'Recorded / Live Signal Path' },
  { id: 'Bus', icon: 'route', subtitle: 'Routing / Group Channel' },
];

export const CLIP_CLASS_BY_TYPE: Record<string, string> = {
  Instrument: 'bg-primary/10 border-primary/20',
  Drums: 'bg-secondary/10 border-secondary/20',
  Audio: 'bg-error/10 border-error/20',
  Bus: 'bg-tertiary/10 border-tertiary/20',
};

export const DEFAULT_TRACK_SETTINGS = {
  instrumentPresetId: 'piano' as const,
  drumKitId: 'electro' as const,
  audioSourceId: 'vocal_chop' as const,
  volumeDb: -4,
  outputBusId: null as number | null,
  busGainDb: 0,
};

export const INSTRUMENT_PRESET_OPTIONS: InstrumentPresetOption[] = [
  { id: 'piano', label: 'Grand Piano', subtitle: 'Sampler / Natural Tone' },
  { id: 'analog', label: 'Analog Lead', subtitle: 'PolySynth / Bright Lead' },
  { id: 'organ', label: 'Electric Organ', subtitle: 'FM / Sustained Chords' },
  { id: 'bass', label: 'Mono Bass', subtitle: 'MonoSynth / Low End' },
];

export const DRUM_KIT_OPTIONS: DrumKitOption[] = [
  { id: 'acoustic', label: 'Acoustic Kit', subtitle: 'Warm Kick / Snare / Hat' },
  { id: 'electro', label: 'Electro Kit', subtitle: 'Punchy Electronic Percussion' },
  { id: 'trap808', label: '808 Kit', subtitle: 'Deep Kick / Tight Hat' },
];

export const AUDIO_SOURCE_OPTIONS: AudioSourceOption[] = [
  {
    id: 'vocal_chop',
    label: 'Vocal Chop',
    subtitle: 'One-shot vocal texture',
    url: 'https://tonejs.github.io/audio/berklee/femalevoices_aa2_A3.mp3',
  },
  {
    id: 'guitar_hit',
    label: 'Guitar Hit',
    subtitle: 'Short guitar accent',
    url: 'https://tonejs.github.io/audio/berklee/guitar2_A2.mp3',
  },
  {
    id: 'fx_riser',
    label: 'FX Riser',
    subtitle: 'Atmospheric rise',
    url: 'https://tonejs.github.io/audio/berklee/harp_d5.mp3',
  },
];

export const TRACK_TYPE_LABEL: Record<TrackType, string> = {
  Instrument: 'Instrument',
  Drums: 'Drums',
  Audio: 'Audio',
  Bus: 'Bus',
};
