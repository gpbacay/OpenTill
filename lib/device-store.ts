/**
 * The device's offline copy of the store (catalogue with photos, sales, queued writes). IndexedDB rather than
 * localStorage, which caps at ~5 MB. A key is only in localStorage when it is newer than the IndexedDB copy: saved
 * by an older version, or by a save() IndexedDB refused. load() prefers it, and the next successful save() removes it.
 */
const STORE = "kv";
let db: Promise<IDBDatabase> | null = null;

function open() {
  db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("opentill", 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    db = null; // try again on the next call
    throw err;
  });
  return db;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const tx = (await open()).transaction(STORE, mode);
  const req = fn(tx.objectStore(STORE));
  return new Promise<T>((resolve, reject) => {
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    /* blocked or unreadable: use IndexedDB */
  }
  try {
    const value = await run("readonly", (store) => store.get(key));
    return value === undefined ? fallback : (value as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  run("readwrite", (store) => store.put(value, key)).then(
    () => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* blocked: nothing was written there either */
      }
    },
    () => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full or blocked: the in-memory copy still works this session */
      }
    }
  );
}
