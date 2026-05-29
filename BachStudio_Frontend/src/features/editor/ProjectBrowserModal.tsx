import { useEffect, useState } from 'react';
import { deleteProjectFromBackend, formatDate, getAllBackendProjects, type ProjectData } from './fileUtils';

interface ProjectBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: ProjectData) => void;
}

export function ProjectBrowserModal({ isOpen, onClose, onSelectProject }: ProjectBrowserModalProps) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      void getAllBackendProjects()
        .then((allProjects) => {
          setProjects(allProjects);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  const handleDelete = async (projectName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm(`Delete "${projectName}"?`)) {
      const isDeleted = await deleteProjectFromBackend(projectName);
      if (isDeleted) {
        setProjects((prev) => prev.filter((p) => p.projectName !== projectName));
      }
    }
  };

  const handleSelectProject = (project: ProjectData) => {
    onSelectProject(project);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
      <div className="bg-[#1a1a1a] border border-outline-variant/20 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <div className="flex flex-col">
            <h2 className="text-lg font-black tracking-tight text-[#f4ffc6] uppercase">
              PROJECT BROWSER
            </h2>
            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} saved
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2c2c2c] transition-colors text-zinc-400 hover:text-white"
            title="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-zinc-500 font-mono text-sm uppercase tracking-widest">
                Loading projects...
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest mb-2">
                  No projects yet
                </p>
                <p className="text-zinc-600 text-xs">Save a project using Ctrl+S to see it here</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/10">
              {projects.map((project) => (
                <div
                  key={project.projectName}
                  onClick={() => handleSelectProject(project)}
                  className="px-6 py-4 hover:bg-[#252525] transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-[#f4ffc6] uppercase truncate">
                      {project.projectName}
                    </h3>
                    <div className="flex items-center gap-6 mt-2 text-xs text-zinc-500 font-mono">
                      <span>
                        <span className="text-zinc-600">BPM:</span> {project.bpm.toFixed(2)}
                      </span>
                      <span>
                        <span className="text-zinc-600">TRACKS:</span> {project.tracks.length}
                      </span>
                      <span>
                        <span className="text-zinc-600">SAVED:</span> {formatDate(project.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDelete(project.projectName, e)}
                      className="p-2 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete project"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                    <button className="px-4 py-2 bg-primary text-black font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#f4ffc6]/90 transition-colors">
                      LOAD
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant/20 bg-[#0f0f0f] flex items-center justify-between">
          <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest">
            Select a project to load
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-outline-variant/20 hover:bg-outline-variant/30 text-zinc-400 hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
