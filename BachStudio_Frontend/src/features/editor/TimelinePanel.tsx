import { useEffect, useRef, useState } from 'react';
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
  selectedTimelineClip: { trackId: number; clipId: number } | null;
  selectedTrackName: string | null;
  playheadBeat: number;
  masterVolumeDb: number;
  isLoopPlaybackOn: boolean;
  loopRange: { startBeat: number; endBeat: number };
  onLoopEditStart: () => void;
  onLoopRangeChange: (nextRange: { startBeat: number; endBeat: number }) => void;
  onSeekBeat: (beat: number) => void;
  onMasterEditStart: () => void;
  onMasterVolumeChange: (value: string) => void;
  onAddTrack: (type: 'Instrument' | 'Audio') => void;
  onTrackClick: (trackId: number) => void;
  onTrackDoubleClick: (trackId: number) => void;
  onToggleTrackMute: (trackId: number) => void;
  onToggleTrackSolo: (trackId: number) => void;
  onTrackLaneDoubleClick: (event: ReactMouseEvent<HTMLDivElement>, trackId: number) => void;
  onClipMouseDown: (event: ReactMouseEvent<HTMLDivElement>, trackId: number, clip: Clip) => void;
  onClipDoubleClick: (event: ReactMouseEvent<HTMLDivElement>, trackId: number, clipId: number) => void;
  onClipResizeMouseDown: (event: ReactMouseEvent<HTMLSpanElement>, trackId: number, clip: Clip) => void;
  onDeleteClip: (trackId: number, clipId: number) => void;
};

type LoopDragState = {
  mode: 'create' | 'move' | 'start' | 'end';
  anchorBeat: number;
  initialStartBeat: number;
  initialEndBeat: number;
};

const TIMELINE_BEAT_WIDTH_PX = 28;

