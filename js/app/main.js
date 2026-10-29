import { SCENARIOS, samplePlan } from "../engine/index.js";
import { renderAssumptions, renderData } from "./assumptions.js";
import { renderChecklist, renderHome, renderScenario } from "./dashboard.js";
import { renderPrintPlan } from "./plan-print.js";
import { hasSetup, loadPlan, savePlan } from "./store.js";
import { html, mount, toast } from "./ui.js";
import { parseStep, renderWizard } from "./wizard.js";
function setCurrentNav(route) {
    for (const a of document.querySelectorAll("nav a")) {
        const target = a.getAttribute("href") ?? "";
        const active = route === "home" ? target === "#/" : target.startsWith(`#/${route}`);
        if (active)
            a.setAttribute("aria-current", "page");
        else
            a.removeAttribute("aria-current");
    }
}
function renderWelcome(root) {
    mount(root, html `
    <section class="card empty">
      <h2>Know what you can sustain before the lights go out</h2>
      <p>Tell Outage Ready what your household has on hand. It works out how long each thing lasts in a power cut, a water outage, a heatwave, a storm or an evacuation, what fails first, and what to do about it. Everything stays on this device and keeps working with no signal.</p>
      <div class="btn-row" style="justify-content:center">
        <a class="btn primary" href="#/setup">Start with my household</a>
        <button class="btn" data-action="sample">Try a sample household</button>
      </div>
    </section>`);
    root.querySelector("[data-action=sample]")?.addEventListener("click", async () => {
        await savePlan(samplePlan());
        toast("Sample household loaded");
        void route();
    });
}
async function route() {
    const plan = await loadPlan();
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const [page, arg] = parts;
    window.scrollTo({ top: 0 });
    const old = document.getElementById("main");
    const root = old.cloneNode(false); // a fresh node drops the old listeners
    old.replaceWith(root);
    if (!hasSetup(plan) && page !== "setup") {
        setCurrentNav("home");
        renderWelcome(root);
        return;
    }
    switch (page) {
        case undefined:
        case "":
            setCurrentNav("home");
            renderHome(root, plan);
            break;
        case "setup":
            setCurrentNav("setup");
            renderWizard(root, plan, parseStep(arg));
            break;
        case "scenario": {
            setCurrentNav("home");
            const id = SCENARIOS.some((s) => s.id === arg) ? arg : "power";
            renderScenario(root, plan, id);
            break;
        }
        case "checklist":
            setCurrentNav("checklist");
            renderChecklist(root, plan);
            break;
        case "print":
            setCurrentNav("print");
            renderPrintPlan(root, plan);
            break;
        case "assumptions":
            setCurrentNav("assumptions");
            renderAssumptions(root, plan);
            break;
        case "data":
            setCurrentNav("data");
            renderData(root, plan);
            break;
        default:
            location.hash = "#/";
    }
}
window.addEventListener("hashchange", () => { void route(); });
void route();
// Offline indicator.
const badge = document.getElementById("offline-badge");
const updateOnline = () => { if (badge)
    badge.hidden = navigator.onLine; };
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
updateOnline();
// Service worker: cache-first, so the app opens with no network after the first visit.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { });
    });
}
