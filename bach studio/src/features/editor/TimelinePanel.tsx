import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  PIANO_STEPS_PER_BEAT,
  GRID_TOTAL_ROWS,
  TIMELINE_BEATS_PER_BAR,
  TIMELINE_TOTAL_BARS,
  TIMELINE_TOTAL_BEATS,
} from './constants';
import type { Clip, Track } from './types';

type TimelinePanelProps = {
  tracks: Track[];
  selectedTrackId: number | null;
  selectedTrackName: string | null;
  playheadBeat: number;
  onOpenAddTrack: () => void;
  onTrackClick: (trackId: number) => void;
  onTrackDoubleClick: (trackId: number) => void;
  onTrackLaneDoubleClick: (event: ReactMouseEvent<HTMLDivElement>, trackId: number) => void;
  onClipMouseDown: (event: ReactMouseEvent<HTMLDivElement>, trackId: number, clip: Clip) => void;
  onClipDoubleClick: (event: ReactMouseEvent<HTMLDivElement>, trackId: number, clipId: number) => void;
  onClipResizeMouseDown: (event: ReactMouseEvent<HTMLSpanElement>, trackId: number, clip: Clip) => void;
};

export function TimelinePanel({
  tracks,
  selectedTrackId,
  selectedTrackName,
  playheadBeat,
  onOpenAddTrack,
  onTrackClick,
  onTrackDoubleClick,
  onTrackLaneDoubleClick,
  onClipMouseDown,
  onClipDoubleClick,
  onClipResizeMouseDown,
}: TimelinePanelProps) {
  const playheadPercent = Math.max(0, Math.min((playheadBeat / TIMELINE_TOTAL_BEATS) * 100, 100));
  const getTrackSoundLabel = (track: Track) => {
    if (track.type === 'Instrument') {
      return `Inst: ${track.instrumentPresetId}`;
    }
    if (track.type === 'Drums') {
      return `Kit: ${track.drumKitId}`;
    }
    if (track.type === 'Audio') {
      return `Src: ${track.audioSourceId}`;
    }

    return `Gain: ${track.busGainDb.toFixed(0)}dB`;
  };

  return (
    <section className="flex-1 flex flex-col min-w-0 bg-surface">
      <div className="h-8 bg-surface-container-low flex items-center border-b border-outline-variant/10">
        <div className="w-48 border-r border-outline-variant/20 h-full flex items-center px-4">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Track List</span>
        </div>
        <div className="flex-1 h-full relative overflow-hidden">
          {Array.from({ length: TIMELINE_TOTAL_BARS }, (_, barIndex) => (
            <span
              key={`ruler-num-${barIndex}`}
              className="absolute top-0.5 text-[9px] font-mono text-zinc-300"
              style={{ left: `calc(${(barIndex / TIMELINE_TOTAL_BARS) * 100}% + 4px)` }}
            >
              {barIndex + 1}
            </span>
          ))}
          {Array.from({ length: TIMELINE_TOTAL_BEATS + 1 }, (_, beatBoundary) => {
            const isBar = beatBoundary % TIMELINE_BEATS_PER_BAR === 0;
            return (
              <span
                key={`ruler-line-${beatBoundary}`}
                className={`absolute top-3 bottom-0 w-px ${isBar ? 'bg-outline-variant/45' : 'bg-outline-variant/20'}`}
                style={{ left: `${(beatBoundary / TIMELINE_TOTAL_BEATS) * 100}%` }}
              ></span>
            );
          })}
          <div
            className="absolute top-0 bottom-0 w-px bg-primary z-30 pointer-events-none"
            style={{ left: `${playheadPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex h-16">
          <div className="w-48 flex items-center justify-center border-r border-outline-variant/20">
            <button
              onClick={onOpenAddTrack}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-all group"
            >
              <span className="material-symbols-outlined text-lg">add_box</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter">Add Track</span>
            </button>
          </div>
          <div className="flex-1 border-b border-outline-variant/5"></div>
        </div>

        {tracks.map((track) => (
          <div
            key={track.id}
            className={`h-28 flex border-b border-outline-variant/5 ${selectedTrackId === track.id ? 'bg-surface-container-high/70' : 'bg-surface-container-low/50'}`}
          >
            <div
              onClick={() => onTrackClick(track.id)}
              onDoubleClick={() => onTrackDoubleClick(track.id)}
              className={`w-48 border-r border-outline-variant/10 p-3 flex flex-col justify-between cursor-pointer ${selectedTrackId === track.id ? 'bg-surface-container-highest border-l-2 border-l-primary' : 'bg-surface-container-high'}`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-primary">{track.icon}</span>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[10px] text-primary truncate block">{track.name}</span>
                  <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-wide block">{getTrackSoundLabel(track)}</span>
                </div>
                {selectedTrackId === track.id && (
                  <span className="ml-auto px-1 py-0.5 bg-primary text-black text-[7px] font-black tracking-wider">SELECTED</span>
                )}
              </div>
              <div className="flex gap-1">
                <div className="w-6 h-4 bg-surface-bright flex items-center justify-center text-[8px] font-bold">M</div>
                <div className="w-6 h-4 bg-surface-bright flex items-center justify-center text-[8px] font-bold">S</div>
              </div>
            </div>

            <div
              data-track-lane="1"
              onClick={() => onTrackClick(track.id)}
              onDoubleClick={(event) => onTrackLaneDoubleClick(event, track.id)}
              className={`flex-1 relative overflow-hidden ${track.type === 'Bus' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="absolute inset-0 pointer-events-none">
                {Array.from({ length: TIMELINE_TOTAL_BARS }, (_, barIndex) => (
                  <div
                    key={`track-${track.id}-bar-${barIndex}`}
                    className={`absolute top-0 bottom-0 border-r border-outline-variant/10 ${barIndex % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}
                    style={{
                      left: `${(barIndex / TIMELINE_TOTAL_BARS) * 100}%`,
                      width: `${100 / TIMELINE_TOTAL_BARS}%`,
                    }}
                  ></div>
                ))}

                {Array.from({ length: TIMELINE_TOTAL_BEATS + 1 }, (_, beatBoundary) => {
                  const isBar = beatBoundary % TIMELINE_BEATS_PER_BAR === 0;
                  return (
                    <span
                      key={`track-${track.id}-beat-line-${beatBoundary}`}
                      className={`absolute top-0 bottom-0 w-px ${isBar ? 'bg-outline-variant/35' : 'bg-outline-variant/15'}`}
                      style={{ left: `${(beatBoundary / TIMELINE_TOTAL_BEATS) * 100}%` }}
                    ></span>
                  );
                })}

                <div
                  className="absolute top-0 bottom-0 w-px bg-primary/80 z-20"
                  style={{ left: `${playheadPercent}%` }}
                ></div>
              </div>

              {track.clips.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                    {track.type === 'Bus' ? 'Bus Track: Routing And Gain Control' : 'Double Click Empty Lane To Create Clip'}
                  </span>
                </div>
              )}

              {track.clips.map((clip) => (
                <div
                  key={clip.id}
                  data-clip="1"
                  onMouseDown={(event) => onClipMouseDown(event, track.id, clip)}
                  onDoubleClick={(event) => onClipDoubleClick(event, track.id, clip.id)}
                  className={`absolute top-3 bottom-3 border ${track.clipClass} backdrop-blur-[1px] overflow-hidden rounded-[2px] cursor-grab active:cursor-grabbing`}
                  style={{
                    left: `${(clip.start / TIMELINE_TOTAL_BEATS) * 100}%`,
                    width: `${Math.max((clip.length / TIMELINE_TOTAL_BEATS) * 100, 1.4)}%`,
                  }}
                  title="Drag to move. Double click to edit in piano roll."
                >
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: Math.max(clip.length - 1, 0) }, (_, beatIndex) => {
                      const beat = beatIndex + 1;
                      const isBarLine = beat % TIMELINE_BEATS_PER_BAR === 0;
                      return (
                        <span
                          key={`clip-${clip.id}-beat-${beat}`}
                          className={`absolute top-0 bottom-0 w-px ${isBarLine ? 'bg-white/45' : 'bg-white/15'}`}
                          style={{ left: `${(beat / clip.length) * 100}%` }}
                        ></span>
                      );
                    })}
                  </div>

                  <span className="absolute top-1 left-1 text-[9px] font-bold text-white uppercase">{track.type}</span>
                  {track.type === 'Audio' ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-primary/80 uppercase tracking-wider">
                      Audio Clip
                    </span>
                  ) : clip.notes.length === 0 ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-primary/70 uppercase tracking-wider">
                      Empty
                    </span>
                  ) : (
                    <div className="absolute inset-0 pointer-events-none">
                      {clip.notes.slice(0, 64).map((note) => (
                        <span
                          key={`clip-note-${clip.id}-${note.id}`}
                          className="absolute bg-primary/80 rounded-[1px]"
                          style={{
                            left: `${(note.start / Math.max(1, clip.length * PIANO_STEPS_PER_BEAT)) * 100}%`,
                            width: `${Math.max((note.length / Math.max(1, clip.length * PIANO_STEPS_PER_BEAT)) * 100, 1)}%`,
                            top: `${Math.min((note.pitch / GRID_TOTAL_ROWS) * 100, 94)}%`,
                            height: '6%',
                          }}
                        ></span>
                      ))}
                    </div>
                  )}

                  <span
                    onMouseDown={(event) => onClipResizeMouseDown(event, track.id, clip)}
                    data-clip-resize="1"
                    className="absolute right-0 top-0 h-full w-2 bg-black/25 hover:bg-black/40 border-l border-white/20 cursor-ew-resize"
                    title="Resize clip length"
                  ></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="h-48 bg-surface-container-low border-t border-outline-variant/20 flex gap-[2px] p-[2px]">
        <div className="w-20 bg-surface-container-high flex flex-col items-center py-2 relative">
          <span className="text-[8px] font-bold text-on-surface-variant uppercase mb-2">Master</span>
          <div className="flex-1 w-1 bg-surface-container-lowest relative">
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-4 h-2 bg-primary"></div>
          </div>
          <div className="mt-2 text-[9px] font-mono text-primary">-3.2 dB</div>
        </div>

        <div className="flex-1 bg-surface-container-lowest/50 m-2 flex items-center justify-center overflow-hidden">
          {tracks.length === 0 ? (
            <span className="text-zinc-600 font-mono text-xs font-bold uppercase">No Active Tracks</span>
          ) : selectedTrackName ? (
            <span className="text-primary font-mono text-xs font-bold uppercase truncate px-4">Selected: {selectedTrackName}</span>
          ) : (
            <span className="text-primary font-mono text-xs font-bold uppercase">Active Tracks: {tracks.length}</span>
          )}
        </div>
      </div>
    </section>
  );
}
