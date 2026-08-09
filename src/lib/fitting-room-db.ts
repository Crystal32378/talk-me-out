"use client";

/**
 * Device-local persistence for the persistent fitting room.
 *
 * Stores the user's fitting photo + an array of saved fitting-room
 * entries (one per garment tried) in IndexedDB. No cloud, no account,
 * no cross-device sync. The user can clear everything at any time
 * via `clearFittingRoom()` (which the UI gates behind a confirmation).
 *
 * Storage layout (single DB, two object stores):
 *   DB name:    talk-me-out-fitting-room
 *   DB version: 1
 *   Stores:
 *     - person     (keyPath: "id")  — single record with id="default"
 *     - looks      (keyPath: "id")  — one record per tried garment
 *
 * All functions are SSR-safe (return null / empty / no-op when
 * `window` or `indexedDB` is unavailable, so they can be called from
 * Next.js server components without crashing).
 */

import type { FittingRoomEntry } from "./types";

const DB_NAME = "talk-me-out-fitting-room";
const DB_VERSION = 1;
const STORE_PERSON = "person";
const STORE_LOOKS = "looks";
const PERSON_KEY = "default";

export interface PersistedPersonPhoto {
  id: "default";
  dataUrl: string;
  savedAt: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isBrowser()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PERSON)) {
        db.createObjectStore(STORE_PERSON, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_LOOKS)) {
        db.createObjectStore(STORE_LOOKS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Person photo ─────────────────────────────────────────────────────

export async function savePersonPhoto(dataUrl: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const record: PersistedPersonPhoto = {
    id: PERSON_KEY,
    dataUrl,
    savedAt: Date.now(),
  };
  await tx(db, STORE_PERSON, "readwrite", (s) => s.put(record));
  db.close();
}

export async function loadPersonPhoto(): Promise<PersistedPersonPhoto | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const result = await tx<PersistedPersonPhoto | undefined>(
      db,
      STORE_PERSON,
      "readonly",
      (s) => s.get(PERSON_KEY),
    );
    return result ?? null;
  } finally {
    db.close();
  }
}

export async function clearPersonPhoto(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, STORE_PERSON, "readwrite", (s) => s.delete(PERSON_KEY));
  db.close();
}

// ─── Fitting-room looks ───────────────────────────────────────────────

export async function loadAllLooks(): Promise<FittingRoomEntry[]> {
  const db = await openDb();
  if (!db) return [];
  try {
    const all = await tx<FittingRoomEntry[]>(db, STORE_LOOKS, "readonly", (s) => s.getAll());
    // Sort by most recently updated first.
    return (all ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    db.close();
  }
}

export async function saveLook(entry: FittingRoomEntry): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, STORE_LOOKS, "readwrite", (s) => s.put(entry));
  db.close();
}

export async function deleteLook(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, STORE_LOOKS, "readwrite", (s) => s.delete(id));
  db.close();
}

export async function getLook(id: string): Promise<FittingRoomEntry | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const result = await tx<FittingRoomEntry | undefined>(
      db,
      STORE_LOOKS,
      "readonly",
      (s) => s.get(id),
    );
    return result ?? null;
  } finally {
    db.close();
  }
}

// ─── Nuclear option ───────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await Promise.all([
    tx(db, STORE_PERSON, "readwrite", (s) => s.clear()),
    tx(db, STORE_LOOKS, "readwrite", (s) => s.clear()),
  ]);
  db.close();
}
