/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Folder, 
  Compass, 
  Puzzle, 
  Music, 
  History, 
  Brain, 
  Search, 
  Bell, 
  Settings, 
  Plus, 
  MoreHorizontal,
  AudioLines,
  HelpCircle,
  LogOut,
  MousePointer2,
  Scissors,
  Pencil,
  VolumeX,
  ZoomIn,
  ArrowLeftRight,
  Grid,
  Link as LinkIcon,
  Activity,
  Cpu,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type View = 'projects' | 'editor';

interface Project {
  id: string;
  title: string;
  sampleRate: string;
  bpm: string;
  key: string;
  tracks: number;
  status: 'Editing' | 'Completed' | 'Archived';
  lastEdited: string;
}

// --- Mock Data ---

const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    title: 'Symphony No. 5 - Mumble Mix',
    sampleRate: '48kHz / 24bit',
    bpm: '124.00',
    key: 'Cm',
    tracks: 42,
    status: 'Editing',
    lastEdited: '2h ago'
  },
  {
    id: '2',
    title: 'Neon Horizon - Radio Edit',
    sampleRate: '96kHz',
    bpm: '128.00',
    key: 'G#M',
    tracks: 116,
    status: 'Completed',
    lastEdited: '1d ago'
  },
  {
    id: '3',
    title: 'Lo-Fi Study Session #4',
    sampleRate: '44.1kHz',
    bpm: '88.00',
    key: 'Dm',
    tracks: 12,
    status: 'Archived',
    lastEdited: '5d ago'
  }
];

// --- Shared Components ---

const TopNav = ({ view, setView, activeProject }: { view: View, setView: (v: View) => void, activeProject?: Project | null }) => (
  <header className="bg-background text-primary font-mono text-[11px] tracking-widest uppercase flex justify-between items-center w-full px-4 h-12 fixed top-0 z-50 border-b border-outline/10">
    <div className="flex items-center gap-8">
      <div className="flex items-center gap-4">
        {view === 'editor' && (
          <button 
            onClick={() => setView('projects')}
            className="p-1 hover:bg-surface-bright transition-colors cursor-pointer text-primary flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">BACK</span>
          </button>
        )}
        <span 
          className="text-lg font-black tracking-tighter text-primary uppercase cursor-pointer"
          onClick={() => setView('projects')}
        >
          Bach Studio
        </span>
      </div>
      
      {view === 'editor' && activeProject && (
        <div className="hidden lg:flex items-center gap-4 px-4 border-l border-outline/20">
          <span className="text-white font-bold">{activeProject.title}</span>
          <span className="text-zinc-500">[{activeProject.bpm} BPM / {activeProject.key}]</span>
        </div>
      )}

      <nav className="hidden md:flex gap-6">
        <button className={`pb-1 transition-colors cursor-pointer ${view === 'projects' ? 'border-b-2 border-primary' : 'text-zinc-500 hover:text-primary'}`} onClick={() => setView('projects')}>File</button>
        <button className="text-zinc-500 hover:text-primary transition-colors cursor-pointer">Edit</button>
        <button className="text-zinc-500 hover:text-primary transition-colors cursor-pointer">Track</button>
        <button className="text-zinc-500 hover:text-primary transition-colors cursor-pointer">Mix</button>
      </nav>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1 bg-surface px-3 py-1 text-zinc-400">
        <Search size={14} />
        <input className="bg-transparent border-none focus:ring-0 text-[10px] uppercase w-32 outline-none" placeholder="SEARCH TOOLS" type="text"/>
      </div>
      <div className="flex gap-2">
        <button className="hover:bg-surface-bright p-1 transition-colors cursor-pointer"><HelpCircle size={18} /></button>
        <button className="hover:bg-surface-bright p-1 transition-colors cursor-pointer"><Settings size={18} /></button>
        <button className="bg-primary text-black px-4 py-1 font-bold text-[10px] scale-95 active:scale-90 transition-all cursor-pointer">EXPORT</button>
      </div>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-background text-zinc-500 font-mono text-[9px] uppercase tracking-tighter fixed bottom-0 w-full flex justify-between items-center px-4 h-6 border-t border-outline/20 z-50">
    <div className="flex items-center gap-4">
      <span>Bach Studio Engine v2.4</span>
      <span className="flex items-center gap-1"><Cpu size={10} /> CPU: 14%</span>
      <span className="flex items-center gap-1"><Activity size={10} /> RAM: 2.4GB</span>
    </div>
    <div className="flex gap-4">
      <span className="text-primary">Buffer: 128</span>
      <span className="hover:text-white transition-colors cursor-pointer">44.1kHz</span>
      <span className="hover:text-white transition-colors cursor-pointer">24-bit</span>
    </div>
  </footer>
);

