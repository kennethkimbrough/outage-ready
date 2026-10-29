/**
 * Persistence: one plan, saved in IndexedDB under a fixed key. Nothing leaves
 * the device unless the user exports it. localStorage is used only as a
 * fallback when IndexedDB is unavailable (private mode on some browsers).
 */
import { emptyPlan, type Plan } from "../engine/index.js";

const DB = "outage-ready";
const STORE = "plans";
const KEY = "current";
const LS_KEY = "outage-ready:plan";

type Listener = (plan: Plan) => void;

let cached: Plan | null = null;
const listeners = new Set<Listener>();

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(): Promise<Plan | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as Plan) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(plan: Plan): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(plan, KEY);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

function lsGet(): Plan | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Plan) : null;
  } catch {
    return null;
  }
}

function lsPut(plan: Plan): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(plan));
  } catch {
    /* storage may be unavailable; the in-memory copy still works for the session */
  }
}

/** Fill in any fields missing from an older or hand-edited plan. */
export function normalizePlan(input: unknown): Plan {
  const base = emptyPlan();
  if (!input || typeof input !== "object") return base;
  const p = input as Partial<Plan>;
  return {
    household: { ...base.household, ...(p.household ?? {}), home: { ...base.household.home, ...(p.household?.home ?? {}) },
      people: p.household?.people ?? base.household.people, pets: p.household?.pets ?? [] },
    inventory: { ...base.inventory, ...(p.inventory ?? {}), vehicle: { ...base.inventory.vehicle, ...(p.inventory?.vehicle ?? {}) } },
    overrides: p.overrides ?? {},
    durations: p.durations ?? {},
    completedTasks: Array.isArray(p.completedTasks) ? p.completedTasks : [],
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : base.updatedAt,
  };
}

export async function loadPlan(): Promise<Plan> {
  if (cached) return cached;
  const raw = (await idbGet()) ?? lsGet();
  cached = normalizePlan(raw);
  return cached;
}

export async function savePlan(plan: Plan): Promise<void> {
  plan.updatedAt = new Date().toISOString();
  cached = plan;
  const ok = await idbPut(plan);
  if (!ok) lsPut(plan);
  for (const l of listeners) l(plan);
}

export function onPlanChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function hasSetup(plan: Plan): boolean {
  return plan.updatedAt !== new Date(0).toISOString();
}

export function exportJson(plan: Plan): string {
  return JSON.stringify({ app: "outage-ready", version: 1, exportedAt: new Date().toISOString(), plan }, null, 2);
}

export function importJson(text: string): Plan {
  const parsed = JSON.parse(text) as { plan?: unknown } | Plan;
  const plan = "plan" in parsed && parsed.plan ? parsed.plan : parsed;
  return normalizePlan(plan);
}

export async function clearPlan(): Promise<void> {
  cached = null;
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}
