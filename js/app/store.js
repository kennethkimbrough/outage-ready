/**
 * Persistence: one plan, saved in IndexedDB under a fixed key. Nothing leaves
 * the device unless the user exports it. localStorage is used only as a
 * fallback when IndexedDB is unavailable (private mode on some browsers).
 */
import { emptyPlan } from "../engine/index.js";
const DB = "outage-ready";
const STORE = "plans";
const KEY = "current";
const LS_KEY = "outage-ready:plan";
let cached = null;
const listeners = new Set();
function openDb() {
    return new Promise((resolve) => {
        if (typeof indexedDB === "undefined")
            return resolve(null);
        try {
            const req = indexedDB.open(DB, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        }
        catch {
            resolve(null);
        }
    });
}
async function idbGet() {
    const db = await openDb();
    if (!db)
        return null;
    return new Promise((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
    });
}
async function idbPut(plan) {
    const db = await openDb();
    if (!db)
        return false;
    return new Promise((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(plan, KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
    });
}
function lsGet() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function lsPut(plan) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(plan));
    }
    catch {
        /* storage may be unavailable; the in-memory copy still works for the session */
    }
}
/** Fill in any fields missing from an older or hand-edited plan. */
export function normalizePlan(input) {
    const base = emptyPlan();
    if (!input || typeof input !== "object")
        return base;
    const p = input;
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
export async function loadPlan() {
    if (cached)
        return cached;
    const raw = (await idbGet()) ?? lsGet();
    cached = normalizePlan(raw);
    return cached;
}
export async function savePlan(plan) {
    plan.updatedAt = new Date().toISOString();
    cached = plan;
    const ok = await idbPut(plan);
    if (!ok)
        lsPut(plan);
    if (typeof document !== "undefined")
        document.body.dataset.savedAt = plan.updatedAt;
    for (const l of listeners)
        l(plan);
}
export function onPlanChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
export function hasSetup(plan) {
    return plan.updatedAt !== new Date(0).toISOString();
}
export function exportJson(plan) {
    return JSON.stringify({ app: "outage-ready", version: 1, exportedAt: new Date().toISOString(), plan }, null, 2);
}
export function importJson(text) {
    const parsed = JSON.parse(text);
    const plan = "plan" in parsed && parsed.plan ? parsed.plan : parsed;
    return normalizePlan(plan);
}
export async function clearPlan() {
    cached = null;
    const db = await openDb();
    if (db) {
        await new Promise((resolve) => {
            const tx = db.transaction(STORE, "readwrite");
            tx.objectStore(STORE).delete(KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    }
    try {
        localStorage.removeItem(LS_KEY);
    }
    catch { /* ignore */ }
}
