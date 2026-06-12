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
import {
  getDeviceSettings,
  setDeviceSettings,
  type AudioDeviceSettings,
} from './deviceSettings';

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
  const [deviceSettings, setCurrentDeviceSettings] = useState<AudioDeviceSettings>(() => getDeviceSettings());
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [midiInputs, setMidiInputs] = useState<Array<{ id: string; name: string }>>([]);
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

  const loadDevices = async (requestPermission = false) => {
    try {
      if (navigator.mediaDevices && requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }

      if (navigator.mediaDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((device) => device.kind === 'audioinput'));
        setAudioOutputs(devices.filter((device) => device.kind === 'audiooutput'));
      }

      if (navigator.requestMIDIAccess) {
        const midiAccess = await navigator.requestMIDIAccess();
        setMidiInputs(Array.from(midiAccess.inputs.values()).map((input) => ({
          id: input.id,
          name: input.name || 'MIDI Input',
        })));
      }
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : 'Device access failed');
    }
  };

  const updateDeviceSetting = (key: keyof AudioDeviceSettings, value: string) => {
    const nextSettings = { ...deviceSettings, [key]: value };
    setCurrentDeviceSettings(nextSettings);
    setDeviceSettings(nextSettings);
  };

  useEffect(() => {
    if (activePanel === 'settings') {
      void loadDevices();
    }
  }, [activePanel]);

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
            className="max-h-[calc(100vh-4rem)] w-full max-w-sm overflow-y-auto border border-white/10 bg-[#111318] p-5 shadow-2xl"
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
                  onClick={() => void loadDevices(true)}
                  className="flex w-full items-center justify-between border border-white/10 bg-[#191c23] px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-100 transition-colors hover:border-primary/70 hover:text-primary"
                >
                  {copy.devicePermission}
                  <span className="material-symbols-outlined text-[16px]">devices</span>
                </button>
                <div className="border border-white/10 bg-[#191c23] px-4 py-3">
                  <label className="mb-2 block font-mono text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    {copy.audioInput}
                  </label>
                  <select
                    value={deviceSettings.inputDeviceId}
                    onChange={(event) => updateDeviceSetting('inputDeviceId', event.target.value)}
                    className="h-9 w-full border border-white/10 bg-[#0d0f13] px-3 font-mono text-[10px] text-zinc-100 outline-none focus:border-primary/70"
                  >
                    <option value="">{copy.defaultDevice}</option>
                    {audioInputs.map((device, index) => (
                      <option key={device.deviceId || `input-${index}`} value={device.deviceId}>
                        {device.label || `${copy.audioInput} ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="border border-white/10 bg-[#191c23] px-4 py-3">
                  <label className="mb-2 block font-mono text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    {copy.audioOutput}
                  </label>
                  <select
                    value={deviceSettings.outputDeviceId}
                    onChange={(event) => updateDeviceSetting('outputDeviceId', event.target.value)}
                    className="h-9 w-full border border-white/10 bg-[#0d0f13] px-3 font-mono text-[10px] text-zinc-100 outline-none focus:border-primary/70"
                  >
                    <option value="">{copy.defaultDevice}</option>
                    {audioOutputs.map((device, index) => (
                      <option key={device.deviceId || `output-${index}`} value={device.deviceId}>
                        {device.label || `${copy.audioOutput} ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="border border-white/10 bg-[#191c23] px-4 py-3">
                  <label className="mb-2 block font-mono text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    {copy.midiInput}
                  </label>
                  <select
                    value={deviceSettings.midiInputId}
                    onChange={(event) => updateDeviceSetting('midiInputId', event.target.value)}
                    className="h-9 w-full border border-white/10 bg-[#0d0f13] px-3 font-mono text-[10px] text-zinc-100 outline-none focus:border-primary/70"
                  >
                    <option value="">{midiInputs.length === 0 ? copy.noMidiDevices : copy.defaultDevice}</option>
                    {midiInputs.map((input) => (
                      <option key={input.id} value={input.id}>{input.name}</option>
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
