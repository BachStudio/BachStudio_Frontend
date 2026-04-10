export type Note = {
  id: number;
  start: number;
  pitch: number;
  length: number;
};

export type TrackType = 'Instrument' | 'Drums' | 'Audio' | 'Bus';
export type InstrumentPresetId = 'piano' | 'analog' | 'organ' | 'bass';
export type DrumKitId = 'acoustic' | 'electro' | 'trap808';
export type AudioSourceId = 'vocal_chop' | 'guitar_hit' | 'fx_riser';

export type Clip = {
  id: number;
  start: number;
  length: number;
  notes: Note[];
};

export type Track = {
  id: number;
  type: TrackType;
  name: string;
  icon: string;
  clipClass: string;
  clips: Clip[];
  instrumentPresetId: InstrumentPresetId;
  drumKitId: DrumKitId;
  audioSourceId: AudioSourceId;
  volumeDb: number;
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
};
