import { useEffect, useState } from 'react';
import type { AuthUser } from '../auth/authUtils';
import { HeaderUtilityButtons } from '../ui/HeaderUtilityButtons';
import { APP_LANGUAGE_CHANGE_EVENT, getStoredLanguage, landingCopy, type AppLanguage } from '../ui/language';

type LandingViewProps = {
  onStartProject: () => void;
  onOpenProjectManager: () => void;
  authUser: AuthUser | null;
  isSigningIn: boolean;
  onGoogleLogin: () => void;
  onLogout: () => void;
};

export function LandingView({
  onStartProject,
  onOpenProjectManager,
  authUser,
  isSigningIn,
  onGoogleLogin,
  onLogout,
}: LandingViewProps) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage());
  const copy = landingCopy[language];

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.addEventListener('storage', handleLanguageChange);

    return () => {
      window.removeEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
      window.removeEventListener('storage', handleLanguageChange);
    };
  }, []);

  return (
    <>
      <header className="bg-[#0e0e0e] text-[#f4ffc6] font-['Inter'] font-mono text-[11px] tracking-widest uppercase flex justify-between items-center w-full px-4 h-12 fixed top-0 z-50 border-b-0">
        <div className="flex items-center gap-8">
          <span className="text-lg font-headline font-black tracking-tighter text-[#f4ffc6] uppercase">{copy.brand}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HeaderUtilityButtons />
          {authUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountOpen((prev) => !prev)}
                className="h-9 w-9 overflow-hidden border border-white/15 bg-[#191c23] text-white transition-colors hover:border-primary/70"
                title={authUser.email}
                aria-label={copy.account}
              >
                {authUser.picture ? (
                  <img src={authUser.picture} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[20px]">account_circle</span>
                )}
              </button>
              {isAccountOpen && (
                <div className="absolute right-0 top-11 w-64 border border-white/10 bg-[#111318] p-3 shadow-2xl">
                  <div className="mb-3 truncate font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                    {authUser.email}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountOpen(false);
                      onLogout();
                    }}
                    className="flex h-9 w-full items-center justify-between border border-white/10 bg-[#191c23] px-3 text-[10px] font-black uppercase tracking-widest text-zinc-100 transition-colors hover:border-primary/70 hover:text-primary"
                  >
                    {copy.logout}
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleLogin}
              disabled={isSigningIn}
              className="h-9 w-9 border border-white/15 bg-[#191c23] text-white transition-colors hover:border-primary/70 hover:text-primary disabled:opacity-50"
              title={isSigningIn ? copy.signingIn : copy.googleLogin}
              aria-label={copy.googleLogin}
            >
              <span className="material-symbols-outlined text-[20px]">{isSigningIn ? 'sync' : 'login'}</span>
            </button>
          )}
        </div>
      </header>

      <main className="mt-12 mb-6 flex-grow bg-surface-container-lowest">
        <section className="relative h-[665px] w-full flex items-center px-12 overflow-hidden bg-[#101214]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img
              src="/assets/humming-ai-panel.png"
              alt=""
              className="absolute right-[7%] top-1/2 h-[112%] w-auto -translate-y-1/2 opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#101214] via-[#101214]/90 to-[#101214]/30"></div>
            <div className="absolute inset-0 bg-black/5"></div>
          </div>
          <div className="relative z-20 max-w-2xl">
            <div className="inline-block bg-primary text-on-primary px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">
              {copy.heroEyebrow}
            </div>
            <h1 className="text-6xl font-headline font-black tracking-tighter text-white uppercase leading-none mb-6">
              {copy.heroTitleLine1}<br /><span className="text-primary">{copy.heroTitleLine2}</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg mb-8 max-w-lg leading-relaxed">
              {copy.heroBody}
            </p>
            <div className="flex gap-4">
              <button onClick={onStartProject} className="bg-primary text-on-primary font-bold px-8 py-4 uppercase text-sm flex items-center gap-3 active:scale-95 transition-transform">
                {copy.startProject}
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
              <button onClick={onOpenProjectManager} className="ghost-border text-white hover:bg-surface-bright px-8 py-4 uppercase text-sm font-bold transition-colors flex items-center gap-3">
                {copy.projectManager}
                <span className="material-symbols-outlined text-sm">folder_open</span>
              </button>
            </div>
          </div>
        </section>

        <section className="p-4 grid grid-cols-12 gap-1 auto-rows-[240px]">
          <div className="col-span-12 md:col-span-8 bg-surface-container flex flex-col p-8 ghost-border relative overflow-hidden group">
            <div className="relative z-10 h-full flex flex-col">
              <div className="flex items-center gap-3 text-primary mb-4">
                <span className="material-symbols-outlined">settings_voice</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{copy.coreEngine}</span>
              </div>
              <h3 className="text-3xl font-black text-white uppercase mb-4 max-w-md">{copy.aiTranscription}</h3>
              <p className="text-on-surface-variant text-sm max-w-sm">
                {copy.aiBody}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                <span className="font-mono text-[9px] text-primary uppercase">{copy.analyzing}</span>
              </div>
            </div>
            <div className="absolute right-0 top-0 w-1/2 h-full opacity-30 group-hover:opacity-50 transition-opacity">
              <img alt="Visual wave" className="w-full h-full object-cover" data-alt="Digital representation of complex audio wave frequencies in neon lime green on a black background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC77VFQx7AwNsy4Qae_SKe2bb321Fpu8jYJxu46ERRFZtRf9UcPkBR1JQtqAtAdCf_4opJZgAhiv0IUUrqQzHhoARaE0zGQRxEQjRkD626xKO1QWgO7njW6iTyHZDYt4gu1affclMCFOHm7FQSEA_0iPpBmaxcTLdipmUQNQF5GpI0OCOFIPEmLSe3bg_AqP0ARWamBl3d_h_s9IUbFYLIWnhSocA2DqRy3sC2XO5_fqDJsPxKJG6szRQTvTu7i-y4cXC82h5FTkgo0" />
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 bg-surface-container-high p-8 ghost-border flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-primary mb-4">analytics</span>
              <h3 className="text-xl font-black text-white uppercase mb-2">{copy.realTimeAnalysis}</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                {copy.realTimeBody}
              </p>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 bg-surface-container-low p-8 ghost-border flex flex-col">
            <span className="material-symbols-outlined text-primary mb-4">settings_input_component</span>
            <h3 className="text-xl font-black text-white uppercase mb-2">{copy.vstSupport}</h3>
            <p className="text-on-surface-variant text-xs leading-relaxed mb-6">
              {copy.vstBody}
            </p>
          </div>
          <div className="col-span-12 md:col-span-8 bg-surface-container flex items-center p-8 ghost-border gap-8 overflow-hidden">
            <div className="flex-shrink-0 w-48 h-full bg-surface-container-lowest border border-outline-variant/20 flex flex-col p-4">
              <div className="flex justify-between items-center mb-4">
                <span className="font-mono text-[9px] uppercase">{copy.inputGain}</span>
                <span className="text-primary font-mono text-[9px] uppercase">+4.5dB</span>
              </div>
            </div>
            <div className="flex-grow">
              <h3 className="text-2xl font-black text-white uppercase mb-4">{copy.modularWorkflow}</h3>
              <p className="text-on-surface-variant text-sm max-w-md">
                {copy.modularBody}
              </p>
            </div>
          </div>
        </section>

        <section className="px-12 py-24 bg-surface flex flex-col items-center text-center">
          <h2 className="text-4xl font-black uppercase text-white tracking-tight mb-4">{copy.readyTitle}</h2>
          <p className="text-on-surface-variant mb-10 max-w-xl">
            {copy.readyBody}
          </p>
          <div className="bg-primary p-[1px] group active:scale-95 transition-transform">
            <button
              onClick={authUser ? onStartProject : onGoogleLogin}
              disabled={isSigningIn}
              className="bg-surface hover:bg-primary hover:text-black transition-colors px-12 py-5 font-black uppercase text-lg text-primary disabled:opacity-50"
            >
              {authUser ? copy.startComposing : copy.signInWithGoogle}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
