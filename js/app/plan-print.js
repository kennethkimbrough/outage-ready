import { SCENARIOS, formatHours, runScenario } from "../engine/index.js";
import { html, mount, raw } from "./ui.js";
/** The printable backup plan: contacts, key numbers, what fails first, what to do. */
export function renderPrintPlan(root, plan) {
    const reports = SCENARIOS.map((s) => ({ scenario: s, report: runScenario(plan, s.id) }));
    const inv = plan.inventory;
    const hh = plan.household;
    const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    // Top "during" tasks across scenarios, deduplicated by title.
    const during = new Map();
    const before = new Map();
    for (const { report } of reports) {
        for (const t of report.tasks) {
            const bucket = t.phase === "during" ? during : t.phase === "before" ? before : null;
            if (bucket && !bucket.has(t.title))
                bucket.set(t.title, t);
        }
    }
    const topDuring = [...during.values()].sort((a, b) => b.score - a.score).slice(0, 10);
    const topBefore = [...before.values()].filter((t) => !plan.completedTasks.includes(t.id)).sort((a, b) => b.score - a.score).slice(0, 8);
    mount(root, html `
    <div class="btn-row no-print">
      <button class="btn primary" onclick="window.print()">Print / Save as PDF</button>
      <a class="btn" href="#/setup/6">Edit contacts</a>
      <a class="btn quiet" href="#/data">Back up your data</a>
    </div>
    <article class="print-plan">
      <h1>Household backup plan</h1>
      <p class="muted">${hh.people.map((p) => p.label).join(", ")} · ${hh.people.length} ${hh.people.length === 1 ? "person" : "people"}${hh.pets.length ? `, ${hh.pets.reduce((s, p) => s + p.count, 0)} pets` : ""} · Floor ${hh.home.floor} · Updated ${date}</p>

      <h2>Emergency contacts</h2>
      ${inv.contacts.length ? html `
        <ul class="contacts list">
          ${inv.contacts.map((c) => html `<li><span><strong>${c.name || "—"}</strong> <span class="muted">${c.relation}${c.outOfArea ? " · out of area" : ""}</span></span><span class="phone">${c.phone}</span></li>`)}
        </ul>` : html `<p>No contacts entered. Write them here: <span class="fill"></span> <span class="fill"></span></p>`}
      <p>Local emergency number: <span class="fill"></span> &nbsp; Meeting point near home: <span class="fill"></span> &nbsp; Meeting point outside the area: <span class="fill"></span></p>

      <h2>What we have</h2>
      <div class="cols">
        <dl class="kv">
          <dt>Drinking water</dt><dd>${inv.waterLiters} L (${daysOf(inv.waterLiters, reports[0].report.result.dailyWaterLiters)} days)</dd>
          <dt>No-cook food</dt><dd>${inv.foodPersonDays} person-days (${daysOf(inv.foodPersonDays, hh.people.length)} days)</dd>
          <dt>Phones / power banks</dt><dd>${inv.phones} / ${inv.powerBanks.length}${inv.powerBanks.length ? ` (${inv.powerBanks.map((b) => `${b.ratedMah} mAh`).join(", ")})` : ""}</dd>
          <dt>Light</dt><dd>${inv.flashlights} flashlight${inv.flashlights === 1 ? "" : "s"}, ${inv.spareBatteries} spare batteries</dd>
          <dt>Radio</dt><dd>${inv.batteryRadio ? "yes" : "none"}</dd>
          <dt>Cooking</dt><dd>${hh.home.cooking}${hh.home.cooking === "camp-stove" ? ` (${inv.cookingFuelHours} h fuel)` : ""}</dd>
          <dt>Water supply</dt><dd>${hh.home.waterSupply === "electric-pump" ? "electric pump — stops with the power" : hh.home.waterSupply}</dd>
          <dt>Vehicle</dt><dd>${inv.vehicle.present ? `fuel ${Math.round(inv.vehicle.fuelFraction * 100)}%` : "none"}</dd>
          <dt>Cash</dt><dd>${inv.cashOnHand || "none"}</dd>
          ${inv.medications.map((m) => html `<dt>${m.label || "Medication"}</dt><dd>${m.dosesPerDay > 0 ? `${Math.floor(m.dosesOnHand / m.dosesPerDay)} days` : `${m.dosesOnHand} doses`}${m.requiresRefrigeration ? ", needs fridge" : ""}</dd>`)}
        </dl>
      </div>

      <h2>How long we can hold out</h2>
      <ul>
        ${reports.map(({ scenario, report }) => {
        const r = report.result;
        const first = r.failsFirst[0];
        return html `<li><strong>${scenario.name}</strong> (${formatHours(r.durationHours)}): ${r.holdsFullDuration ? "covered" : `covered for ${formatHours(r.sustainableHours)}`}${first ? `; first to fail: ${first.label}${first.failsAt === 0 ? " immediately" : ` at ${formatHours(first.failsAt)}`}` : ""}.</li>`;
    })}
      </ul>

      <h2>When the power goes out</h2>
      <ul>
        ${topDuring.map((t) => html `<li><strong>${t.title}.</strong> ${t.detail}</li>`)}
      </ul>

      ${topBefore.length ? html `
      <h2>Still to do</h2>
      <ul>
        ${topBefore.map((t) => html `<li>☐ ${t.title}</li>`)}
      </ul>` : ""}

      <h2>Key numbers</h2>
      <ul>
        <li>Water: at least 3.8 L per person per day; double it in very hot weather (Ready.gov).</li>
        <li>A closed fridge stays cold about 4 hours; a full freezer about 48 hours, half-full 24. Discard perishables kept above 40°F / 4°C for 4 hours or more (FDA).</li>
        <li>Insulin keeps up to 28 days at 59–86°F / 15–30°C. Never freeze it (FDA).</li>
        <li>About 70% of a power bank's rated mAh reaches your phone.</li>
      </ul>
      <p class="hint">Made with Outage Ready. All data stays on your device. ${raw("&nbsp;")}</p>
    </article>`);
}
function daysOf(amount, perDay) {
    if (perDay <= 0)
        return "∞";
    return (Math.round((amount / perDay) * 10) / 10).toString();
}
