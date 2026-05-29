import type { Track } from './types';
import { getAuthHeaders, getStoredAuth, isSignedIn } from '../auth/authUtils';

export interface ProjectData {
  projectName: string;
  bpm: number;
  tracks: Track[];
  timestamp: number;
  displayName?: string;
  ownerKey?: string;
  ownerId?: string;
  ownerEmail?: string;
  storageProjectName?: string;
}

export type HummingAiNote = {
  midi: number;
  pitch: number;
  note: string;
  startBeat: number;
  durationBeats: number;
  start: number;
  end: number;
  velocity: number;
  confidence: number;
};

export type HummingTranscriptionResponse = {
  key: string;
  notes: HummingAiNote[];
};

export type HummingStreamEvent =
  | { type: 'ready'; sourceSampleRate: number; analysisSampleRate: number; bpm: number; clipLengthBeats: number; quantize: string; source: string }
  | {
      type: 'pitch';
      timestampMs: number;
      beat: number;
      f0Hz: number | null;
      midi: number | null;
      note: string | null;
      cents: number | null;
      voiced: boolean;
      confidence: number;
      rms?: number;
      source: string;
    }
  | { type: 'note_on' | 'note_update' | 'note_off'; note: HummingAiNote; reason?: string }
  | { type: 'complete'; key: string; notes: HummingAiNote[]; liveNotes?: HummingAiNote[]; source?: string; liveSource?: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');
const LEGACY_STORAGE_PREFIX = 'bach-studio-project-';
const LEGACY_PROJECT_LIST_KEY = 'bach-studio-project-list';

type ProjectOwner = {
  key: string;
  id?: string;
  email?: string;
};

function hashText(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function getCurrentProjectOwner(): ProjectOwner | null {
  const session = getStoredAuth();
  const id = session?.user?.id?.trim();
  const email = session?.user?.email?.trim().toLowerCase();
  const ownerSource = id || email;

  if (!ownerSource) {
    return null;
  }

  return {
    key: hashText(ownerSource.toLowerCase()),
    id,
    email,
  };
}

function getScopedProjectName(displayName: string, owner: ProjectOwner) {
  const normalizedDisplayName = displayName.trim();
  const projectKey = hashText(`${owner.key}:${normalizedDisplayName.toLowerCase()}`);
  return `u_${owner.key}_${projectKey}`;
}

function isProjectOwnedByCurrentUser(project: ProjectData, owner: ProjectOwner) {
  if (project.ownerKey === owner.key) {
    return true;
  }

  if (owner.id && project.ownerId === owner.id) {
    return true;
  }

  if (owner.email && project.ownerEmail?.toLowerCase() === owner.email) {
    return true;
  }

  return project.projectName.startsWith(`u_${owner.key}_`);
}

function normalizeProjectData(project: ProjectData): ProjectData {
  const displayName = project.displayName?.trim() || project.projectName;

  return {
    projectName: displayName,
    bpm: Number(project.bpm),
    tracks: Array.isArray(project.tracks) ? project.tracks : [],
    timestamp: Number(project.timestamp) || Date.now(),
    displayName,
    ownerKey: project.ownerKey,
    ownerId: project.ownerId,
    ownerEmail: project.ownerEmail,
    storageProjectName: project.storageProjectName ?? project.projectName,
  };
}

function getJsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
}

async function readResponseMessage(response: Response) {
  try {
    const payload = await response.json();
    return typeof payload.detail === 'string' ? payload.detail : response.statusText;
  } catch {
    return response.statusText;
  }
}

export function clearLegacyLocalProjects() {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key === LEGACY_PROJECT_LIST_KEY || key?.startsWith(LEGACY_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('Failed to clear legacy local projects:', error);
  }
}

export async function saveProjectToBackend(projectName: string, tracks: Track[], bpm: number): Promise<boolean> {
  const owner = getCurrentProjectOwner();
  if (!isSignedIn() || !owner) {
    console.warn('Online project save skipped: login required');
    return false;
  }

  const displayName = projectName.trim();
  const projectData: ProjectData = {
    projectName: getScopedProjectName(displayName, owner),
    displayName,
    bpm,
    tracks,
    timestamp: Date.now(),
    ownerKey: owner.key,
    ownerId: owner.id,
    ownerEmail: owner.email,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify(projectData),
    });

    if (!response.ok) {
      console.warn('Backend project save failed:', await readResponseMessage(response));
      return false;
    }

    return response.ok;
  } catch (error) {
    console.warn('Online project save failed:', error);
    return false;
  }
}

