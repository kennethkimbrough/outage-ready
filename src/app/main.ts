import { SCENARIOS, formatHours, headlineNeed, runScenario, samplePlan, type Cause, type ScenarioId } from "../engine/index.js";
import { renderAssumptions, renderData } from "./assumptions.js";
import { renderChecklist, renderHome, renderScenario } from "./dashboard.js";
import { renderPrintPlan } from "./plan-print.js";
import { timelineSvg } from "./timeline.js";
import { hasSetup, loadPlan, savePlan } from "./store.js";
import { html, mount, toast } from "./ui.js";
import { parseStep, renderWizard } from "./wizard.js";

function setCurrentNav(route: string): void {
  for (const a of document.querySelectorAll<HTMLAnchorElement>("nav a")) {
    const target = a.getAttribute("href") ?? "";
    const active = route === "home" ? target === "#/" : target.startsWith(`#/${route}`);
    if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}

function renderWelcome(root: HTMLElement): void {
  // A worked example, simulated live from the sample household, so a first-time
  // visitor sees what the app produces before entering anything.
  const sample = samplePlan();
  const { result } = runScenario(sample, "power");
  const need = headlineNeed(result);
  const width = Math.max(320, Math.min(640, root.clientWidth - 40));
  const pct = Math.round((result.sustainableHours / result.durationHours) * 100);
  // "Water from the tap stopped at once (grid power down) · Stored water (12 L) ran out at 20 h"
  const leaf = (c: Cause): Cause => (c.children.length === 1 ? leaf(c.children[0]!) : c);
  const phrase = (c: Cause): string => {
    if (c.kind === "stock") return `${c.label}${c.amount ? ` (${c.amount})` : ""} ${c.reason ?? "ran out"}`;
    if (c.reason) return `${c.label}: ${c.reason}`;
    const root = leaf(c);
    const when = c.failsAt === 0 ? "stopped at once" : `stopped at ${formatHours(c.failsAt)}`;
    return `${c.label} ${when}${root !== c ? ` (${root.label.toLowerCase()} ${root.reason ?? "unavailable"})` : ""}`;
  };
  const chain = need?.because.map((c, i) => (i ? phrase(c).charAt(0).toLowerCase() + phrase(c).slice(1) : phrase(c))).join(", and ") ?? "";
  mount(root, html`
    <section class="welcome">
      <div class="kicker">Household outage planner</div>
      <h1>Know what you can sustain before the lights go out</h1>
      <p class="lead">Tell Outage Ready what your home has on hand. It plays a power cut, a water outage, a heatwave, a storm and an evacuation forward hour by hour, and shows how long you are covered, what fails first and why, and what to do now.</p>
      <div class="btn-row">
        <a class="btn primary" href="#/setup">Start with my household</a>
        <button class="btn" data-action="sample">Try a sample household</button>
      </div>
      <ul class="points">
        <li><b>6 scenarios</b><span>simulated hour by hour, each from 6 hours to 2 weeks</span></li>
        <li><b>The reason</b><span>behind every failure, traced back to what ran out</span></li>
        <li><b>Offline</b><span>after the first visit; your data never leaves this device</span></li>
      </ul>
    </section>
    <section class="card preview" aria-label="Example result">
      <div class="preview-head">
        <span class="badge">Example</span>
        <span class="hint">Two adults in a 4th-floor apartment whose water comes from an electric pump</span>
      </div>
      <h2>${result.scenarioName}: covered for ${formatHours(result.sustainableHours)} of ${formatHours(result.durationHours)}</h2>
      <div class="meter danger"><i style="width:${pct}%"></i></div>
      ${need ? html`<p class="preview-why"><strong>${need.label} fails at ${formatHours(need.failsAt!)}.</strong> ${chain ? html`${chain}.` : ""}</p>` : ""}
      ${timelineSvg(result, width)}
      <div class="btn-row"><button class="btn" data-action="sample">Explore this example</button></div>
    </section>`);
  root.querySelectorAll("[data-action=sample]").forEach((el) => el.addEventListener("click", async () => {
    await savePlan(samplePlan());
    toast("Sample household loaded");
    void route();
  }));
}

async function route(): Promise<void> {
  const plan = await loadPlan();
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [page, arg] = parts;
  window.scrollTo({ top: 0 });
  const old = document.getElementById("main")!;
  const root = old.cloneNode(false) as HTMLElement; // a fresh node drops the old listeners
  old.replaceWith(root);

  if (!hasSetup(plan) && page !== "setup") {
    setCurrentNav("home");
    renderWelcome(root);
    return;
  }
  switch (page) {
    case undefined:
    case "":
      setCurrentNav("home"); renderHome(root, plan); break;
    case "setup":
      setCurrentNav("setup"); renderWizard(root, plan, parseStep(arg)); break;
    case "scenario": {
      setCurrentNav("home");
      const id = SCENARIOS.some((s) => s.id === arg) ? (arg as ScenarioId) : "power";
      renderScenario(root, plan, id); break;
    }
    case "checklist": setCurrentNav("checklist"); renderChecklist(root, plan); break;
    case "print": setCurrentNav("print"); renderPrintPlan(root, plan); break;
    case "assumptions": setCurrentNav("assumptions"); renderAssumptions(root, plan); break;
    case "data": setCurrentNav("data"); renderData(root, plan); break;
    default:
      location.hash = "#/";
  }
}

window.addEventListener("hashchange", () => { void route(); });
void route();

// Offline indicator.
const badge = document.getElementById("offline-badge");
const updateOnline = () => { if (badge) badge.hidden = navigator.onLine; };
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);
updateOnline();

// Service worker: cache-first, so the app opens with no network after the first visit.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline support unavailable (e.g. file://) */ });
  });
}
