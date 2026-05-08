import type { Track } from './types';

export interface ProjectData {
  projectName: string;
  bpm: number;
  tracks: Track[];
  timestamp: number;
}

const STORAGE_PREFIX = 'bach-studio-project-';
const PROJECT_LIST_KEY = 'bach-studio-project-list';

export function saveProject(projectName: string, tracks: Track[], bpm: number): boolean {
  try {
    const projectData: ProjectData = {
      projectName,
      bpm,
      tracks,
      timestamp: Date.now(),
    };

    const storageKey = `${STORAGE_PREFIX}${projectName}`;
    localStorage.setItem(storageKey, JSON.stringify(projectData));

    // Update project list
    const projectList = JSON.parse(localStorage.getItem(PROJECT_LIST_KEY) || '[]') as string[];
    if (!projectList.includes(projectName)) {
      projectList.push(projectName);
      localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(projectList));
    }

    return true;
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