// --- Views ---

const ProjectManager = ({ onSelectProject }: { onSelectProject: (p: Project) => void }) => (
  <div className="flex flex-1 overflow-hidden pt-12">
    {/* Sidebar - Sonic Blueprint Style */}
    <aside className="bg-surface w-64 border-r border-outline/10 flex flex-col py-6">
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary flex items-center justify-center">
          <AudioLines size={20} className="text-black" strokeWidth={3} />
        </div>
        <div>
          <div className="text-primary font-black text-sm tracking-tight uppercase">Projects</div>
          <div className="text-[9px] text-primary/50 tracking-widest font-bold">MANAGER V3.4.0</div>
        </div>
      </div>
      
      <nav className="flex-1 space-y-1">
        <div className="flex items-center px-6 py-3 gap-4 text-primary bg-[#20201f] border-l-2 border-primary uppercase text-[11px] font-bold tracking-wider cursor-pointer">
          <Folder size={18} />
          <span>All Projects</span>
        </div>
        <div className="flex items-center px-6 py-3 gap-4 text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all uppercase text-[11px] font-bold tracking-wider">
          <Compass size={18} />
          <span>Browser</span>
        </div>
        <div className="flex items-center px-6 py-3 gap-4 text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all uppercase text-[11px] font-bold tracking-wider">
          <Puzzle size={18} />
          <span>Plugins</span>
        </div>
        <div className="flex items-center px-6 py-3 gap-4 text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all uppercase text-[11px] font-bold tracking-wider">
          <Music size={18} />
          <span>Instruments</span>
        </div>
        <div className="flex items-center px-6 py-3 gap-4 text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all uppercase text-[11px] font-bold tracking-wider">
          <History size={18} />
          <span>History</span>
        </div>
        <div className="flex items-center px-6 py-3 gap-4 text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all uppercase text-[11px] font-bold tracking-wider">
          <Brain size={18} />
          <span>AI Tools</span>
        </div>
      </nav>

      <div className="px-6 mt-auto space-y-4">
        <button className="w-full bg-primary text-black py-3 font-black text-[10px] tracking-widest uppercase active:scale-95 transition-transform cursor-pointer">
          NEW PROJECT
        </button>
        <div className="pt-6 border-t border-outline/20 space-y-1">
          <div className="text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all flex items-center py-2 gap-4 uppercase text-[11px] font-bold tracking-wider">
            <HelpCircle size={18} />
            <span>Help</span>
          </div>
          <div className="text-zinc-500 hover:text-primary hover:bg-[#20201f] cursor-pointer transition-all flex items-center py-2 gap-4 uppercase text-[11px] font-bold tracking-wider">
            <LogOut size={18} />
            <span>Logout</span>
          </div>
        </div>
      </div>
    </aside>

    {/* Main Content - Sonic Blueprint Style */}
    <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-background">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Active Projects</h2>
          <div className="flex items-center bg-surface p-1 border border-outline/10">
            <button className="px-4 py-1.5 text-[10px] font-black bg-primary text-black">GRID VIEW</button>
            <button className="px-4 py-1.5 text-[10px] font-black text-[#adaaaa] hover:text-white transition-colors">LIST VIEW</button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[#adaaaa] uppercase tracking-widest font-black">Filter:</span>
            <div className="flex gap-1">
              {['Mixed', 'Draft', 'Live'].map(f => (
                <span key={f} className="px-2 py-0.5 border border-outline/20 text-[9px] uppercase hover:border-primary/50 cursor-pointer text-[#adaaaa] hover:text-white font-bold transition-colors">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#adaaaa] uppercase tracking-widest font-black">Sort By:</span>
            <select className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-white focus:ring-0 cursor-pointer p-0 appearance-none">
              <option>Last Edited</option>
              <option>Creation Date</option>
              <option>Project Name</option>
              <option>Tempo (BPM)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {MOCK_PROJECTS.map(project => (
          <motion.div 
            key={project.id}
            whileHover={{ borderColor: 'rgba(244, 255, 198, 0.3)' }}
            className="bg-surface-card border border-outline/10 p-6 flex flex-col group transition-colors cursor-pointer"
            onClick={() => onSelectProject(project)}
          >
            <div className="flex justify-between items-start mb-4">
              <h4 className="font-black text-lg tracking-tight truncate flex-1">{project.title}</h4>
              <span className="mono text-[10px] text-primary bg-primary/10 px-2 py-0.5 ml-2 whitespace-nowrap">{project.sampleRate}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-[#adaaaa] font-bold">BPM</span>
                <span className="mono text-xs font-bold">{project.bpm}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-[#adaaaa] font-bold">Key</span>
                <span className="mono text-xs font-bold">{project.key}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase text-[#adaaaa] font-bold">Tracks</span>
                <span className="mono text-xs font-bold">{project.tracks}</span>
              </div>
            </div>
            <div className="mt-auto flex items-center justify-between text-[10px] text-[#adaaaa] uppercase font-bold mono">
              <span>Status: <span className="text-primary">{project.status}</span></span>
              <span>{project.lastEdited}</span>
            </div>
            <div className="mt-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="flex-1 bg-primary/5 border border-primary/20 py-2 text-[10px] font-black uppercase tracking-[0.15em] hover:bg-primary hover:text-black transition-all">
                LOAD PROJECT
              </button>
              <button className="w-10 bg-surface-bright flex items-center justify-center hover:bg-[#3a3a3a] transition-colors border border-outline/10">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </motion.div>
        ))}
        <div className="border border-dashed border-outline/20 flex flex-col items-center justify-center min-h-[240px] hover:border-primary/40 transition-colors cursor-pointer group bg-surface/30">
          <Plus size={24} className="text-outline group-hover:text-primary transition-colors mb-2" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#adaaaa] group-hover:text-primary transition-colors">Start New Session</span>
        </div>
      </div>
    </main>
  </div>
);

const PianoRollEditor = () => (
  <div className="flex flex-1 overflow-hidden pt-12">
    {/* Tools Sidebar - Bach Studio Style */}
    <aside className="bg-surface w-16 border-r border-outline/10 flex flex-col items-center py-4 space-y-1 z-40">
      <div className="mb-4 text-center">
        <p className="text-[10px] font-bold uppercase text-primary">TOOLS</p>
        <p className="text-[8px] text-zinc-600 uppercase">V1.0</p>
      </div>
      <button className="w-12 h-12 flex flex-col items-center justify-center bg-[#20201f] text-primary border-l-2 border-primary transition-all">
        <MousePointer2 size={18} />
        <span className="text-[8px] font-bold mt-1 uppercase">Select</span>
      </button>
      {[
        { icon: Scissors, label: 'Cut' },
        { icon: Pencil, label: 'Draw' },
        { icon: VolumeX, label: 'Mute' },
        { icon: ZoomIn, label: 'Zoom' },
        { icon: ArrowLeftRight, label: 'Slip' }
      ].map(tool => (
        <button key={tool.label} className="w-12 h-12 flex flex-col items-center justify-center text-zinc-600 hover:bg-surface-bright transition-all">
          <tool.icon size={18} />
          <span className="text-[8px] font-bold mt-1 uppercase">{tool.label}</span>
        </button>
      ))}
    </aside>

    <main className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Context Toolbar */}
      <div className="h-10 bg-surface flex items-center px-4 gap-6 border-b border-outline/10">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase text-[#adaaaa]">Quantize</span>
          <div className="flex bg-[#262626]">
            <button className="px-2 py-1 text-[9px] font-mono text-primary bg-surface-bright">1/16</button>
            <button className="px-2 py-1 text-[9px] font-mono text-[#adaaaa] hover:text-white">1/8</button>
            <button className="px-2 py-1 text-[9px] font-mono text-[#adaaaa] hover:text-white">1/4</button>
          </div>
        </div>
        <div className="h-4 w-[1px] bg-outline/30"></div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 px-2 py-1 bg-primary text-black text-[9px] font-bold uppercase">
            <Grid size={12} /> Snap
          </button>
          <button className="flex items-center gap-1 px-2 py-1 text-[#adaaaa] text-[9px] font-bold uppercase border border-outline/20 hover:bg-surface-bright">
            <LinkIcon size={12} /> Legato
          </button>
        </div>
        <div className="flex-1"></div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-primary">
          <span className="text-[#adaaaa]">POS:</span> 004.01.000
          <span className="text-[#adaaaa]">BPM:</span> 128.00
        </div>
      </div>

      {/* Piano Roll Editor Core */}
      <div className="flex-1 flex overflow-hidden">
        {/* Piano Keys */}
        <div className="w-20 flex-shrink-0 bg-[#262626] overflow-y-auto scrollbar-hide border-r border-outline/20">
          <div className="relative w-full">
            {Array.from({ length: 24 }).map((_, i) => {
              const note = 24 - i;
              const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
              const label = note % 12 === 0 ? `C${Math.floor(note / 12)}` : null;
              
              return isBlack ? (
                <div key={i} className="piano-key-black"></div>
              ) : (
                <div key={i} className="piano-key-white flex items-end justify-end px-1 pb-1">
                  {label && <span className="text-[8px] text-black font-bold uppercase">{label}</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Note Grid */}
        <div className="flex-1 relative overflow-auto piano-grid">
          <div className="absolute top-0 bottom-0 left-64 w-[2px] bg-primary z-30 shadow-[0_0_10px_rgba(244,255,198,0.5)]"></div>
          
          {/* MIDI Notes */}
          <div className="absolute top-[24px] left-[40px] w-40 h-5 bg-primary text-black flex items-center px-2 text-[9px] font-bold border-l-2 border-primary-container">E4</div>
          <div className="absolute top-[72px] left-[80px] w-20 h-5 bg-primary/80 text-black flex items-center px-2 text-[9px] font-bold border-l-2 border-primary-container">C4</div>
          <div className="absolute top-[120px] left-[160px] w-60 h-5 bg-primary text-black flex items-center px-2 text-[9px] font-bold border-l-2 border-primary-container">G3</div>
          <div className="absolute top-[168px] left-[240px] w-40 h-5 bg-primary/90 text-black flex items-center px-2 text-[9px] font-bold border-l-2 border-primary-container">E3</div>
        </div>
      </div>

      {/* Velocity Panel */}
      <div className="h-24 bg-[#20201f] border-t border-outline/20 flex flex-col">
        <div className="px-4 py-1 flex items-center justify-between">
          <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">Velocity Controller</span>
          <span className="text-[8px] font-mono text-primary uppercase">Value: 104</span>
        </div>
        <div className="flex-1 flex items-end px-20 gap-[2px] pb-2 overflow-x-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div 
              key={i} 
              className="w-1 bg-primary" 
              style={{ height: `${Math.random() * 80 + 20}%`, opacity: Math.random() * 0.8 + 0.2 }}
            ></div>
          ))}
        </div>
      </div>
    </main>
  </div>
);

export default function App() {
  const [view, setView] = useState<View>('projects');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setView('editor');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background font-sans selection:bg-primary selection:text-black overflow-hidden">
      <TopNav view={view} setView={setView} activeProject={activeProject} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {view === 'projects' && <ProjectManager onSelectProject={handleSelectProject} />}
            {view === 'editor' && <PianoRollEditor />}
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
