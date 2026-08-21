import type { BKStoredState } from '@/types/bk';

const DATABASE_NAME = 'portal-fiscal-bk';
const DATABASE_VERSION = 1;
const STORE_NAME = 'settings';
const STATE_KEY = 'state';
const DIRECTORY_KEY = 'directory-handle';
export const BACKUP_FILE_NAME = 'bk-documentos.json';

type PermissionMode = 'read' | 'readwrite';
type PortableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (descriptor: { mode: PermissionMode }) => Promise<PermissionState>;
  requestPermission: (descriptor: { mode: PermissionMode }) => Promise<PermissionState>;
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

type WritableFileHandle = FileSystemFileHandle & {
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: PermissionMode }) => Promise<FileSystemDirectoryHandle>;
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readValue<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export const loadIndexedState = () => readValue<BKStoredState>(STATE_KEY);
export const saveIndexedState = (state: BKStoredState) => writeValue(STATE_KEY, state);
export const loadDirectoryHandle = () => readValue<FileSystemDirectoryHandle>(DIRECTORY_KEY);
export const saveDirectoryHandle = (handle: FileSystemDirectoryHandle) => writeValue(DIRECTORY_KEY, handle);

export async function requestDirectory() {
  if (!window.showDirectoryPicker) throw new Error('Use Chrome ou Edge atualizado para selecionar uma pasta permanente.');
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await saveDirectoryHandle(handle);
  return handle;
}

export async function ensureDirectoryPermission(handle: FileSystemDirectoryHandle, request: boolean) {
  const portable = handle as PortableDirectoryHandle;
  if (await portable.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
  return request && await portable.requestPermission({ mode: 'readwrite' }) === 'granted';
}

export async function writePortableBackup(handle: FileSystemDirectoryHandle, state: BKStoredState) {
  const fileHandle = await handle.getFileHandle(BACKUP_FILE_NAME, { create: true }) as WritableFileHandle;
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify({ format: 'BK_DOCUMENTOS', exportedAt: new Date().toISOString(), state }, null, 2));
  await writable.close();
}

export async function readPortableBackup(handle: FileSystemDirectoryHandle): Promise<BKStoredState | undefined> {
  try {
    const file = await (await handle.getFileHandle(BACKUP_FILE_NAME)).getFile();
    const parsed = JSON.parse(await file.text()) as { format?: string; state?: BKStoredState };
    if (parsed.format !== 'BK_DOCUMENTOS' || !parsed.state || !Array.isArray(parsed.state.documents)) throw new Error('Backup BK inválido.');
    return parsed.state;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return undefined;
    throw error;
  }
}

export interface LocalXmlFile { path: string; file: File; fingerprint: string }

export async function listChangedXmlFiles(handle: FileSystemDirectoryHandle, knownFiles: Record<string, string>) {
  const changed: LocalXmlFile[] = [];
  const discovered: Record<string, string> = {};
  async function walk(directory: FileSystemDirectoryHandle, prefix: string) {
    for await (const [name, entry] of (directory as PortableDirectoryHandle).entries()) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'directory') await walk(entry as FileSystemDirectoryHandle, path);
      else if (name.toLowerCase().endsWith('.xml')) {
        const file = await (entry as FileSystemFileHandle).getFile();
        const fingerprint = `${file.size}:${file.lastModified}`;
        discovered[path] = fingerprint;
        if (knownFiles[path] !== fingerprint) changed.push({ path, file, fingerprint });
      }
    }
  }
  await walk(handle, '');
  return { changed, discovered };
}
