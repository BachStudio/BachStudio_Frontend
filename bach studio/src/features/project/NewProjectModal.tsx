type NewProjectModalProps = {
  isOpen: boolean;
  selectedTemplate: string;
  projectName: string;
  projectBpm: string;
  onClose: () => void;
  onStart: () => void;
  onSelectTemplate: (templateId: string) => void;
  onProjectNameChange: (value: string) => void;
  onProjectBpmChange: (value: string) => void;
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

export function NewProjectModal({
  isOpen,
  selectedTemplate,
  projectName,
  projectBpm,
  onClose,
  onStart,
  onSelectTemplate,
  onProjectNameChange,
  onProjectBpmChange,
}: NewProjectModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-surface-container-lowest border border-outline-variant/40 shadow-2xl p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
          title="Close"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 -mt-2">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">New Project</h1>
              <p className="text-on-surface-variant font-mono text-[10px] tracking-widest uppercase">Initializing Core Audio Engine v2.4...</p>
            </div>
            <div className="space-y-6 mt-4">
              <div className="space-y-2">
                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Project Name</label>
                <input
                  className="w-full bg-surface-container-highest border-0 border-b-2 border-primary/30 focus:ring-0 focus:border-primary text-primary font-mono text-sm px-3 py-3 transition-all outline-none"
                  type="text"
                  value={projectName}
                  onChange={(event) => onProjectNameChange(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Tempo (BPM)</label>
                  <div className="bg-surface-container-highest p-3 border-b-2 border-primary/30 max-w-[50%]">
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
            </div>
            <div className="pt-6">
              <button onClick={onStart} className="w-full py-5 bg-primary text-on-primary font-black uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                Initialize Session
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
          </div>
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
                    onClick={() => onSelectTemplate(tpl.id)}
                    className={`group relative aspect-[4/3] bg-surface-container p-4 flex flex-col justify-between cursor-pointer transition-all ${borderClass}`}
                  >
                    <div className={`absolute inset-0 transition-opacity ${opacityClass}`}>
                      <img alt={tpl.id} className="w-full h-full object-cover grayscale" src={tpl.img} />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                      <span className={`material-symbols-outlined ${iconColor} transition-colors`} style={{ fontVariationSettings: isSelected ? "'FILL' 1" : '' }}>{tpl.icon}</span>
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
  );
}
