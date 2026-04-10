import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import * as Tone from 'tone';

function LandingView({ onStartProject }: { onStartProject: () => void }) {
  return (
    <>
      <header className="bg-[#0e0e0e] text-[#f4ffc6] font-['Inter'] font-mono text-[11px] tracking-widest uppercase flex justify-between items-center w-full px-4 h-12 fixed top-0 z-50 border-b-0">
        <div className="flex items-center gap-8">
          <span className="text-lg font-black tracking-tighter text-[#f4ffc6] uppercase">Bach Studio</span>
          <nav className="hidden md:flex gap-6">
            <a className="text-[#f4ffc6] border-b-2 border-[#f4ffc6] pb-1 hover:bg-[#2c2c2c] transition-colors" href="#">File</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors" href="#">Edit</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors" href="#">Track</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors" href="#">Mix</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors" href="#">View</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="hover:bg-[#2c2c2c] transition-colors px-2 py-1 flex items-center">
            <span className="material-symbols-outlined text-[18px]">help</span> 
          </button>
          <button className="hover:bg-[#2c2c2c] transition-colors px-2 py-1 flex items-center">
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>
          <button className="bg-primary text-on-primary font-bold px-4 py-1 scale-95 active:bg-[#f4ffc6] active:text-black transition-all">
                          Export
                      </button>
        </div>
      </header>

      <main className="mt-12 mb-6 flex-grow bg-surface-container-lowest">       
        <section className="relative h-[665px] w-full flex items-center px-12 overflow-hidden bg-surface-container-low">
          <div className="absolute inset-0 opacity-20 pointer-events-none">     
            <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent z-10"></div>
            <img alt="Studio visual" className="w-full h-full object-cover" data-alt="Close-up of a professional mixing console in a dark studio with glowing green and yellow LEDs and linear sliders" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCFWzRwm6I-E5r6oNpHmyOHv85zK6o9XHgxX6M7GhxftZApeQ5K970Iv0jNSxMMKFKFrRf_jrIWVnH7oPDle3vlduHAfP_YMGT9AwlmpwQiLr5euofb1kIKUCAfET0RZP_PADNmch61O-MTIMlaNEgN8sK8EFvkBVWmgSpZFSJwqYYPNv2AJ8eWtljX8itV3sKayP9TiYl684ZfVC9ibreRTODBclojyMKGmHv8sb0NYy_uP6IhJh6uowJAGJyf8_K1IOobZxgcHwhn"/>
          </div>
          <div className="relative z-20 max-w-2xl">
            <div className="inline-block bg-primary text-on-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">
                              Signal Processing: Active
                          </div>
            <h1 className="text-6xl font-headline font-black tracking-tighter text-white uppercase leading-none mb-6">
                              Your Voice,<br/><span className="text-primary">Into Music.</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg mb-8 max-w-lg leading-relaxed">
                              Professional Mumble-to-MIDI technology for composers. Record, convert, and refine in real-time with zero-latency engine.
                          </p>
            <div className="flex gap-4">
              <button onClick={onStartProject} className="bg-primary text-on-primary font-bold px-8 py-4 uppercase text-sm flex items-center gap-3 active:scale-95 transition-transform">
                                  Start New Project
                                  <span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 1"}}>play_arrow</span>
              </button>
              <button className="ghost-border text-white hover:bg-surface-bright px-8 py-4 uppercase text-sm font-bold transition-colors">
                                  View Documentation
                              </button>
            </div>
          </div>
        </section>

        <section className="p-4 grid grid-cols-12 gap-1 auto-rows-[240px]">     
          <div className="col-span-12 md:col-span-8 bg-surface-container flex flex-col p-8 ghost-border relative overflow-hidden group">
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-3 text-primary mb-4">       
                <span className="material-symbols-outlined">settings_voice</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest">Core Engine</span>
              </div>
              <h3 className="text-3xl font-black text-white uppercase mb-4 max-w-md">AI Transcription</h3>
              <p className="text-on-surface-variant text-sm max-w-sm">
                                  Our neural network converts vocal melodies, beatboxing, and hummed riffs into clean, quantizable MIDI data instantly. No more lost ideas.
                              </p>
              <div className="mt-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>     
                <span className="font-mono text-[9px] text-primary uppercase">Analyzing Harmonic Spectrum...</span>
              </div>
            </div>
            <div className="absolute right-0 top-0 w-1/2 h-full opacity-30 group-hover:opacity-50 transition-opacity">
              <img alt="Visual wave" className="w-full h-full object-cover" data-alt="Digital representation of complex audio wave frequencies in neon lime green on a black background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC77VFQx7AwNsy4Qae_SKe2bb321Fpu8jYJxu46ERRFZtRf9UcPkBR1JQtqAtAdCf_4opJZgAhiv0IUUrqQzHhoARaE0zGQRxEQjRkD626xKO1QWgO7njW6iTyHZDYt4gu1affclMCFOHm7FQSEA_0iPpBmaxcTLdipmUQNQF5GpI0OCOFIPEmLSe3bg_AqP0ARWamBl3d_h_s9IUbFYLIWnhSocA2DqRy3sC2XO5_fqDJsPxKJG6szRQTvTu7i-y4cXC82h5FTkgo0"/>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 bg-surface-container-high p-8 ghost-border flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-primary mb-4">analytics</span>
              <h3 className="text-xl font-black text-white uppercase mb-2">Real-Time Analysis</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">   
                                  Instant key detection and spectral visualization. Watch your voice become structured notation as you perform.
                              </p>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 bg-surface-container-low p-8 ghost-border flex flex-col">
            <span className="material-symbols-outlined text-primary mb-4">settings_input_component</span>
            <h3 className="text-xl font-black text-white uppercase mb-2">VST Support</h3>
            <p className="text-on-surface-variant text-xs leading-relaxed mb-6">
                              Route MIDI directly to your favorite third-party synthesizers and orchestral libraries.
                          </p>
          </div>
          <div className="col-span-12 md:col-span-8 bg-surface-container flex items-center p-8 ghost-border gap-8 overflow-hidden">
            <div className="flex-shrink-0 w-48 h-full bg-surface-container-lowest border border-outline-variant/20 flex flex-col p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="font-mono text-[9px] uppercase">Input Gain</span>
                <span className="text-primary font-mono text-[9px] uppercase">+4.5dB</span>
              </div>
            </div>
            <div className="flex-grow">
              <h3 className="text-2xl font-black text-white uppercase mb-4">Modular Workflow</h3>
              <p className="text-on-surface-variant text-sm max-w-md">
                                  Chain effects and processors just like hardware. Our rack-based architecture allows for infinite signal routing and precision tweaking.
                              </p>
            </div>
          </div>
        </section>

        <section className="px-12 py-24 bg-surface flex flex-col items-center text-center">
          <h2 className="text-4xl font-black uppercase text-white tracking-tight mb-4">Ready to Compose?</h2>
          <p className="text-on-surface-variant mb-10 max-w-xl">
                          Experience the world's most advanced vocal-to-MIDI engine. Join thousands of composers using Bach Studio to bridge the gap between imagination and instrumentation.
                      </p>
          <div className="bg-primary p-[1px] group active:scale-95 transition-transform">
            <button className="bg-surface hover:bg-primary hover:text-black transition-colors px-12 py-5 font-black uppercase text-lg text-primary">
                                Create Free Account
                            </button>
          </div>
        </section>
      </main>

      <footer className="bg-[#0e0e0e] text-[#f4ffc6] font-mono text-[9px] uppercase tracking-tighter text-zinc-500 fixed bottom-0 w-full flex justify-between items-center px-4 h-6 border-t border-[#484847]/20 z-50">
        <div>Bach Studio Engine v2.4 | CPU: 14% | RAM: 2.4GB</div>
        <div className="flex gap-4">
          <span className="hover:text-white cursor-default">Buffer: 128</span>  
          <span className="hover:text-white cursor-default">44.1kHz</span>      
          <span className="text-[#f4ffc6]">24-bit</span>
        </div>
      </footer>
    </>
  );
}

