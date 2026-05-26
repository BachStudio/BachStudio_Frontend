import { useState, useEffect } from 'react';
import { getAllProjects } from '../editor/fileUtils';

type NewProjectModalProps = {
  isOpen: boolean;
  projectName: string;
  projectBpm: string;
  onClose: () => void;
  onStart: () => void;
  onProjectNameChange: (value: string) => void;
  onProjectBpmChange: (value: string) => void;
};

export function NewProjectModal({
  isOpen,
  projectName,
  projectBpm,
  onClose,
  onStart,
  onProjectNameChange,
  onProjectBpmChange,
}: NewProjectModalProps) {
  const [isDuplicateName, setIsDuplicateName] = useState(false);

  useEffect(() => {
    if (!projectName.trim()) {
      setIsDuplicateName(false);
      return;
    }

    const existingProjects = getAllProjects();
    const isDuplicate = existingProjects.some(
      (project) => project.projectName.toLowerCase() === projectName.trim().toLowerCase()
    );
    setIsDuplicateName(isDuplicate);
  }, [projectName]);

  if (!isOpen) {
    return null;
  }

  const isStartDisabled = isDuplicateName || !projectName.trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
          title="Close"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>

        <div className="space-y-7">
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">New Project</h1>
            <p className="text-on-surface-variant font-mono text-[10px] tracking-widest uppercase">Create an empty piano session</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Project Name</label>
              <input
                className="w-full bg-surface-container-highest border-0 border-b-2 focus:ring-0 text-primary font-mono text-sm px-3 py-3 transition-all outline-none"
                style={{
                  borderBottomColor: isDuplicateName ? '#ff6b6b' : 'rgba(244, 255, 198, 0.3)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderBottomColor = isDuplicateName ? '#ff6b6b' : 'rgba(244, 255, 198, 1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderBottomColor = isDuplicateName ? '#ff6b6b' : 'rgba(244, 255, 198, 0.3)';
                }}
                type="text"
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
              />
              {isDuplicateName && (
                <p className="text-red-500 font-mono text-[10px] uppercase tracking-widest">
                  이 프로젝트 이름은 이미 존재합니다
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tempo (BPM)</label>
              <div className="bg-surface-container-highest p-3 border-b-2 border-primary/30 w-40">
                <input
                  className="w-full bg-transparent border-0 focus:ring-0 text-primary font-mono text-lg font-bold p-0 outline-none"
                  type="number"
                  min={1}
                  value={projectBpm}
                  onChange={(event) => onProjectBpmChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          <button
            onClick={onStart}
            disabled={isStartDisabled}
            className={`w-full py-5 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all ${
              isStartDisabled
                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'
                : 'bg-primary text-on-primary hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            Initialize Session
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </button>
        </div>
      </div>
    </div>
  );
}
