export type AudioDeviceSettings = {
  inputDeviceId: string;
  outputDeviceId: string;
  midiInputId: string;
};

export const DEVICE_SETTINGS_STORAGE_KEY = 'bach-studio-device-settings';
export const DEVICE_SETTINGS_CHANGE_EVENT = 'bach-studio-device-settings-change';

const DEFAULT_DEVICE_SETTINGS: AudioDeviceSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  midiInputId: '',
};

export function getDeviceSettings(): AudioDeviceSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(DEVICE_SETTINGS_STORAGE_KEY) ?? '{}') as Partial<AudioDeviceSettings>;
    return {
      inputDeviceId: stored.inputDeviceId ?? '',
      outputDeviceId: stored.outputDeviceId ?? '',
      midiInputId: stored.midiInputId ?? '',
    };
  } catch {
    return DEFAULT_DEVICE_SETTINGS;
  }
}

export function setDeviceSettings(settings: AudioDeviceSettings) {
  try {
    localStorage.setItem(DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Device settings still apply for the current session.
  }

  window.dispatchEvent(new CustomEvent(DEVICE_SETTINGS_CHANGE_EVENT, { detail: settings }));
}
