import { TRACK_TYPE_OPTIONS } from './constants';
import type { TrackType } from './types';

type AddTrackModalProps = {
  isOpen: boolean;
  selectedTrackType: TrackType;
  onClose: () => void;
  onAddTrack: () => void;
  onSelectTrackType: (value: TrackType) => void;
};

export function AddTrackModal({
  isOpen,
  selectedTrackType,
  onClose,
  onAddTrack,
  onSelectTrackType,
}: AddTrackModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] z-[110]">
      <div className="aspect-video w-[720px] bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant/30 flex flex-col">
        <div className="px-8 pt-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-on-surface uppercase">Add New Track</h2>
            <p className="text-[10px] font-mono text-on-surface-variant tracking-widest mt-1">SELECT SIGNAL SOURCE / ENGINE ARCHITECTURE</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-4 px-8 py-8">
          {TRACK_TYPE_OPTIONS.map((option) => {
            const isSelected = selectedTrackType === option.id;
            return (
              <button
                key={option.id}
                onClick={() => onSelectTrackType(option.id)}
                className={`text-left bg-surface-container group cursor-pointer hover:bg-surface-bright transition-all flex flex-col p-6 border ${isSelected ? 'border-primary' : 'border-transparent hover:border-outline-variant/50'}`}
              >
                <div className="flex-1 flex items-center justify-center mb-4">
                  <span className={`material-symbols-outlined text-4xl transition-colors ${isSelected ? 'text-primary' : 'text-on-surface-variant group-hover:text-white'}`}>
                    {option.icon}
                  </span>
                </div>
                <div className="mt-auto">
                  <h3 className="font-bold text-lg leading-none uppercase">{option.id}</h3>
                  <p className="text-[10px] font-mono text-zinc-500 mt-1">{option.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-8 pb-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-surface-container text-zinc-300 hover:bg-surface-bright font-mono text-[11px] uppercase"
          >
            Cancel
          </button>
          <button
            onClick={onAddTrack}
            className="px-5 py-2 bg-primary text-on-primary font-bold text-[11px] uppercase tracking-widest"
          >
            Add Track
          </button>
        </div>
      </div>
    </div>
  );
}
