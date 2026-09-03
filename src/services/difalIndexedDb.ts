const DATABASE_NAME = 'portal-fiscal-difal';
const STORE_NAME = 'config';
const NCM_KEY = 'ncm-descriptions';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDifalNcmTable() {
  const database = await openDatabase();
  return new Promise<Record<string, string> | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly'); const request = transaction.objectStore(STORE_NAME).get(NCM_KEY);
    request.onsuccess = () => resolve(request.result as Record<string, string> | undefined);
    transaction.oncomplete = () => database.close(); transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveDifalNcmTable(table: Record<string, string>) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite'); transaction.objectStore(STORE_NAME).put(table, NCM_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
  });
}
