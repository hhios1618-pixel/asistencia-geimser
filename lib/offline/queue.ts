export interface PendingMark {
  id: string;
  eventType: 'IN' | 'OUT';
  siteId: string;
  deviceId: string;
  clientTs?: string;
  geo: {
    lat: number;
    lng: number;
    acc?: number;
  };
  note?: string;
  createdAt: number;
}

const DB_NAME = 'asistencia-geimser';
const STORE = 'pendingMarks';
const DB_VERSION = 1;

const getDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

export const offlineQueue = {
  async add(mark: PendingMark): Promise<void> {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE);
      store.put(mark);
      tx.oncomplete = () => resolve();
    });
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
    });
  },
  async list(): Promise<PendingMark[]> {
    const db = await getDb();
    return new Promise<PendingMark[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as PendingMark[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  },
};

