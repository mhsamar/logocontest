/**
 * Keeps wizard uploads (C-07) in the browser until the account exists and the
 * draft is saved on the server. Plain IndexedDB; every call fails soft.
 */
const DB = "lc-wizard-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export const putFile = (id: string, file: Blob) => run("readwrite", (s) => s.put(file, id));
export const getFile = (id: string) => run<Blob>("readonly", (s) => s.get(id));
export const deleteFile = (id: string) => run("readwrite", (s) => s.delete(id));
export const clearFiles = () => run("readwrite", (s) => s.clear());
