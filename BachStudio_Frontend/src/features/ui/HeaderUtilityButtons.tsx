import { useEffect, useState } from 'react';
import { clearLegacyLocalProjects } from '../editor/fileUtils';
import {
  APP_LANGUAGE_CHANGE_EVENT,
  applyLanguage,
  getStoredLanguage,
  isAppLanguage,
  LANGUAGE_OPTIONS,
  setStoredLanguage,
  type AppLanguage,
  utilityCopy,
} from './language';

type HeaderUtilityButtonsProps = {
  buttonClassName?: string;
  iconClassName?: string;
};

type UtilityPanel = 'help' | 'settings' | null;

const API_DOCS_URL = 'http://127.0.0.1:8000/docs';

export function HeaderUtilityButtons({
  buttonClassName = 'h-9 w-9 flex items-center justify-center hover:bg-[#2c2c2c] transition-colors text-zinc-300 hover:text-white',
  iconClassName = 'material-symbols-outlined text-[18px]',
}: HeaderUtilityButtonsProps) {
  const [activePanel, setActivePanel] = useState<UtilityPanel>(null);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage());
  const copy = utilityCopy[language];

  useEffect(() => {
    applyLanguage(language);

    const handleLanguageChange = () => {
      setLanguage(getStoredLanguage());
    };

    window.addEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
    window.addEventListener('storage', handleLanguageChange);

    return () => {
      window.removeEventListener(APP_LANGUAGE_CHANGE_EVENT, handleLanguageChange);
      window.removeEventListener('storage', handleLanguageChange);
    };
  }, [language]);

  const closePanel = () => {
    setActivePanel(null);
    setSettingsMessage('');
  };

  const clearOldProjectCache = () => {
    clearLegacyLocalProjects();
    setSettingsMessage(copy.cacheCleared);
  };

  const updateLanguage = (value: string) => {
    if (!isAppLanguage(value)) {
      return;
    }

    setStoredLanguage(value);
    setLanguage(value);
    const optionLabel = LANGUAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
    setSettingsMessage(`${utilityCopy[value].languageSet}: ${optionLabel}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setActivePanel('help')}
        className={buttonClassName}
        title={copy.help}
        aria-label={copy.help}
      >
        <span className={iconClassName}>help</span>
      </button>
      <button
        type="button"
        onClick={() => setActivePanel('settings')}
        className={buttonClassName}
        title={copy.settings}
        aria-label={copy.settings}
      >
        <span className={iconClassName}>settings</span>
      </button>

      {activePanel && (
        <div className="fixed inset-0 z-[120] flex items-start justify-end bg-black/45 p-4 pt-14" onMouseDown={closePanel}>
          <section
            className="w-full max-w-sm border border-white/10 bg-[#111318] p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-[12px] font-black uppercase tracking-widest text-[#f4ffc6]">
                {activePanel === 'help' ? copy.help : copy.settings}
              </h2>
              <button
                type="button"
                onClick={closePanel}
                className="h-8 w-8 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                title={copy.close}
                aria-label={copy.close}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {activePanel === 'help' ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer')}
                  className="flex w-full items-center justify-between border border-white/10 bg-[#191c23] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-100 transition-colors hover:border-primary/70 hover:text-primary"
                >
                  {copy.backendDocs}
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.location.assign('/projects')}
                  className="flex w-full items-center justify-between border border-white/10 bg-[#191c23] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-100 transition-colors hover:border-primary/70 hover:text-primary"
                >
                  {copy.projectManager}
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border border-white/10 bg-[#191c23] px-4 py-3">
                  <label className="mb-2 block font-mono text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    {copy.language}
                  </label>
                  <select
                    value={language}
                    onChange={(event) => updateLanguage(event.target.value)}
                    className="h-9 w-full border border-white/10 bg-[#0d0f13] px-3 font-mono text-[10px] font-black uppercase tracking-widest text-zinc-100 outline-none transition-colors focus:border-primary/70"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={clearOldProjectCache}
                  className="flex w-full items-center justify-between border border-white/10 bg-[#191c23] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-100 transition-colors hover:border-primary/70 hover:text-primary"
                >
                  {copy.clearCache}
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                </button>
                <div className="border border-white/10 bg-[#0d0f13] px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {copy.storage}
                </div>
                {settingsMessage && (
                  <div className="border border-primary/30 bg-primary/10 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-primary">
                    {settingsMessage}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
