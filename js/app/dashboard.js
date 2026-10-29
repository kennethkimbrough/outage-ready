import { SCENARIOS, formatHours, getScenario, runScenario, } from "../engine/index.js";
import { savePlan } from "./store.js";
import { timelineSvg, stockSpark } from "./timeline.js";
import { delegate, html, mount, num, raw, toast } from "./ui.js";
function verdictClass(report) {
    const r = report.result;
    if (r.holdsFullDuration)
        return "ok";
    return r.sustainableHours < r.durationHours / 2 ? "danger" : "fail";
}
function headline(report) {
    const r = report.result;
    if (r.holdsFullDuration)
        return `Covered for the full ${formatHours(r.durationHours)}`;
    if (r.sustainableHours === 0)
        return "A critical gap from the first hour";
    return `Covered for ${formatHours(r.sustainableHours)} of ${formatHours(r.durationHours)}`;
}
/** Home: one card per scenario with the verdict. */
export function renderHome(root, plan) {
    const reports = SCENARIOS.map((s) => ({ scenario: s, report: runScenario(plan, s.id) }));
    const people = plan.household.people.length;
    mount(root, html `
    <section>
      <h1>How long could you hold out?</h1>
      <p class="muted">${people} ${people === 1 ? "person" : "people"} in your household. Each scenario is simulated hour by hour from what you have on hand. Tap one to see what fails first and what to do.</p>
      <div class="scenario-grid">
        ${reports.map(({ scenario, report }) => {
        const cls = verdictClass(report);
        const r = report.result;
        const pct = Math.round((r.sustainableHours / r.durationHours) * 100);
        const first = r.failsFirst.find((n) => n.kind === "need" && n.severity >= 3) ?? r.failsFirst[0];
        return html `
            <a class="card scenario" href="#/scenario/${scenario.id}">
              <h2>${scenario.name}</h2>
              <div class="hint">${formatHours(r.durationHours)} · ${scenario.hazards.length} thing${scenario.hazards.length === 1 ? "" : "s"} down</div>
              <div class="verdict ${cls}">${headline(report)}</div>
              <div class="meter ${cls}"><i style="width:${pct}%"></i></div>
              ${first ? html `<div class="hint" style="margin-top:.4rem">First to fail: ${first.label}${first.failsAt === 0 ? " (immediately)" : ` at ${formatHours(first.failsAt)}`}</div>` : html `<div class="hint" style="margin-top:.4rem">Nothing fails in this window.</div>`}
            </a>`;
    })}
      </div>
    </section>
    <section class="card">
      <h2>Keep it honest</h2>
      <p class="muted">Results are only as good as the inventory. Walk the home with the phone and update the counts every season, after a shopping trip, and when medication changes.</p>
      <div class="btn-row">
        <a class="btn" href="#/setup">Update household</a>
        <a class="btn quiet" href="#/assumptions">Assumptions and sources</a>
      </div>
    </section>`);
}
/** One scenario: verdict, timeline, fails-first, gaps, tasks. */
export function renderScenario(root, plan, id) {
    let report = runScenario(plan, id);
    const scenario = getScenario(id, plan.durations[id]);
    const draw = () => {
        const r = report.result;
        const cls = verdictClass(report);
        const stocks = r.stocks.filter((s) => s.initial > 0);
        mount(root, html `
      <section class="card hero ${cls}">
        <div class="hint">${scenario.name}</div>
        <h1>${headline(report)}</h1>
        <p class="muted">${scenario.description}</p>
        <div class="duration">
          <label for="duration" class="hint">Outage length</label>
          <input id="duration" type="range" min="6" max="336" step="6" value="${r.durationHours}" data-action="duration">
          <output for="duration">${formatHours(r.durationHours)}</output>
        </div>
      </section>

      <section class="card">
        <h2>What fails when</h2>
        ${timelineSvg(r, Math.max(340, Math.min(640, root.clientWidth - 40)))}
        ${r.failsFirst.length === 0 ? html `<p class="muted">Every need is covered for the whole window.</p>` : ""}
      </section>

      ${r.failsFirst.length ? html `
      <section class="card">
        <h2>Fails first</h2>
        <ul class="list">
          ${r.failsFirst.slice(0, 8).map((n) => html `
            <li>
              <span class="when ${n.severity >= 4 ? "danger" : ""}">${n.failsAt === 0 ? "now" : formatHours(n.failsAt)}</span>
              <div>
                <div><strong>${n.label}</strong> ${n.kind === "capability" ? html `<span class="badge">capability</span>` : ""}</div>
                ${n.causes.length ? html `<div class="hint">Because: ${n.causes.join(", ")}</div>` : ""}
                ${n.why ? html `<div class="hint">${n.why}</div>` : ""}
              </div>
            </li>`)}
        </ul>
      </section>` : ""}

      ${r.timeline.filter((e) => e.kind === "warning").length ? html `
      <section class="card">
        <h2>Watch for</h2>
        <ul class="list">
          ${r.timeline.filter((e) => e.kind === "warning").map((e) => html `
            <li><span class="when">${formatHours(e.hour)}</span><div><strong>${e.label}</strong><div class="hint">${e.detail}</div></div></li>`)}
        </ul>
      </section>` : ""}

      <section>
        <h2>What to do</h2>
        ${renderTasks(report.tasks, plan)}
      </section>

      <section class="card">
        <details>
          <summary>Supplies over time</summary>
          <ul class="list">
            ${stocks.map((s) => html `
              <li>
                <div style="flex:1">
                  <div><strong>${s.label}</strong> <span class="hint">${fmt(s.initial)} ${s.unit}</span></div>
                  <div class="hint">${s.depletedAt === null ? "lasts the whole window" : `runs out at ${formatHours(s.depletedAt)}`}</div>
                </div>
                ${stockSpark(s.series)}
              </li>`)}
          </ul>
          <p class="hint" style="margin-top:.5rem">Daily water need in this scenario: ${fmt(r.dailyWaterLiters)} L. <a href="#/assumptions">Change the assumptions</a>.</p>
        </details>
      </section>

      <div class="btn-row no-print">
        <a class="btn" href="#/">All scenarios</a>
        <a class="btn primary" href="#/print">Print the backup plan</a>
      </div>`);
    };
    draw();
    root.addEventListener("input", async (ev) => {
        const t = ev.target;
        if (t.dataset.action === "duration") {
            plan.durations[id] = num(t.value, scenario.durationHours);
            report = runScenario(plan, id);
            // Update the output live; re-render the rest once the slider settles.
            const out = root.querySelector("output");
            if (out)
                out.textContent = formatHours(report.result.durationHours);
        }
    });
    root.addEventListener("change", async (ev) => {
        const t = ev.target;
        if (t.dataset.action === "duration") {
            await savePlan(plan);
            draw();
        }
    });
    bindTaskToggles(root, plan, () => { report = runScenario(plan, id); });
}
export function renderTasks(tasks, plan) {
    const phases = [
        { key: "now", title: "Do now", blurb: "Minutes, not money." },
        { key: "before", title: "Before the next outage", blurb: "Shopping and setup that closes the gaps above." },
        { key: "during", title: "During the outage", blurb: "Keep this list where you can read it by flashlight." },
    ];
    const done = new Set(plan.completedTasks);
    return html `${phases.map((ph) => {
        const list = tasks.filter((t) => t.phase === ph.key);
        if (!list.length)
            return "";
        const n = list.filter((t) => done.has(t.id)).length;
        return html `
      <div class="phase-title"><h3>${ph.title}</h3><span class="count">${n}/${list.length}</span></div>
      <div class="card">
        ${list.map((t) => html `
          <label class="task ${done.has(t.id) ? "done" : ""}">
            <input type="checkbox" data-action="task" data-task="${t.id}" ${done.has(t.id) ? "checked" : ""}>
            <div>
              <div class="title">${t.title}</div>
              <div class="detail">${t.detail}</div>
              <div class="meta">${severityWord(t.severity)}${t.hoursToFailure !== null && t.hoursToFailure > 0 ? ` · matters within ${formatHours(t.hoursToFailure)}` : ""}${t.source ? raw(` · <a href="${t.source.url}" target="_blank" rel="noopener">${t.source.title}</a>`) : ""}</div>
            </div>
          </label>`)}
      </div>`;
    })}`;
}
export function bindTaskToggles(root, plan, after) {
    root.addEventListener("change", async (ev) => {
        const t = ev.target;
        if (t.dataset.action !== "task")
            return;
        const id = t.dataset.task;
        const set = new Set(plan.completedTasks);
        if (t.checked)
            set.add(id);
        else
            set.delete(id);
        plan.completedTasks = [...set];
        t.closest(".task")?.classList.toggle("done", t.checked);
        await savePlan(plan);
        after?.();
        // Refresh the phase counters without a full redraw.
        const label = t.closest(".card")?.previousElementSibling?.querySelector(".count");
        const card = t.closest(".card");
        if (label && card) {
            const boxes = [...card.querySelectorAll("input[data-action=task]")];
            label.textContent = `${boxes.filter((b) => b.checked).length}/${boxes.length}`;
        }
    });
}
/** Checklist: every task from every scenario, deduplicated, with completion. */
export function renderChecklist(root, plan) {
    const all = new Map();
    for (const s of SCENARIOS) {
        const { tasks } = runScenario(plan, s.id);
        for (const t of tasks) {
            const key = t.id.startsWith("all:") ? t.id : t.id.replace(/^[a-z-]+:/, "*:");
            const existing = all.get(key);
            if (existing) {
                existing.scenarios.push(s.name);
                if (t.score > existing.score)
                    Object.assign(existing, t, { scenarios: existing.scenarios, id: existing.id });
            }
            else {
                all.set(key, { ...t, scenarios: [s.name] });
            }
        }
    }
    const tasks = [...all.values()].sort((a, b) => ({ now: 0, before: 1, during: 2 }[a.phase] - { now: 0, before: 1, during: 2 }[b.phase]) || b.score - a.score);
    const done = plan.completedTasks.length;
    mount(root, html `
    <section>
      <h1>Checklist</h1>
      <p class="muted">Everything the scenarios ask for, merged into one list. ${done ? `${done} ticked so far.` : "Tick things off as you do them; progress is saved on this device."}</p>
      ${renderTasks(tasks, plan)}
      <div class="btn-row">
        <button class="btn quiet danger" data-action="clear-done">Untick everything</button>
      </div>
    </section>`);
    bindTaskToggles(root, plan);
    delegate(root, "click", async (action) => {
        if (action === "clear-done") {
            plan.completedTasks = [];
            await savePlan(plan);
            renderChecklist(root, plan);
            toast("Checklist reset");
        }
    });
}
function severityWord(s) {
    return s >= 5 ? "Life safety" : s === 4 ? "Important" : s === 3 ? "Useful" : "Comfort";
}
function fmt(n) {
    return n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
}