export function TimelinePanel({
  tracks,
  selectedTrackId,
  selectedTimelineClip,
  selectedTrackName,
  playheadBeat,
  masterVolumeDb,
  isLoopPlaybackOn,
  loopRange,
  onLoopEditStart,
  onLoopRangeChange,
  onSeekBeat,
  onMasterEditStart,
  onMasterVolumeChange,
  onAddTrack,
  onTrackClick,
  onTrackDoubleClick,
  onToggleTrackMute,
  onToggleTrackSolo,
  onTrackLaneDoubleClick,
  onClipMouseDown,
  onClipDoubleClick,
  onClipResizeMouseDown,
  onDeleteClip,
}: TimelinePanelProps) {
  const [loopDragState, setLoopDragState] = useState<LoopDragState | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const horizontalScrollRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isSyncingHorizontalScrollRef = useRef(false);
  const timelineContentWidth = TIMELINE_TOTAL_BEATS * TIMELINE_BEAT_WIDTH_PX;
  const playheadPercent = Math.max(0, Math.min((playheadBeat / TIMELINE_TOTAL_BEATS) * 100, 100));
  const clampBeat = (value: number) => Math.max(0, Math.min(value, TIMELINE_TOTAL_BEATS));
  const loopSnapBeats = 1 / PIANO_STEPS_PER_BEAT;
  const minLoopLengthBeats = loopSnapBeats;
  const snapBeat = (value: number) => clampBeat(Math.round(value / loopSnapBeats) * loopSnapBeats);

  const normalizeLoopRange = (startBeat: number, endBeat: number) => {
    const normalizedStart = Math.max(0, Math.min(snapBeat(startBeat), TIMELINE_TOTAL_BEATS - minLoopLengthBeats));
    const normalizedEnd = Math.max(normalizedStart + minLoopLengthBeats, Math.min(snapBeat(endBeat), TIMELINE_TOTAL_BEATS));
    return {
      startBeat: normalizedStart,
      endBeat: normalizedEnd,
    };
  };

  const beatFromClientX = (clientX: number) => {
    if (!rulerRef.current) {
      return 0;
    }

    const rect = rulerRef.current.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }

    const ratio = (clientX - rect.left) / rect.width;
    return clampBeat(ratio * TIMELINE_TOTAL_BEATS);
  };

  const getTrackSoundLabel = (track: Track) => {
    if (track.type === 'Instrument') {
      return `Inst: ${track.instrumentPresetId}`;
    }
    if (track.type === 'Drums') {
      return `Kit: ${track.drumKitId}`;
    }
    if (track.type === 'Audio') {
      return 'Voice Input';
    }

    return `Gain: ${track.busGainDb.toFixed(0)}dB`;
  };

  const setHorizontalScrollRef = (index: number) => (node: HTMLDivElement | null) => {
    horizontalScrollRefs.current[index] = node;
  };

  const syncHorizontalScroll = (source: HTMLDivElement) => {
    if (isSyncingHorizontalScrollRef.current) {
      return;
    }

    isSyncingHorizontalScrollRef.current = true;
    horizontalScrollRefs.current.forEach((node) => {
      if (node && node !== source) {
        node.scrollLeft = source.scrollLeft;
      }
    });

    requestAnimationFrame(() => {
      isSyncingHorizontalScrollRef.current = false;
    });
  };

  const handleRulerClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const beat = snapBeat(beatFromClientX(event.clientX));
    onSeekBeat(beat);
  };

  const startLoopDrag = (
    event: ReactMouseEvent<HTMLDivElement | HTMLSpanElement>,
    mode: LoopDragState['mode'],
  ) => {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    onLoopEditStart();
    const anchorBeat = snapBeat(beatFromClientX(event.clientX));
    setLoopDragState({
      mode,
      anchorBeat,
      initialStartBeat: loopRange.startBeat,
      initialEndBeat: loopRange.endBeat,
    });
  };

  useEffect(() => {
    if (!loopDragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const currentBeat = snapBeat(beatFromClientX(event.clientX));

      if (loopDragState.mode === 'create') {
        const nextStart = Math.min(loopDragState.anchorBeat, currentBeat);
        const nextEnd = Math.max(loopDragState.anchorBeat, currentBeat);
        onLoopRangeChange(normalizeLoopRange(nextStart, nextEnd));
        return;
      }

      if (loopDragState.mode === 'move') {
        const deltaBeats = currentBeat - loopDragState.anchorBeat;
        const width = loopDragState.initialEndBeat - loopDragState.initialStartBeat;
        let nextStart = loopDragState.initialStartBeat + deltaBeats;
        let nextEnd = loopDragState.initialEndBeat + deltaBeats;

        if (nextStart < 0) {
          nextStart = 0;
          nextEnd = width;
        }
        if (nextEnd > TIMELINE_TOTAL_BEATS) {
          nextEnd = TIMELINE_TOTAL_BEATS;
          nextStart = TIMELINE_TOTAL_BEATS - width;
        }

        onLoopRangeChange(normalizeLoopRange(nextStart, nextEnd));
        return;
      }

      if (loopDragState.mode === 'start') {
        const nextStart = Math.min(currentBeat, loopDragState.initialEndBeat - minLoopLengthBeats);
        onLoopRangeChange(normalizeLoopRange(nextStart, loopDragState.initialEndBeat));
        return;
      }

      const nextEnd = Math.max(currentBeat, loopDragState.initialStartBeat + minLoopLengthBeats);
      onLoopRangeChange(normalizeLoopRange(loopDragState.initialStartBeat, nextEnd));
    };

    const handleMouseUp = () => {
      setLoopDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [loopDragState, onLoopRangeChange]);

  const loopLeftPercent = (loopRange.startBeat / TIMELINE_TOTAL_BEATS) * 100;
  const loopWidthPercent = ((loopRange.endBeat - loopRange.startBeat) / TIMELINE_TOTAL_BEATS) * 100;

  return (
    <section className="flex-1 flex flex-col min-w-0 bg-surface">
      <div className="h-8 bg-surface-container-low flex items-center border-b border-outline-variant/10">
        <div className="w-48 border-r border-outline-variant/20 h-full flex items-center px-4">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Track List</span>
        </div>
        <div
          ref={setHorizontalScrollRef(0)}
          onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
          className="flex-1 h-full overflow-x-auto overflow-y-hidden no-scrollbar"
        >
        <div
          ref={rulerRef}
          className="h-full relative cursor-pointer"
          style={{ width: `${timelineContentWidth}px` }}
          onClick={handleRulerClick}
        >
          <div
            className="absolute top-0 left-0 right-0 h-2 bg-black/35 border-b border-white/10"
            onMouseDown={(event) => startLoopDrag(event, 'create')}
          >
            <div
              className={`absolute top-0 bottom-0 ${isLoopPlaybackOn ? 'bg-[#c7251b]/80' : 'bg-[#8e3a34]/45'} border border-[#ff6a5c]/90 cursor-move`}
              style={{
                left: `${loopLeftPercent}%`,
                width: `${loopWidthPercent}%`,
                minWidth: `${loopSnapBeats * TIMELINE_BEAT_WIDTH_PX}px`,
              }}
              onMouseDown={(event) => startLoopDrag(event, 'move')}
              title="Drag to move loop range"
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ffd9d4]/70 cursor-ew-resize"
                onMouseDown={(event) => startLoopDrag(event, 'start')}
                title="Drag loop start"
              ></span>
              <span
                className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#ffd9d4]/70 cursor-ew-resize"
                onMouseDown={(event) => startLoopDrag(event, 'end')}
                title="Drag loop end"
              ></span>
            </div>
          </div>

          {Array.from({ length: TIMELINE_TOTAL_BARS }, (_, barIndex) => (
            <button
              key={`ruler-num-${barIndex}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSeekBeat(barIndex * TIMELINE_BEATS_PER_BAR);
              }}
              className="absolute top-[2px] text-[9px] font-mono text-zinc-300 hover:text-primary bg-transparent"
              style={{ left: `calc(${(barIndex / TIMELINE_TOTAL_BARS) * 100}% + 4px)` }}
            >
              {barIndex + 1}
            </button>
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
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="flex h-16">
          <div className="w-48 flex items-center justify-center gap-1.5 px-2 border-r border-outline-variant/20">
            <button
              type="button"
              onClick={() => onAddTrack('Instrument')}
              className="h-8 flex-1 flex items-center justify-center gap-1 border border-outline-variant/20 text-on-surface-variant hover:border-primary/60 hover:text-primary transition-colors"
              title="Add piano track"
            >
              <span className="material-symbols-outlined text-[16px]">piano</span>
              <span className="text-[8px] font-bold uppercase">Piano</span>
            </button>
            <button
              type="button"
              onClick={() => onAddTrack('Audio')}
              className="h-8 flex-1 flex items-center justify-center gap-1 border border-outline-variant/20 text-on-surface-variant hover:border-[#ff9ba4]/60 hover:text-[#ffb2ba] transition-colors"
              title="Add voice recording track"
            >
              <span className="material-symbols-outlined text-[16px]">mic</span>
              <span className="text-[8px] font-bold uppercase">Voice</span>
            </button>
          </div>
          <div
            ref={setHorizontalScrollRef(1)}
            onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
            className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar"
          >
            <div className="h-full border-b border-outline-variant/5" style={{ width: `${timelineContentWidth}px` }}></div>
          </div>
        </div>

        {tracks.map((track, trackIndex) => {
          const isMuted = track.muted === true;
          const isSoloed = track.soloed === true;

          return (
            <div
              key={track.id}
              className={`h-28 flex border-b border-outline-variant/5 ${isMuted ? 'opacity-55' : ''} ${selectedTrackId === track.id ? 'bg-surface-container-high/70' : 'bg-surface-container-low/50'}`}
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
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleTrackMute(track.id);
                  }}
                  className={`w-6 h-4 flex items-center justify-center text-[8px] font-bold border ${isMuted ? 'bg-[#ff6a5c] text-black border-[#ff9a90]' : 'bg-surface-bright border-transparent hover:border-[#ff6a5c]/50'}`}
                  title="Mute track"
                >
                  M
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleTrackSolo(track.id);
                  }}
                  className={`w-6 h-4 flex items-center justify-center text-[8px] font-bold border ${isSoloed ? 'bg-[#66d0ff] text-black border-[#a8e6ff]' : 'bg-surface-bright border-transparent hover:border-[#66d0ff]/50'}`}
                  title="Solo track"
                >
                  S
                </button>
              </div>
            </div>

            <div
              ref={setHorizontalScrollRef(trackIndex + 2)}
              onScroll={(event) => syncHorizontalScroll(event.currentTarget)}
              className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar"
            >
            <div
              data-track-lane="1"
              onClick={() => onTrackClick(track.id)}
              onDoubleClick={(event) => onTrackLaneDoubleClick(event, track.id)}
              className={`relative h-full overflow-hidden ${track.type === 'Bus' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ width: `${timelineContentWidth}px` }}
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
                    {track.type === 'Bus'
                      ? 'Bus Track: Routing And Gain Control'
                      : track.type === 'Audio'
                        ? 'Voice Recording Track'
                        : 'Double Click Empty Lane To Create Clip'}
                  </span>
                </div>
              )}

              {track.clips.map((clip) => {
                const previewNotes = clip.notes;
                const previewTotalSteps = Math.max(1, clip.length * PIANO_STEPS_PER_BEAT);
                const previewPitches = previewNotes.map((note) => note.pitch);
                const previewMinPitch = previewPitches.length > 0 ? Math.min(...previewPitches) : 0;
                const previewMaxPitch = previewPitches.length > 0 ? Math.max(...previewPitches) : GRID_TOTAL_ROWS - 1;
                const previewPitchSpan = Math.max(1, previewMaxPitch - previewMinPitch);
                const previewBeatLineCount = Math.max(Math.floor(clip.length) - 1, 0);

                return (
                <div
                  key={clip.id}
                  data-clip="1"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => onClipMouseDown(event, track.id, clip)}
                  onDoubleClick={(event) => onClipDoubleClick(event, track.id, clip.id)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Delete' && event.key !== 'Backspace') {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteClip(track.id, clip.id);
                  }}
                  tabIndex={0}
                  className={`absolute top-3 bottom-3 border ${track.clipClass} backdrop-blur-[1px] overflow-hidden rounded-[2px] cursor-grab active:cursor-grabbing transition-[box-shadow,border-color] ${selectedTimelineClip?.trackId === track.id && selectedTimelineClip.clipId === clip.id ? 'ring-2 ring-primary/80 border-primary/90 z-10' : ''}`}
                  style={{
                    left: `${clip.start * TIMELINE_BEAT_WIDTH_PX}px`,
                    width: `${Math.max(clip.length * TIMELINE_BEAT_WIDTH_PX, 28)}px`,
                  }}
                  title="Drag to move. Double click to edit. Press Delete to remove."
                >
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: previewBeatLineCount }, (_, beatIndex) => {
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
                    clip.audioPreview && clip.audioPreview.length > 0 ? (
                      <div className="absolute inset-x-2 bottom-2 top-5 flex items-center gap-px pointer-events-none">
                        {clip.audioPreview.map((level, index) => (
                          <span
                            key={`audio-preview-${clip.id}-${index}`}
                            className="min-w-px flex-1 bg-[#ff9ba4]/85"
                            style={{ height: `${Math.max(8, Math.min(level, 1) * 100)}%` }}
                          ></span>
                        ))}
                      </div>
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-primary/80 uppercase tracking-wider">
                        {clip.audioDataUrl ? 'Recorded Voice' : 'Audio Clip'}
                      </span>
                    )
                  ) : clip.notes.length === 0 ? (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-primary/70 uppercase tracking-wider">
                      Empty
                    </span>
                  ) : (
                    <div className="absolute inset-0 pointer-events-none">
                      {previewNotes.map((note) => {
                        const normalizedPitch = previewPitchSpan === 1 ? 0.5 : (note.pitch - previewMinPitch) / previewPitchSpan;

                        return (
                        <span
                          key={`clip-note-${clip.id}-${note.id}`}
                          className="absolute bg-primary/85 rounded-[1px] shadow-[0_0_6px_rgba(244,255,198,0.25)]"
                          style={{
                            left: `${(note.start / previewTotalSteps) * 100}%`,
                            width: `${Math.max((note.length / previewTotalSteps) * 100, 0.45)}%`,
                            top: `${22 + normalizedPitch * 58}%`,
                            height: '4px',
                            minWidth: '3px',
                          }}
                        ></span>
                        );
                      })}
                    </div>
                  )}

                  <span
                    onMouseDown={(event) => onClipResizeMouseDown(event, track.id, clip)}
                    data-clip-resize="1"
                    className="absolute right-0 top-0 h-full w-2 bg-black/25 hover:bg-black/40 border-l border-white/20 cursor-ew-resize"
                    title="Resize clip length"
                  ></span>
                  {selectedTimelineClip?.trackId === track.id && selectedTimelineClip.clipId === clip.id && (
                    <button
                      type="button"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteClip(track.id, clip.id);
                      }}
                      className="absolute right-2 top-1 z-20 flex h-5 w-5 items-center justify-center bg-black/65 text-white hover:bg-error hover:text-black"
                      title="Delete clip"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  )}
                </div>
                );
              })}
            </div>
            </div>
            </div>
          );
        })}
      </div>

      <div className="h-48 bg-surface-container-low border-t border-outline-variant/20 flex gap-[2px] p-[2px]">
        <div className="w-20 bg-surface-container-high flex flex-col items-center py-2 relative">
          <span className="text-[8px] font-bold text-on-surface-variant uppercase mb-2">Master</span>
          <input
            type="range"
            min={-60}
            max={6}
            step={1}
            value={masterVolumeDb}
            onPointerDown={onMasterEditStart}
            onChange={(event) => onMasterVolumeChange(event.target.value)}
            className="flex-1 min-h-0 cursor-pointer accent-[#f4ffc6]"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            aria-label="Master volume"
          />
          <div className="mt-2 text-[9px] font-mono text-primary">{masterVolumeDb.toFixed(0)} dB</div>
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
