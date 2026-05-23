import type { Track } from './types';

export interface ProjectData {
  projectName: string;
  bpm: number;
  tracks: Track[];
  timestamp: number;
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

const STORAGE_PREFIX = 'bach-studio-project-';
const PROJECT_LIST_KEY = 'bach-studio-project-list';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');

function normalizeProjectData(project: ProjectData): ProjectData {
  return {
    projectName: project.projectName,
    bpm: Number(project.bpm),
    tracks: Array.isArray(project.tracks) ? project.tracks : [],
    timestamp: Number(project.timestamp) || Date.now(),
  };
}

function cacheProject(project: ProjectData): boolean {
  try {
    const normalizedProject = normalizeProjectData(project);
    const storageKey = `${STORAGE_PREFIX}${normalizedProject.projectName}`;
    localStorage.setItem(storageKey, JSON.stringify(normalizedProject));

    const projectList = JSON.parse(localStorage.getItem(PROJECT_LIST_KEY) || '[]') as string[];
    if (!projectList.includes(normalizedProject.projectName)) {
      projectList.push(normalizedProject.projectName);
      localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(projectList));
    }

    return true;
  } catch (error) {
    console.error('Failed to cache project:', error);
    return false;
  }
}

export function saveProject(projectName: string, tracks: Track[], bpm: number): boolean {
  try {
    const projectData: ProjectData = {
      projectName,
      bpm,
      tracks,
      timestamp: Date.now(),
    };

    return cacheProject(projectData);
  } catch (error) {
    console.error('Failed to save project:', error);
    return false;
  }
}

export function loadProject(projectName: string): ProjectData | null {
  try {
    const storageKey = `${STORAGE_PREFIX}${projectName}`;
    const data = localStorage.getItem(storageKey);

    if (!data) return null;

    return JSON.parse(data) as ProjectData;
  } catch (error) {
    console.error('Failed to load project:', error);
    return null;
  }
}

export function getAllProjects(): ProjectData[] {
  try {
    const projectList = JSON.parse(localStorage.getItem(PROJECT_LIST_KEY) || '[]') as string[];
    return projectList
      .map((projectName) => loadProject(projectName))
      .filter((project) => project !== null) as ProjectData[];
  } catch (error) {
    console.error('Failed to get projects:', error);
    return [];
  }
}

export function deleteProject(projectName: string): boolean {
  try {
    const storageKey = `${STORAGE_PREFIX}${projectName}`;
    localStorage.removeItem(storageKey);

    // Update project list
    const projectList = JSON.parse(localStorage.getItem(PROJECT_LIST_KEY) || '[]') as string[];
    const updatedList = projectList.filter((name) => name !== projectName);
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(updatedList));

    return true;
  } catch (error) {
    console.error('Failed to delete project:', error);
    return false;
  }
}

export async function saveProjectToBackend(projectName: string, tracks: Track[], bpm: number): Promise<boolean> {
  const projectData: ProjectData = {
    projectName,
    bpm,
    tracks,
    timestamp: Date.now(),
  };

  try {
    const response = await fetch(`${API_BASE_URL}/projects/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(projectData),
    });

    return response.ok;
  } catch (error) {
    console.warn('Backend project save failed:', error);
    return false;
  }
}

export async function loadProjectFromBackend(projectName: string): Promise<ProjectData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectName)}`);
    if (!response.ok) {
      return null;
    }

    const project = normalizeProjectData((await response.json()) as ProjectData);
    cacheProject(project);
    return project;
  } catch (error) {
    console.warn('Backend project load failed:', error);
    return null;
  }
}

export async function getAllBackendProjects(): Promise<ProjectData[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/`);
    if (!response.ok) {
      return [];
    }

    const projects = ((await response.json()) as ProjectData[]).map(normalizeProjectData);
    projects.forEach(cacheProject);
    return projects;
  } catch (error) {
    console.warn('Backend project list failed:', error);
    return [];
  }
}

export async function deleteProjectFromBackend(projectName: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/projects/${encodeURIComponent(projectName)}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    console.warn('Backend project delete failed:', error);
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

export function exportProjectAsJson(projectName: string): string | null {
  const project = loadProject(projectName);
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