function MainEditor() {
  const [searchParams] = useSearchParams();
  const [isAICoreVisible, setIsAICoreVisible] = useState(false);
  const [isAddTrackModalOpen, setIsAddTrackModalOpen] = useState(false);
  const [isPianoRollOpen, setIsPianoRollOpen] = useState(false);
  const [activePianoTrackId, setActivePianoTrackId] = useState<number | null>(null);
  const [selectedTrackType, setSelectedTrackType] = useState('Instrument');
  const [tracks, setTracks] = useState<Array<{ id: number; type: string; name: string; icon: string; clipClass: string; notes: Array<{ id: number; start: number; pitch: number; length: number }> }>>([]);
  const [pianoTool, setPianoTool] = useState<'select' | 'draw'>('select');
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);
  const [dragState, setDragState] = useState<null | {
    noteIds: number[];
    origins: Array<{ id: number; start: number; pitch: number; length: number }>;
    mode: 'move' | 'resize';
    startClientX: number;
    startClientY: number;
  }>(null);
  const [selectionBox, setSelectionBox] = useState<null | {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  }>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pianoKeysRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const samplerRef = useRef<Tone.Sampler | null>(null);

  const projectName = searchParams.get('projectName') ?? 'SESSION_2023_X4';
  const bpmRaw = Number.parseFloat(searchParams.get('bpm') ?? '128');
  const bpmLabel = Number.isFinite(bpmRaw) ? bpmRaw.toFixed(2) : '128.00';
  const MIDI_LOW = 21;
  const MIDI_HIGH = 108;
  const GRID_COL_WIDTH = 40;
  const GRID_ROW_HEIGHT = 24;
  const GRID_TOTAL_ROWS = MIDI_HIGH - MIDI_LOW + 1;
  const GRID_TOTAL_COLS = 160;
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

  const pianoRows = Array.from({ length: GRID_TOTAL_ROWS }, (_, row) => {
    const midi = MIDI_HIGH - row;
    const semitone = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const isBlack = BLACK_SEMITONES.has(semitone);
    const label = semitone === 0 || midi === MIDI_LOW || midi === MIDI_HIGH ? `${NOTE_NAMES[semitone]}${octave}` : '';
    return { row, isBlack, label };
  });

  const activeTrack = tracks.find((track) => track.id === activePianoTrackId) ?? null;
  const activeTrackName = activeTrack?.name ?? 'TRACK';
  const activeTrackNotes = activeTrack?.notes ?? [];

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const pitchToMidi = (pitch: number) => MIDI_HIGH - pitch;
  const pitchToNoteName = (pitch: number) => Tone.Frequency(pitchToMidi(pitch), 'midi').toNote();

  const ensurePianoSampler = async () => {
    await Tone.start();

    if (!samplerRef.current) {
      samplerRef.current = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3',
          C1: 'C1.mp3',
          'D#1': 'Ds1.mp3',
          'F#1': 'Fs1.mp3',
          A1: 'A1.mp3',
          C2: 'C2.mp3',
          'D#2': 'Ds2.mp3',
          'F#2': 'Fs2.mp3',
          A2: 'A2.mp3',
          C3: 'C3.mp3',
          'D#3': 'Ds3.mp3',
          'F#3': 'Fs3.mp3',
          A3: 'A3.mp3',
          C4: 'C4.mp3',
          'D#4': 'Ds4.mp3',
          'F#4': 'Fs4.mp3',
          A4: 'A4.mp3',
          C5: 'C5.mp3',
          'D#5': 'Ds5.mp3',
          'F#5': 'Fs5.mp3',
          A5: 'A5.mp3',
          C6: 'C6.mp3',
          'D#6': 'Ds6.mp3',
          'F#6': 'Fs6.mp3',
          A6: 'A6.mp3',
          C7: 'C7.mp3',
          'D#7': 'Ds7.mp3',
          'F#7': 'Fs7.mp3',
          A7: 'A7.mp3',
          C8: 'C8.mp3',
        },
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
      }).toDestination();
      await Tone.loaded();
    }

    return samplerRef.current;
  };

  const triggerPianoPreview = async (pitch: number, durationSeconds = 0.35) => {
    try {
      const sampler = await ensurePianoSampler();
      sampler.triggerAttackRelease(pitchToNoteName(pitch), durationSeconds);
    } catch {
      // Ignore audio context errors until the browser allows a valid gesture.
    }
  };

  useEffect(() => {
    return () => {
      samplerRef.current?.dispose();
      samplerRef.current = null;
    };
  }, []);

  const updateActiveTrackNotes = (updater: (notes: Array<{ id: number; start: number; pitch: number; length: number }>) => Array<{ id: number; start: number; pitch: number; length: number }>) => {
    if (activePianoTrackId === null) {
      return;
    }

    setTracks((prev) =>
      prev.map((track) => (track.id === activePianoTrackId ? { ...track, notes: updater(track.notes) } : track)),
    );
  };

  const getPointerInGrid = (clientX: number, clientY: number) => {
    if (!gridRef.current) {
      return { x: 0, y: 0 };
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left + gridRef.current.scrollLeft;
    const y = clientY - rect.top + gridRef.current.scrollTop;

    return {
      x: clamp(Math.floor(x), 0, GRID_TOTAL_COLS * GRID_COL_WIDTH),
      y: clamp(Math.floor(y), 0, GRID_TOTAL_ROWS * GRID_ROW_HEIGHT),
    };
  };

  const syncVerticalScroll = (source: 'grid' | 'keys') => {
    if (!gridRef.current || !pianoKeysRef.current || isSyncingScrollRef.current) {
      return;
    }

    isSyncingScrollRef.current = true;
    if (source === 'grid') {
      pianoKeysRef.current.scrollTop = gridRef.current.scrollTop;
    } else {
      gridRef.current.scrollTop = pianoKeysRef.current.scrollTop;
    }

    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const trackTypeOptions = [
    { id: 'Instrument', icon: 'piano', subtitle: 'Synth / MIDI Architecture' },
    { id: 'Drums', icon: 'album', subtitle: 'Sampler / Kit Matrix' },
    { id: 'Audio', icon: 'mic', subtitle: 'Recorded / Live Signal Path' },
    { id: 'Bus', icon: 'route', subtitle: 'Routing / Group Channel' },
  ];

  const handleAddTrack = () => {
    const selectedOption = trackTypeOptions.find((option) => option.id === selectedTrackType) ?? trackTypeOptions[0];
    const clipClassByType: Record<string, string> = {
      Instrument: 'bg-primary/10 border-primary/20',
      Drums: 'bg-secondary/10 border-secondary/20',
      Audio: 'bg-error/10 border-error/20',
      Bus: 'bg-tertiary/10 border-tertiary/20',
    };

    setTracks((prev) => {
      const nextIndex = prev.length + 1;
      const createdTrack = {
        id: Date.now() + nextIndex,
        type: selectedOption.id,
        name: `${String(nextIndex).padStart(2, '0')} ${selectedOption.id.toUpperCase()} TRACK`,
        icon: selectedOption.icon,
        clipClass: clipClassByType[selectedOption.id] ?? 'bg-primary/10 border-primary/20',
        notes: [],
      };
      return [...prev, createdTrack];
    });

    setIsAddTrackModalOpen(false);
  };

  const handleTrackDoubleClick = (trackId: number) => {
    setActivePianoTrackId(trackId);
    setPianoTool('select');
    setSelectedNoteIds([]);
    setIsPianoRollOpen(true);
  };

  const handleGridMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !activeTrack || !gridRef.current) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.dataset.note === '1' || target.closest('[data-note="1"]')) {
      return;
    }

    if (pianoTool === 'select') {
      event.preventDefault();
      const pointer = getPointerInGrid(event.clientX, event.clientY);
      setSelectedNoteIds([]);
      setSelectionBox({
        startX: pointer.x,
        startY: pointer.y,
        currentX: pointer.x,
        currentY: pointer.y,
      });
      return;
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + gridRef.current.scrollLeft;
    const y = event.clientY - rect.top + gridRef.current.scrollTop;
    const snappedStart = Math.max(0, Math.floor(x / GRID_COL_WIDTH));
    const snappedPitch = clamp(Math.floor(y / GRID_ROW_HEIGHT), 0, GRID_TOTAL_ROWS - 1);
    const createdId = Date.now() + activeTrackNotes.length;

    updateActiveTrackNotes((notes) => [
      ...notes,
      {
        id: createdId,
        start: snappedStart,
        pitch: snappedPitch,
        length: 2,
      },
    ]);
    setSelectedNoteIds([createdId]);
    void triggerPianoPreview(snappedPitch);
  };

  const handleGridDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pianoTool !== 'select' || !gridRef.current || !activeTrack) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.dataset.note === '1' || target.closest('[data-note="1"]')) {
      return;
    }

    const rect = gridRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left + gridRef.current.scrollLeft;
    const y = event.clientY - rect.top + gridRef.current.scrollTop;
    const snappedStart = Math.max(0, Math.floor(x / GRID_COL_WIDTH));
    const snappedPitch = clamp(Math.floor(y / GRID_ROW_HEIGHT), 0, GRID_TOTAL_ROWS - 1);
    const createdId = Date.now() + activeTrackNotes.length;

    updateActiveTrackNotes((notes) => [
      ...notes,
      {
        id: createdId,
        start: snappedStart,
        pitch: snappedPitch,
        length: 2,
      },
    ]);
    setSelectedNoteIds([createdId]);
    setSelectionBox(null);
    void triggerPianoPreview(snappedPitch);
  };

  const handleNoteMouseDown = (
    event: ReactMouseEvent<HTMLElement>,
    note: { id: number; start: number; pitch: number; length: number },
    forcedMode?: 'move' | 'resize',
  ) => {
    if (event.button !== 0 || pianoTool !== 'select') {
      return;
    }

    const dragTargetIds = selectedNoteIds.includes(note.id) && selectedNoteIds.length > 0
      ? selectedNoteIds
      : [note.id];

    if (!selectedNoteIds.includes(note.id)) {
      setSelectedNoteIds([note.id]);
    }

    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xInside = event.clientX - rect.left;
    const mode: 'move' | 'resize' = forcedMode ?? (xInside > rect.width - 10 ? 'resize' : 'move');
    const origins = activeTrackNotes
      .filter((item) => dragTargetIds.includes(item.id))
      .map((item) => ({
        id: item.id,
        start: item.start,
        pitch: item.pitch,
        length: item.length,
      }));

    setDragState({
      noteIds: dragTargetIds,
      origins,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
  };

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const deltaCols = Math.round((event.clientX - dragState.startClientX) / GRID_COL_WIDTH);
      const deltaRows = Math.round((event.clientY - dragState.startClientY) / GRID_ROW_HEIGHT);

      updateActiveTrackNotes((notes) =>
        notes.map((note) => {
          if (!dragState.noteIds.includes(note.id)) {
            return note;
          }

          const origin = dragState.origins.find((item) => item.id === note.id);
          if (!origin) {
            return note;
          }

          if (dragState.mode === 'resize') {
            return {
              ...note,
              length: Math.max(1, origin.length + deltaCols),
            };
          }

          return {
            ...note,
            start: Math.max(0, origin.start + deltaCols),
            pitch: clamp(origin.pitch + deltaRows, 0, GRID_TOTAL_ROWS - 1),
          };
        }),
      );
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, activePianoTrackId]);

  useEffect(() => {
    if (!selectionBox) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const pointer = getPointerInGrid(event.clientX, event.clientY);
      setSelectionBox((prev) =>
        prev
          ? {
              ...prev,
              currentX: pointer.x,
              currentY: pointer.y,
            }
          : prev,
      );
    };

    const handleMouseUp = () => {
      setSelectionBox((current) => {
        if (!current) {
          return null;
        }

        const minX = Math.min(current.startX, current.currentX);
        const maxX = Math.max(current.startX, current.currentX);
        const minY = Math.min(current.startY, current.currentY);
        const maxY = Math.max(current.startY, current.currentY);

        const selectedIds = activeTrackNotes
          .filter((note) => {
            const noteLeft = note.start * GRID_COL_WIDTH;
            const noteRight = noteLeft + note.length * GRID_COL_WIDTH;
            const noteTop = note.pitch * GRID_ROW_HEIGHT;
            const noteBottom = noteTop + GRID_ROW_HEIGHT;

            return noteRight >= minX && noteLeft <= maxX && noteBottom >= minY && noteTop <= maxY;
          })
          .map((note) => note.id);

        setSelectedNoteIds(selectedIds);
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [selectionBox, activeTrackNotes]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="bg-[#0e0e0e] flex justify-between items-center w-full px-4 h-12 z-50">
        <div className="flex items-center gap-6">
          <div className="flex flex-col leading-none">
            <span className="text-lg font-black tracking-tighter text-[#f4ffc6] uppercase">Bach Studio</span>
            <span className="text-[9px] font-mono text-zinc-500 uppercase">{projectName}</span>
          </div>
          <nav className="flex items-center gap-4">
            <a className="text-[#f4ffc6] border-b-2 border-[#f4ffc6] pb-1 font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">Track</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">File</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">Edit</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">Mix</a>
            <a className="text-zinc-500 hover:bg-[#2c2c2c] transition-colors font-['Inter'] font-mono text-[11px] tracking-widest uppercase" href="#">View</a>
          </nav>
        </div>

        <div className="flex items-center bg-surface-container-low px-4 py-1 gap-8 ghost-border">
          <div className="flex items-center gap-4">
            <button className="text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined">skip_previous</span></button>
            <button className="text-primary active:scale-95"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span></button>
            <button className="text-on-surface-variant hover:text-primary transition-colors"><span className="material-symbols-outlined">stop</span></button>
            <button className="text-error active:scale-95"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>fiber_manual_record</span></button>
          </div>
          <div className="flex gap-6 font-mono text-[13px] text-primary">
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">BPM</span>
              <span>{bpmLabel}</span>
            </div>
            <div className="flex flex-col items-center border-x border-outline-variant/20 px-6">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">Position</span>
              <span className="text-lg leading-none">00:00:00:00</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] text-on-surface-variant uppercase font-bold tracking-tighter">CPU</span>
              <span className="text-on-surface-variant">14%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsAICoreVisible((prev) => !prev)}
            className={`hover:bg-[#2c2c2c] transition-colors p-1 ${isAICoreVisible ? 'text-primary' : 'text-zinc-500'}`}
            title="Toggle AI Core"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: isAICoreVisible ? "'FILL' 1" : "'FILL' 0" }}>bolt</span>
          </button>
          <button className="hover:bg-[#2c2c2c] transition-colors p-1 text-zinc-500"><span className="material-symbols-outlined">help</span></button>
          <button className="hover:bg-[#2c2c2c] transition-colors p-1 text-zinc-500"><span className="material-symbols-outlined">settings</span></button>
          <button className="bg-primary text-on-primary px-4 py-1 font-mono text-[11px] font-bold uppercase tracking-widest active:bg-white transition-all">Export</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden bg-[#131313] gap-[2px] h-[calc(100vh-72px)]">
        <aside className="bg-[#131313] flex flex-col items-center py-4 space-y-1 w-16 border-r-0">
          <div className="mb-4">
            <span className="font-['Inter'] text-[10px] font-bold uppercase text-zinc-600 tracking-tighter">TOOLS</span>
          </div>
          <button className="bg-[#20201f] text-[#f4ffc6] border-l-2 border-[#f4ffc6] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">near_me</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Select</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">content_cut</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Cut</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">edit</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Draw</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">volume_off</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Mute</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">search</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Zoom</span>
          </button>
          <button className="text-zinc-600 hover:bg-[#2c2c2c] w-full aspect-square flex flex-col items-center justify-center transition-all duration-75">
            <span className="material-symbols-outlined">swap_horiz</span>
            <span className="font-['Inter'] text-[8px] font-bold uppercase mt-1">Slip</span>
          </button>
        </aside>

        <section className="flex-1 flex flex-col min-w-0 bg-surface">
          <div className="h-8 bg-surface-container-low flex items-center border-b border-outline-variant/10">
            <div className="w-48 border-r border-outline-variant/20 h-full flex items-center px-4">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Track List</span>
            </div>
            <div className="flex-1 h-full flex items-center px-2 overflow-hidden">
              <div className="w-full flex justify-between font-mono text-[9px] text-zinc-600">
                <span>1.1</span><span>2.1</span><span>3.1</span><span>4.1</span><span>5.1</span><span>6.1</span><span>7.1</span><span>8.1</span><span>9.1</span><span>10.1</span><span>11.1</span><span>12.1</span><span>13.1</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex h-16">
              <div className="w-48 flex items-center justify-center border-r border-outline-variant/20">
                <button
                  onClick={() => setIsAddTrackModalOpen(true)}
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
                onDoubleClick={() => handleTrackDoubleClick(track.id)}
                className="h-20 flex bg-surface-container-low/50 border-b border-outline-variant/5 cursor-pointer hover:bg-surface-container-low"
              >
                <div className="w-48 bg-surface-container-high border-r border-outline-variant/10 p-3 flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">{track.icon}</span>
                    <span className="font-mono text-[10px] text-primary truncate">{track.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-6 h-4 bg-surface-bright flex items-center justify-center text-[8px] font-bold">M</div>
                    <div className="w-6 h-4 bg-surface-bright flex items-center justify-center text-[8px] font-bold">S</div>
                  </div>
                </div>
                <div className="flex-1 relative">
                  <div className={`absolute inset-y-4 left-0 right-24 border ${track.clipClass} overflow-hidden`}>
                    {track.notes.length > 0 &&
                      track.notes.map((note) => {
                        const maxSteps = Math.max(16, ...track.notes.map((item) => item.start + item.length));
                        const leftPercent = (note.start / maxSteps) * 100;
                        const widthPercent = (note.length / maxSteps) * 100;
                        const topPercent = (note.pitch / GRID_TOTAL_ROWS) * 100;

                        return (
                          <div
                            key={note.id}
                            className="absolute h-[3px] bg-primary/90"
                            style={{
                              left: `${leftPercent}%`,
                              width: `${Math.max(widthPercent, 1)}%`,
                              top: `${Math.min(topPercent, 95)}%`,
                            }}
                          ></div>
                        );
                      })}
                  </div>
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
              ) : (
                <span className="text-primary font-mono text-xs font-bold uppercase">Active Tracks: {tracks.length}</span>
              )}
            </div>
          </div>
        </section>

        {isAICoreVisible && (
          <aside className="w-72 bg-surface-container-low flex flex-col p-4 gap-6">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                <span className="text-[12px] font-black uppercase tracking-widest text-primary">AI Core</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-500">v2.4 Engine</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-container p-3 flex flex-col">
                <span className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Inference</span>
                <span className="text-xs font-mono text-primary">0ms</span>
              </div>
              <div className="bg-surface-container p-3 flex flex-col">
                <span className="text-[8px] font-bold text-zinc-500 uppercase mb-1">Confidence</span>
                <span className="text-xs font-mono text-primary">0%</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Mumble Sensitivity</label>
                  <span className="text-[10px] font-mono text-primary">74%</span>
                </div>
                <div className="h-1 bg-surface-container-highest relative">
                  <div className="absolute top-0 left-0 h-full w-[74%] bg-primary"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 left-[74%] w-3 h-3 bg-white -ml-1.5 cursor-pointer"></div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Quantize Amount</label>
                  <span className="text-[10px] font-mono text-primary">0.5s</span>
                </div>
                <div className="h-1 bg-surface-container-highest relative">
                  <div className="absolute top-0 left-0 h-full w-[40%] bg-primary"></div>
                  <div className="absolute top-1/2 -translate-y-1/2 left-[40%] w-3 h-3 bg-white -ml-1.5 cursor-pointer"></div>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              <button className="w-full bg-surface-container-highest text-zinc-500 font-bold uppercase py-3 text-[11px] tracking-widest transition-all" disabled>
                Generate Pattern
              </button>
            </div>
          </aside>
        )}
      </main>

      <footer className="w-full flex justify-between items-center px-4 bg-[#0e0e0e] h-6 border-t border-[#484847]/20 z-50">
        <div className="flex items-center">
          <span className="font-mono text-[9px] uppercase tracking-tighter text-zinc-500">Bach Studio Engine v2.4 | CPU: 14% | RAM: 2.4GB</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="font-mono text-[9px] uppercase tracking-tighter text-zinc-600 hover:text-white" href="#">Buffer: 128</a>
          <a className="font-mono text-[9px] uppercase tracking-tighter text-[#f4ffc6] hover:text-white" href="#">44.1kHz</a>
          <a className="font-mono text-[9px] uppercase tracking-tighter text-zinc-600 hover:text-white" href="#">24-bit</a>
        </div>
      </footer>

      {isPianoRollOpen && (
        <div className="fixed inset-0 z-[120] bg-background flex flex-col overflow-hidden select-none">
          <header className="bg-[#0e0e0e] text-[#f4ffc6] font-['Inter'] font-mono text-[11px] tracking-widest uppercase flex justify-between items-center w-full px-4 h-12">
            <div className="flex items-center gap-8">
              <span className="text-lg font-black tracking-tighter text-[#f4ffc6] uppercase">Bach Studio</span>
              <span className="text-[9px] text-zinc-500 uppercase">Piano Roll · {activeTrackName}</span>
            </div>
            <button
              onClick={() => setIsPianoRollOpen(false)}
              className="text-zinc-400 hover:text-white p-1"
              title="Close Piano Roll"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          <div className="flex flex-1 overflow-hidden">
            <aside className="bg-[#131313] w-16 border-r-0 flex flex-col items-center py-4 space-y-1 z-40">
              <button
                onClick={() => setPianoTool('select')}
                className={`w-12 h-12 flex flex-col items-center justify-center transition-all duration-75 ${pianoTool === 'select' ? 'bg-[#20201f] text-[#f4ffc6] border-l-2 border-[#f4ffc6]' : 'text-zinc-600 hover:bg-[#2c2c2c]'}`}
              >
                <span className="material-symbols-outlined text-[20px]">near_me</span>
                <span className="text-[8px] font-bold mt-1 uppercase">Select</span>
              </button>
              <button
                onClick={() => setPianoTool('draw')}
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
                <div className="flex items-center gap-4 text-[10px] font-mono text-primary">
                  <span className="text-on-surface-variant">BPM:</span> {bpmLabel}
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                <div
                  ref={pianoKeysRef}
                  onScroll={() => syncVerticalScroll('keys')}
                  className="w-20 flex-shrink-0 bg-surface-container-highest overflow-y-auto overflow-x-hidden border-r border-outline-variant/20 no-scrollbar"
                >
                  {pianoRows.map((key) => (
                    <button
                      key={key.row}
                      onMouseDown={() => {
                        void triggerPianoPreview(key.row, 0.45);
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
                  onMouseDown={handleGridMouseDown}
                  onDoubleClick={handleGridDoubleClick}
                  onScroll={() => syncVerticalScroll('grid')}
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
                      width: `${GRID_TOTAL_COLS * GRID_COL_WIDTH}px`,
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
                        onMouseDown={(event) => handleNoteMouseDown(event, note)}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          updateActiveTrackNotes((notes) => notes.filter((item) => item.id !== note.id));
                          if (selectedNoteIds.includes(note.id)) {
                            setSelectedNoteIds((prev) => prev.filter((id) => id !== note.id));
                          }
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
                              handleNoteMouseDown(event, note, 'resize');
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
            </main>
          </div>
        </div>
      )}

      {isAddTrackModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[2px] z-[110]">
          <div className="aspect-video w-[720px] bg-surface-container-highest/80 backdrop-blur-xl border border-outline-variant/30 flex flex-col">
            <div className="px-8 pt-8 flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-black tracking-tighter text-on-surface uppercase">Add New Track</h2>
                <p className="text-[10px] font-mono text-on-surface-variant tracking-widest mt-1">SELECT SIGNAL SOURCE / ENGINE ARCHITECTURE</p>
              </div>
              <button onClick={() => setIsAddTrackModalOpen(false)} className="text-on-surface-variant hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 px-8 py-8">
              {trackTypeOptions.map((option) => {
                const isSelected = selectedTrackType === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedTrackType(option.id)}
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
                onClick={() => setIsAddTrackModalOpen(false)}
                className="px-5 py-2 bg-surface-container text-zinc-300 hover:bg-surface-bright font-mono text-[11px] uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTrack}
                className="px-5 py-2 bg-primary text-on-primary font-bold text-[11px] uppercase tracking-widest"
              >
                Add Track
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('Vocal Mask');
  const [projectName, setProjectName] = useState('SESSION_2023_X4');
  const [projectBpm, setProjectBpm] = useState('128');

  const handleStart = () => {
    const normalizedName = projectName.trim() || 'SESSION_2023_X4';
    const parsedBpm = Number.parseFloat(projectBpm);
    const normalizedBpm = Number.isFinite(parsedBpm) ? String(parsedBpm) : '128';

    setIsModalOpen(false);
    navigate(`/editor?projectName=${encodeURIComponent(normalizedName)}&bpm=${encodeURIComponent(normalizedBpm)}`);
  };

  const templates = [
    {
      id: 'Vocal Mask',
      desc: '(Humming Engine)',
      icon: 'mic_external_on',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBNtfLeQLCUPHbu7FMxyQagD47CDW8WFxYgbiioBiquIo92vwNiKk1jbSV1HS4r4vX28tOAfInRXMWquGnzhEfA-m3RnbzLBrWQyxvXKsy_CENEJ8qhGCpt5OSyb-tJon0VvN0xYXJ3aXB2sszdV4VnqrYwgx__031H_Q9ZoRPAdkFnr9VRsMkbSb4TjjHl08RmMSE6Kem1ConfC9okyKT0oH_XlQRooxwrioWG9cQLJmTbiT0slpVC4lXDPn3ttaHgXvj1MJWS5nDL',
    },
    {
      id: 'Default Empty',
      desc: 'Clean Workspace',
      icon: 'layers_clear',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA3f1u_i7dwkMCpVCMBUUGhOoRG-yxl9NwjOFFt4PVY1z2bnKDtHF8m_ZELMKZTOK3ajQJR45ceXUnyHu56w69C8faA7YZHFvgFW4adAY6ouTLiXEQB8wqEWUqPPmeb3sGDQ2q_XOsInFfzDg5uwO8tSdSmvG6mri9RikA5F9z40fhgz3-E4mgQ_PuQMW8TWECccQgrC6bjj6KSNb7I5-YIPbzGD4JAfUcordly99vZhZ0drtKKI1pMGX0PXgfKsqVmjbRwjCEVKCwx',
    },
    {
      id: 'Orchestral Hybrid',
      desc: 'Strings & Synth Layers',
      icon: 'vibration',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCJmJSDfmTI32T0TJiFcVKUCz2F0Yv6y6XJCzEIR6_y1JwcO_rm6enJQI55blvaGealDSZQ8Yrj_SlmASi26jyob3Ca9fY7p4kMFL_Vp8rOefuk4BVYTFWziU9tzBykycb1L_ScJAH6EBXqPb9vSIgkyLYgzvHNzHkjXZSbXSsOiwfuHn8q3shaYJCX9XlFhxwf4CRWqGSppgTEuMe8rfp5s7ROTjqyfFEmN9RFSLuXnjirrW-L7CtWldUIitNhpM3HMUuxSB7G8GEF',
    },
    {
      id: 'Lo-Fi Degradation',
      desc: 'Analog Warmth & Hiss',
      icon: 'radio',
      img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD-hSZ2zGnaqhzivwr2USxccF4mU0VUNPa772nhq9XUwJYX8KKdIZJqeuZTZHQXPBTejNt2p6fMLscPUttrFF6vxIRCjVVa5_pOT-ZsBIYwKnOE0ThodrMv5EUiUylumbGS_N5tLAy1Dj1JY01HafoB6B4AdZ59FJI5So-VRxUZf8iV0BnBX5LNidXSNiMhT3Ya73sL8q47x7x4gLFLP-zIMTI9ar9BSUlniqSGOvyIIZgevIKtEuGtCO5oJqP2UDHsF_eU743oiko6',
    },
  ];

  return (
    <Routes>
      <Route path="/" element={
        <>
          <LandingView onStartProject={() => setIsModalOpen(true)} />

          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-8">
            <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                title="Close"
            >
                <span className="material-symbols-outlined text-[24px]">close</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 -mt-2">
              {/* Setup Column */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">New Project</h1>
                  <p className="text-on-surface-variant font-mono text-[10px] tracking-widest uppercase">Initializing Core Audio Engine v2.4...</p>
                </div>
                <div className="space-y-6 mt-4">
                  {/* Project ID */}
                  <div className="space-y-2">
                    <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Project Name</label>
                    <input
                      className="w-full bg-surface-container-highest border-0 border-b-2 border-primary/30 focus:ring-0 focus:border-primary text-primary font-mono text-sm px-3 py-3 transition-all outline-none"
                      type="text"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                    />
                  </div>
                  {/* Technical Specs Grid */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tempo (BPM)</label>
                      <div className="bg-surface-container-highest p-3 border-b-2 border-primary/30 max-w-[50%]">
                        <input
                          className="w-full bg-transparent border-0 focus:ring-0 text-primary font-mono text-lg font-bold p-0 outline-none"
                          type="number"
                          min={1}
                          value={projectBpm}
                          onChange={(event) => setProjectBpm(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-6">
                  <button onClick={handleStart} className="w-full py-5 bg-primary text-on-primary font-black uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                              Initialize Session
                                              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>play_arrow</span>
                  </button>
                </div>
              </div>
              {/* Template Selection */}
              <div className="lg:col-span-7 pl-4">
                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">Template Selection</label>      
                <div className="grid grid-cols-2 gap-4">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplate === tpl.id;
                    const borderClass = isSelected ? 'border-2 border-primary' : 'border border-outline-variant/20 hover:border-primary/50 text-zinc-400 group-hover:text-white';
                    const opacityClass = isSelected ? 'opacity-20 group-hover:opacity-40' : 'opacity-10 group-hover:opacity-20';
                    const iconColor = isSelected ? 'text-primary' : 'text-zinc-500 group-hover:text-primary';
                    const titleColor = isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-white';

                    return (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={`group relative aspect-[4/3] bg-surface-container p-4 flex flex-col justify-between cursor-pointer transition-all ${borderClass}`}
                      >
                        <div className={`absolute inset-0 transition-opacity ${opacityClass}`}>
                          <img alt={tpl.id} className="w-full h-full object-cover grayscale" src={tpl.img} />
                        </div>
                        <div className="relative z-10 flex justify-between items-start">
                          <span className={`material-symbols-outlined ${iconColor} transition-colors`} style={{fontVariationSettings: isSelected ? "'FILL' 1" : ""}}>{tpl.icon}</span>
                          {isSelected && (
                            <span className="bg-primary text-on-primary text-[8px] font-bold px-1.5 py-0.5 uppercase tracking-tighter">Selected</span>
                          )}
                        </div>
                        <div className="relative z-10">
                          <h3 className={`font-bold text-sm uppercase mb-1 transition-colors ${titleColor}`}>{tpl.id}</h3>
                          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono">{tpl.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
    } />
      <Route path="/editor" element={<MainEditor />} />
    </Routes>
  );
}
