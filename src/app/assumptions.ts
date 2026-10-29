import { DEFAULT_ASSUMPTIONS, type Plan } from "../engine/index.js";
import { clearPlan, exportJson, importJson, savePlan } from "./store.js";
import { delegate, html, mount, num, toast } from "./ui.js";

/** Every number the engine uses, with its source, editable. */
export function renderAssumptions(root: Element, plan: Plan): void {
  mount(root, html`
    <section>
      <h1>Assumptions</h1>
      <p class="muted">Every figure the simulation uses, where it came from, and a box to change it. Values marked "Set by you" have no official figure, so adjust them to your own gear and habits.</p>
      <div class="card">
        <table class="assumptions">
          <thead><tr><th>Assumption</th><th>Value</th></tr></thead>
          <tbody>
            ${DEFAULT_ASSUMPTIONS.map((a) => {
              const current = plan.overrides[a.key] ?? a.value;
              const changed = plan.overrides[a.key] !== undefined && plan.overrides[a.key] !== a.value;
              return html`
                <tr>
                  <td>
                    <div><strong>${a.label}</strong>${changed ? html` <span class="badge">edited</span>` : ""}</div>
                    <div class="hint">${a.note ?? ""} ${a.source.url ? html`<a href="${a.source.url}" target="_blank" rel="noopener">${a.source.title}</a>` : html`<em>${a.source.title}</em>`}</div>
                  </td>
                  <td>
                    <input type="number" step="any" min="0" value="${current}" data-key="${a.key}" aria-label="${a.label}" inputmode="decimal">
                    <div class="hint">${a.unit}${changed ? html` · default ${a.value}` : ""}</div>
                  </td>
                </tr>`;
            })}
          </tbody>
        </table>
        <div class="btn-row">
          <button class="btn quiet" data-action="reset">Reset all to defaults</button>
        </div>
      </div>
    </section>`);

  root.addEventListener("change", async (ev) => {
    const t = ev.target as HTMLInputElement;
    const key = t.dataset.key;
    if (!key) return;
    const value = num(t.value, NaN);
    if (!Number.isFinite(value) || value < 0) { toast("Enter a number of zero or more"); return; }
    const def = DEFAULT_ASSUMPTIONS.find((a) => a.key === key)!;
    if (value === def.value) delete plan.overrides[key]; else plan.overrides[key] = value;
    await savePlan(plan);
    toast("Saved");
    renderAssumptions(root, plan);
  });
  delegate(root, "click", async (action) => {
    if (action === "reset") {
      plan.overrides = {};
      await savePlan(plan);
      renderAssumptions(root, plan);
      toast("Defaults restored");
    }
  });
}

/** Export, import and erase. */
export function renderData(root: Element, plan: Plan): void {
  mount(root, html`
    <section>
      <h1>Your data</h1>
      <p class="muted">Everything lives in this browser on this device. Export a file to back it up or move it to another device; import it there.</p>
      <div class="card">
        <div class="btn-row">
          <button class="btn primary" data-action="export">Export as JSON</button>
          <label class="btn">Import a file <input type="file" accept="application/json,.json" data-action="import" hidden></label>
        </div>
        <p class="hint" style="margin-top:.75rem">Last saved ${new Date(plan.updatedAt).toLocaleString()}</p>
      </div>
      <div class="card">
        <h2>Start over</h2>
        <p class="muted">Erases the household, inventory, assumptions and ticked tasks from this device.</p>
        <button class="btn danger" data-action="erase">Erase everything</button>
      </div>
    </section>`);

  delegate(root, "click", async (action) => {
    if (action === "export") {
      const blob = new Blob([exportJson(plan)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `outage-ready-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (action === "erase") {
      if (!confirm("Erase everything on this device?")) return;
      await clearPlan();
      toast("Erased");
      location.hash = "#/setup";
    }
  });
  root.addEventListener("change", async (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.dataset.action !== "import" || !t.files?.[0]) return;
    try {
      const imported = importJson(await t.files[0].text());
      await savePlan(imported);
      toast("Imported");
      location.hash = "#/";
    } catch {
      toast("That file isn't an Outage Ready export");
    }
  });
}