export async function loadProjectFromBackend(projectName: string): Promise<ProjectData | null> {
  const owner = getCurrentProjectOwner();
  if (!isSignedIn() || !owner) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(getScopedProjectName(projectName, owner))}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return null;
    }

    const project = (await response.json()) as ProjectData;
    if (!isProjectOwnedByCurrentUser(project, owner)) {
      return null;
    }

    return normalizeProjectData(project);
  } catch (error) {
    console.warn('Online project load failed:', error);
    return null;
  }
}

export async function getAllBackendProjects(): Promise<ProjectData[]> {
  const owner = getCurrentProjectOwner();
  if (!isSignedIn() || !owner) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      return [];
    }

    return ((await response.json()) as ProjectData[])
      .filter((project) => isProjectOwnedByCurrentUser(project, owner))
      .map(normalizeProjectData)
      .sort((left, right) => right.timestamp - left.timestamp);
  } catch (error) {
    console.warn('Online project list failed:', error);
    return [];
  }
}

export async function deleteProjectFromBackend(projectName: string): Promise<boolean> {
  const owner = getCurrentProjectOwner();
  if (!isSignedIn() || !owner) {
    console.warn('Online project delete skipped: login required');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(getScopedProjectName(projectName, owner))}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return response.ok;
  } catch (error) {
    console.warn('Online project delete failed:', error);
    return false;
  }
}

function getAudioFileExtension(audioBlob: Blob) {
  if (audioBlob.type.includes('wav')) {
    return 'wav';
  }
  if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
    return 'mp3';
  }
  if (audioBlob.type.includes('ogg')) {
    return 'ogg';
  }
  if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) {
    return 'm4a';
  }
  return 'webm';
}

export async function transcribeHummingAudio(
  audioBlob: Blob,
  bpm: number,
  clipLengthBeats: number,
  quantize = '1/16',
): Promise<HummingTranscriptionResponse> {
  const formData = new FormData();
  const extension = getAudioFileExtension(audioBlob);

  formData.append('audio', audioBlob, `humming-${Date.now()}.${extension}`);
  formData.append('bpm', String(bpm));
  formData.append('clipLengthBeats', String(clipLengthBeats));
  formData.append('quantize', quantize);

  const response = await fetch(`${API_BASE_URL}/humming/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Humming transcription failed');
  }

  return (await response.json()) as HummingTranscriptionResponse;
}

export function getHummingStreamUrl(params: {
  sampleRate: number;
  bpm: number;
  clipLengthBeats: number;
  quantize?: string;
}) {
  const url = new URL(`${API_BASE_URL}/humming/stream`, window.location.origin);

  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('sampleRate', String(params.sampleRate));
  url.searchParams.set('bpm', String(params.bpm));
  url.searchParams.set('clipLengthBeats', String(params.clipLengthBeats));
  url.searchParams.set('quantize', params.quantize ?? '1/16');
  url.searchParams.set('preferRmvpe', 'true');

  return url.toString();
}

export async function exportProjectAsJson(projectName: string): Promise<string | null> {
  const project = await loadProjectFromBackend(projectName);
  if (!project) return null;

  return JSON.stringify(project, null, 2);
}

export function importProjectFromJson(jsonString: string): ProjectData | null {
  try {
    const data = JSON.parse(jsonString) as ProjectData;

    // Validate structure
    if (!data.projectName || typeof data.bpm !== 'number' || !Array.isArray(data.tracks)) {
      console.error('Invalid project format');
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to import project:', error);
    return null;
  }
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}
