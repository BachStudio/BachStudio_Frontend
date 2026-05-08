import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteProject, formatDate, getAllProjects } from '../editor/fileUtils';

export function ProjectManagerView() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [projects, setProjects] = useState(() => getAllProjects());

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return projects;
    }

    return projects.filter((project) => {
      return (
        project.projectName.toLowerCase().includes(normalizedSearch) ||
        String(project.bpm).includes(normalizedSearch) ||
        String(project.tracks.length).includes(normalizedSearch)
      );
    });
  }, [projects, searchText]);

  const refreshProjects = () => {
    setProjects(getAllProjects());
  };

  const handleDelete = (projectName: string) => {
    const isConfirmed = window.confirm(`Delete "${projectName}"?`);
    if (!isConfirmed) {
      return;
    }

    deleteProject(projectName);
    refreshProjects();
  };

  const handleLoad = (projectName: string, bpm: number) => {
    navigate(`/editor?projectName=${encodeURIComponent(projectName)}&bpm=${encodeURIComponent(String(bpm))}`);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f4ffc6] font-['Inter'] flex flex-col">
      <header className="bg-[#0e0e0e] text-[#f4ffc6] font-mono text-[11px] tracking-widest uppercase flex justify-between items-center w-full px-4 h-12 fixed top-0 z-50 border-b border-[#484847]/20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-1 hover:bg-[#2c2c2c] transition-colors cursor-pointer text-[#f4ffc6] flex items-center gap-1"
              title="Back to home"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              <span className="hidden sm:inline">BACK</span>
            </button>
            <span className="text-lg font-black tracking-tighter text-[#f4ffc6] uppercase cursor-pointer" onClick={() => navigate('/')}>Bach Studio</span>
          </div>

          <nav className="hidden md:flex gap-6">
            <span className="text-[#f4ffc6] border-b-2 border-[#f4ffc6] pb-1 cursor-default">File</span>
            <span className="text-zinc-500">Edit</span>
            <span className="text-zinc-500">Track</span>
            <span className="text-zinc-500">Mix</span>
            <span className="text-zinc-500">View</span>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="hover:bg-[#2c2c2c] transition-colors px-2 py-1 flex items-center">
            <span className="material-symbols-outlined text-[18px]">help</span>
          </button>
          <button className="hover:bg-[#2c2c2c] transition-colors px-2 py-1 flex items-center">
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button className="bg-primary text-on-primary font-bold px-4 py-1 scale-95 active:bg-[#f4ffc6] active:text-black transition-all cursor-pointer">
            Export
          </button>
        </div>
      </header>

      <main className="mt-12 mb-6 flex-grow bg-surface-container-lowest">
        <section className="relative min-h-[240px] w-full flex items-center px-12 py-10 overflow-hidden bg-surface-container-low border-b border-[#484847]/20">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,255,198,0.12),transparent_35%)]" />
          </div>

          <div className="relative z-20 max-w-2xl">
            <div className="inline-block bg-primary text-on-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">
              Project Browser: Active
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase leading-none mb-4">
              Project
              <span className="text-primary block">Manager</span>
            </h1>
            <p className="text-on-surface-variant font-body text-base max-w-lg leading-relaxed">
              Load, save, and organize your local Bach Studio sessions from one place. Pick a saved project to open it in the editor.
            </p>
          </div>

          <div className="relative z-20 ml-auto hidden lg:flex items-center gap-4">
            <button className="ghost-border text-white hover:bg-surface-bright px-5 py-3 uppercase text-xs font-bold transition-colors">
              Refresh
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-primary text-on-primary px-5 py-3 uppercase text-xs font-bold transition-colors active:scale-95"
            >
              New Project
            </button>
          </div>
        </section>

        <section className="px-6 md:px-12 py-6 border-b border-[#484847]/20 bg-surface-container">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
            <div className="flex items-center gap-3">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-primary">Active Projects</div>
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                {filteredProjects.length} saved
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-[#171717] border border-[#2d2d2d] px-3 py-2 flex items-center gap-2 min-w-[280px]">
                <span className="material-symbols-outlined text-[18px] text-zinc-500">search</span>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  type="text"
                  placeholder="Search projects"
                  className="w-full bg-transparent outline-none border-0 text-sm text-white placeholder:text-zinc-600"
                />
              </div>
              <button className="ghost-border text-zinc-300 hover:text-white px-4 py-2 uppercase text-xs font-bold transition-colors">
                Grid View
              </button>
            </div>

            <div className="ml-auto text-[10px] text-zinc-500 uppercase tracking-widest font-mono hidden xl:flex gap-4">
              <span>Sort: Last Edited</span>
              <span>Filter: All</span>
            </div>
          </div>
        </section>

        <div className="flex-1 overflow-auto p-6 md:p-12">
          {filteredProjects.length === 0 ? (
            <div className="ghost-border min-h-[320px] flex flex-col items-center justify-center text-center bg-surface-container-low">
              <span className="material-symbols-outlined text-5xl text-zinc-500 mb-4">folder_open</span>
              <h2 className="text-lg font-black uppercase tracking-[0.2em] text-white">No saved projects</h2>
              <p className="text-zinc-500 text-sm mt-2 max-w-md">
                Save a session in the editor, then it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
              {filteredProjects.map((project) => (
                <article key={project.projectName} className="bg-surface-container border border-outline/10 p-7 min-h-[360px] flex flex-col group transition-colors ghost-border">
                  <div className="flex justify-between items-start mb-4 gap-3">
                    <h3 className="font-black text-lg tracking-tight truncate flex-1 text-white">
                      {project.projectName}
                    </h3>
                    <span className="mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 whitespace-nowrap uppercase">
                      Local Save
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase text-zinc-500 font-bold">BPM</span>
                      <span className="mono text-sm font-bold text-white">{project.bpm.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase text-zinc-500 font-bold">Tracks</span>
                      <span className="mono text-sm font-bold text-white">{project.tracks.length}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase text-zinc-500 font-bold">Saved</span>
                      <span className="mono text-sm font-bold text-white">{formatDate(project.timestamp)}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold mono pt-4 border-t border-outline/10">
                    <span>Status: <span className="text-primary">Saved</span></span>
                    <span>Local Storage</span>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => handleLoad(project.projectName, project.bpm)}
                      className="flex-1 bg-primary text-black py-3 font-black text-[10px] tracking-widest uppercase active:scale-95 transition-transform"
                    >
                      Load Project
                    </button>
                    <button
                      onClick={() => handleDelete(project.projectName)}
                      className="w-10 bg-surface-bright flex items-center justify-center hover:bg-[#3a3a3a] transition-colors border border-outline/10 text-zinc-400 hover:text-white"
                      title="Delete project"
                    >
                      <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-12 flex flex-col items-center justify-center py-8">
            <button
              onClick={() => navigate('/')}
              className="mb-4 p-8 border-2 border-dashed border-outline/20 rounded-lg hover:border-primary/40 transition-colors bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-4xl text-zinc-500">add</span>
            </button>
            <p className="text-zinc-500 text-sm uppercase tracking-wider font-bold">Start New Session</p>
          </div>
        </div>
      </main>

      <footer className="bg-[#0e0e0e] text-zinc-500 font-mono text-[9px] uppercase tracking-tighter fixed bottom-0 w-full flex justify-between items-center px-4 h-6 border-t border-[#484847]/20 z-50">
        <div>Bach Studio Engine v2.4 | Projects: {projects.length}</div>
        <div className="flex gap-4">
          <span className="hover:text-white cursor-default">Storage: Local</span>
          <span className="hover:text-white cursor-default">44.1kHz</span>
          <span className="text-[#f4ffc6]">24-bit</span>
        </div>
      </footer>
    </div>
  );
}
