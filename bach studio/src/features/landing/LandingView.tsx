type LandingViewProps = {
  onStartProject: () => void;
};

export function LandingView({ onStartProject }: LandingViewProps) {
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
            <img alt="Studio visual" className="w-full h-full object-cover" data-alt="Close-up of a professional mixing console in a dark studio with glowing green and yellow LEDs and linear sliders" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCFWzRwm6I-E5r6oNpHmyOHv85zK6o9XHgxX6M7GhxftZApeQ5K970Iv0jNSxMMKFKFrRf_jrIWVnH7oPDle3vlduHAfP_YMGT9AwlmpwQiLr5euofb1kIKUCAfET0RZP_PADNmch61O-MTIMlaNEgN8sK8EFvkBVWmgSpZFSJwqYYPNv2AJ8eWtljX8itV3sKayP9TiYl684ZfVC9ibreRTODBclojyMKGmHv8sb0NYy_uP6IhJh6uowJAGJyf8_K1IOobZxgcHwhn" />
          </div>
          <div className="relative z-20 max-w-2xl">
            <div className="inline-block bg-primary text-on-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">
              Signal Processing: Active
            </div>
            <h1 className="text-6xl font-headline font-black tracking-tighter text-white uppercase leading-none mb-6">
              Your Voice,<br /><span className="text-primary">Into Music.</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg mb-8 max-w-lg leading-relaxed">
              Professional Mumble-to-MIDI technology for composers. Record, convert, and refine in real-time with zero-latency engine.
            </p>
            <div className="flex gap-4">
              <button onClick={onStartProject} className="bg-primary text-on-primary font-bold px-8 py-4 uppercase text-sm flex items-center gap-3 active:scale-95 transition-transform">
                Start New Project
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
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
              <img alt="Visual wave" className="w-full h-full object-cover" data-alt="Digital representation of complex audio wave frequencies in neon lime green on a black background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC77VFQx7AwNsy4Qae_SKe2bb321Fpu8jYJxu46ERRFZtRf9UcPkBR1JQtqAtAdCf_4opJZgAhiv0IUUrqQzHhoARaE0zGQRxEQjRkD626xKO1QWgO7njW6iTyHZDYt4gu1affclMCFOHm7FQSEA_0iPpBmaxcTLdipmUQNQF5GpI0OCOFIPEmLSe3bg_AqP0ARWamBl3d_h_s9IUbFYLIWnhSocA2DqRy3sC2XO5_fqDJsPxKJG6szRQTvTu7i-y4cXC82h5FTkgo0" />
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
