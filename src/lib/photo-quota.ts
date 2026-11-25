import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { PHOTO_READS_PER_DAY } from "./site";

/**
 * Photo reading costs money per call, so each person gets PHOTO_READS_PER_DAY
 * reads in any rolling 24 hours. Only reads that produce a recipe draft count.
 *
 * Kept in a small JSON file in DATA_DIR (default ./data). Map that folder to a
 * volume to keep counts across container updates; without one they survive
 * restarts but start fresh with each new image.
 */

export { PHOTO_READS_PER_DAY };
const WINDOW_MS = 24 * 60 * 60 * 1000;

const FILE = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "photo-reads.json");

/** userId → timestamps (ms) of reads in the last 24 hours. */
type Store = Record<string, number[]>;

// Loaded once and shared, so reads arriving together all see the same counts.
let loading: Promise<Store> | undefined;
let saving: Promise<void> = Promise.resolve();

function load(): Promise<Store> {
  loading ??= readFile(FILE, "utf8")
    .then((text) => {
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === "object" ? (parsed as Store) : {};
    })
    .catch(() => ({}));
  return loading;
}

function recent(s: Store, userId: string, now = Date.now()) {
  const kept = (s[userId] ?? []).filter((t) => now - t < WINDOW_MS);
  if (kept.length) s[userId] = kept;
  else delete s[userId];
  return kept;
}

function save(s: Store) {
  // One write at a time; write-then-rename so a crash never leaves half a file.
  saving = saving.then(async () => {
    try {
      await mkdir(path.dirname(FILE), { recursive: true });
      await writeFile(`${FILE}.tmp`, JSON.stringify(s));
      await rename(`${FILE}.tmp`, FILE);
    } catch (e) {
      console.error("Couldn't save photo read counts:", e instanceof Error ? e.message : e);
    }
  });
  return saving;
}

export type PhotoQuota = {
  /** Reads left right now. */
  left: number;
  /** When a read frees up (ms since epoch), if any are used. */
  nextAt: number | null;
};

function quotaOf(times: number[]): PhotoQuota {
  return {
    left: Math.max(0, PHOTO_READS_PER_DAY - times.length),
    nextAt: times.length ? Math.min(...times) + WINDOW_MS : null,
  };
}

export async function photoQuota(userId: string): Promise<PhotoQuota> {
  return quotaOf(recent(await load(), userId));
}

/**
 * Hold one read for this person before calling the AI. Returns a `release`
 * to give it back if the read fails, or null when they've used them all.
 * Holding first stops two reads at once from both slipping under the limit.
 */
export async function takePhotoRead(userId: string) {
  const s = await load();
  const times = recent(s, userId);
  if (times.length >= PHOTO_READS_PER_DAY) return null;
  const stamp = Date.now();
  s[userId] = [...times, stamp];
  void save(s);
  return {
    release: async () => {
      // Remove just this one: reads started together can share a timestamp.
      const times = s[userId] ?? [];
      const i = times.indexOf(stamp);
      if (i >= 0) times.splice(i, 1);
      recent(s, userId);
      await save(s);
    },
  };
}
