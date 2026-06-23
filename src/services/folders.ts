import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = '@random-gallery/folders';

export interface FolderImport {
  id: string;
  uri: string;
  name: string;
  enabled: boolean;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getFolders(): Promise<FolderImport[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const folders = JSON.parse(json) as FolderImport[];
    return Array.isArray(folders) ? folders : [];
  } catch {
    return [];
  }
}

export async function saveFolders(folders: FolderImport[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

export async function addFolder(uri: string, name: string): Promise<FolderImport[]> {
  const folders = await getFolders();
  const newFolder: FolderImport = {
    id: generateId(),
    uri,
    name,
    enabled: true,
  };
  folders.push(newFolder);
  await saveFolders(folders);
  return folders;
}

export async function removeFolder(id: string): Promise<FolderImport[]> {
  const folders = await getFolders();
  const updated = folders.filter((f) => f.id !== id);
  await saveFolders(updated);
  return updated;
}

export async function toggleFolder(id: string): Promise<FolderImport[]> {
  const folders = await getFolders();
  const updated = folders.map((f) =>
    f.id === id ? { ...f, enabled: !f.enabled } : f
  );
  await saveFolders(updated);
  return updated;
}
