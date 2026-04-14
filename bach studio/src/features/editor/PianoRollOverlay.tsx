import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import {
  GRID_COL_WIDTH,
  GRID_ROW_HEIGHT,
  GRID_TOTAL_ROWS,
} from './constants';
import type { Note, PianoRow, PianoTool, SelectionBox } from './types';

type PianoRollOverlayProps = {
  isOpen: boolean;
  activeTrackName: string;
  bpmLabel: string;
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
};

type HummingWheelNote = {
  label: string;
  angleDeg: number;
};

const HUMMING_WHEEL_NOTES: HummingWheelNote[] = [
  { label: 'A', angleDeg: 180 },
  { label: 'B', angleDeg: 230 },
  { label: 'C', angleDeg: 275 },
  { label: 'D', angleDeg: 330 },
  { label: 'E', angleDeg: 30 },
  { label: 'F', angleDeg: 85 },
  { label: 'G', angleDeg: 135 },
];

export function PianoRollOverlay({
  isOpen,
  activeTrackName,
  bpmLabel,
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
}: PianoRollOverlayProps) {
  const [isHummingPanelOpen, setIsHummingPanelOpen] = useState(false);
  const activeHummingNote = 'D';

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
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase text-on-surface-variant">Quantize</span>
              <div className="flex bg-surface-container-highest">
                <button className="px-2 py-1 text-[9px] font-mono text-primary bg-surface-bright">1/16</button>
                <button className="px-2 py-1 text-[9px] font-mono text-on-surface-variant hover:text-white">1/8</button>
                <button className="px-2 py-1 text-[9px] font-mono text-on-surface-variant hover:text-white">1/4</button>
              </div>
            </div>
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
                {pianoRows.map((key) => (
                  <button
                    key={key.row}
                    onMouseDown={() => {
                      onPreviewPitch(key.row, 0.45);
                    }}
                    className="block h-[23px] mb-px relative w-full text-left"
                  >
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
                  </button>
                ))}
              </div>

              <div
                ref={gridRef}
                onMouseDown={onGridMouseDown}
                onDoubleClick={onGridDoubleClick}
                onScroll={() => onSyncVerticalScroll('grid')}
                className="flex-1 relative overflow-auto select-none"
                style={{
                  cursor: pianoTool === 'draw' ? 'crosshair' : 'default',
                  backgroundSize: '40px 24px',
                  backgroundImage: 'linear-gradient(to right, #262626 1px, transparent 1px)',
                }}
              >
                <div
                  className="relative"
                  style={{
                    width: `${gridTotalCols * GRID_COL_WIDTH}px`,
                    height: `${GRID_TOTAL_ROWS * GRID_ROW_HEIGHT}px`,
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
                  <div className="absolute top-0 bottom-0 left-64 w-[2px] bg-primary z-30 shadow-[0_0_10px_rgba(244,255,198,0.5)]"></div>

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
                      NOTE
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
              <div className="h-full flex flex-col px-5 py-4 gap-4">
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

                <div className="rounded-md border border-white/10 bg-[#191c23] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Realtime Pitch Wheel</span>
                    <span className="text-[10px] font-mono text-[#ff9ba4]">D3</span>
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

                      <path d="M130 130 L219 55 A116 116 0 0 1 245 114 Z" fill="rgba(255, 162, 171, 0.96)" />
                      <path d="M130 130 L198 74 A86 86 0 0 1 215 118 Z" fill="rgba(255, 162, 171, 0.6)" />
                      <path d="M130 130 L174 92 A58 58 0 0 1 187 123 Z" fill="rgba(255, 162, 171, 0.38)" />

                      <circle cx="130" cy="130" r="28" fill="#11161f" />
                      <circle cx="130" cy="130" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                      <text x="130" y="142" textAnchor="middle" className="fill-[#ff8f99] text-[18px] font-black tracking-tight">D3</text>
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
                    <span className="mt-1 block font-mono text-[#ffb4bb]">88%</span>
                  </div>
                  <div className="rounded-sm border border-white/10 bg-[#1a1e26] p-3">
                    <span className="block text-[8px] font-bold uppercase tracking-widest text-zinc-500">Detected Key</span>
                    <span className="mt-1 block font-mono text-[#ffb4bb]">D Minor</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Input Sensitivity</span>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full w-[72%] bg-[#ff9ba4]"></div>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-auto h-10 border border-[#ff9ba4]/60 text-[#ffb4bb] font-black text-[10px] uppercase tracking-[0.18em] bg-[#22171a] hover:bg-[#2c1a20] transition-colors"
                >
                  Convert Humming To MIDI
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
