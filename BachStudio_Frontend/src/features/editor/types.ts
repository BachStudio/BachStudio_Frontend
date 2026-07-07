export type Note = {
  id: number;
  start: number;
  pitch: number;
  length: number;
};

export type TrackType = 'Instrument' | 'Drums' | 'Audio' | 'Bus';
export type InstrumentPresetId = 'piano' | 'analog' | 'organ' | 'bass' | 'elec_guitar' | 'elec_bass' | 'elec_piano' | 'cello' | 'flute' | 'violin';
export type DrumKitId = 'acoustic' | 'electro' | 'trap808' | 'synthwave' | 'jazz';
export type AudioSourceId = 'vocal_chop' | 'guitar_hit' | 'fx_riser';

export type Clip = {
  id: number;
  start: number;
  length: number;
  notes: Note[];
  audioDataUrl?: string;
  audioMimeType?: string;
  audioFileName?: string;
  audioPreview?: number[];
  audioStartOffset?: number;
};

export type Track = {
  id: number;
  type: TrackType;
  name: string;
  icon: string;
  clipClass: string;
  clips: Clip[];
  muted?: boolean;
  soloed?: boolean;
  instrumentPresetId: InstrumentPresetId;
  drumKitId: DrumKitId;
  audioSourceId: AudioSourceId;
  volumeDb: number;
  reverbWet: number;
  delayWet: number;
  distortion: number;
  outputBusId: number | null;
  busGainDb: number;
};

export type PianoTool = 'select' | 'draw';

export type DragState = {
  noteIds: number[];
  origins: Note[];
  mode: 'move' | 'resize';
  startClientX: number;
  startClientY: number;
};

export type SelectionBox = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export type TrackTypeOption = {
  id: TrackType;
  icon: string;
  subtitle: string;
};

export type InstrumentPresetOption = {
  id: InstrumentPresetId;
  label: string;
  subtitle: string;
};

export type DrumKitOption = {
  id: DrumKitId;
  label: string;
  subtitle: string;
};

export type AudioSourceOption = {
  id: AudioSourceId;
  label: string;
  subtitle: string;
  url: string;
};

export type PianoRow = {
  row: number;
  isBlack: boolean;
  label: string;
  icon?: string;
};
