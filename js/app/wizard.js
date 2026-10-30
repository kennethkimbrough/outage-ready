import { savePlan } from "./store.js";
import { delegate, html, mount, num, toast, uid } from "./ui.js";
const STEPS = ["People", "Home", "Water and food", "Power and light", "Medication", "Transport and money", "Contacts"];
const AGE_LABELS = { infant: "Under 2", child: "Child", adult: "Adult", older: "65+" };
export function renderWizard(root, plan, step = 0) {
    const hh = plan.household;
    const inv = plan.inventory;
    const progress = html `<div class="progress" aria-label="Step ${step + 1} of ${STEPS.length}">
    ${STEPS.map((_, i) => html `<i class="${i < step ? "done" : i === step ? "current" : ""}"></i>`)}
  </div>
  <div class="hint">Step ${step + 1} of ${STEPS.length}</div>`;
    const nav = (skipLabel) => html `
    <div class="btn-row">
      ${step > 0 ? html `<button class="btn" type="button" data-action="back">Back</button>` : html `<a class="btn" href="#/">Cancel</a>`}
      <span class="spacer"></span>
      ${skipLabel ? html `<button class="btn quiet" type="button" data-action="skip">${skipLabel}</button>` : ""}
      <button class="btn primary" type="submit">${step === STEPS.length - 1 ? "See my scenarios" : "Next"}</button>
    </div>`;
    let body;
    switch (step) {
        case 0:
            body = html `
        <h1>Who lives here?</h1>
        <p class="muted">Water, food and medicine needs scale with people. Age matters for heat and evacuation.</p>
        <ul class="sub-list">
          ${hh.people.map((p) => html `
            <li>
              <div>
                <input type="text" value="${p.label}" aria-label="Name" data-field="label" data-id="${p.id}" style="margin-bottom:.4rem">
                <div class="chips" role="group" aria-label="Age group">
                  ${Object.keys(AGE_LABELS).map((g) => html `<button type="button" class="chip" aria-pressed="${p.ageGroup === g}" data-action="age" data-id="${p.id}" data-age="${g}">${AGE_LABELS[g]}</button>`)}
                </div>
                <div class="chips" style="margin-top:.4rem">
                  <button type="button" class="chip" aria-pressed="${!!p.needsPoweredDevice}" data-action="flag" data-id="${p.id}" data-flag="needsPoweredDevice">Uses a powered medical device</button>
                  <button type="button" class="chip" aria-pressed="${!!p.limitedMobility}" data-action="flag" data-id="${p.id}" data-flag="limitedMobility">Limited mobility</button>
                  <button type="button" class="chip" aria-pressed="${!!p.pregnantOrNursing}" data-action="flag" data-id="${p.id}" data-flag="pregnantOrNursing">Pregnant or nursing</button>
                </div>
              </div>
              <button type="button" class="btn quiet danger" data-action="remove-person" data-id="${p.id}" aria-label="Remove ${p.label}">Remove</button>
            </li>`)}
        </ul>
        <div class="btn-row"><button type="button" class="btn" data-action="add-person">Add a person</button></div>
        <h2 style="margin-top:1.5rem">Pets</h2>
        <ul class="sub-list">
          ${hh.pets.map((p) => html `
            <li>
              <div class="row">
                <select data-field="kind" data-pet="${p.id}" aria-label="Kind of pet">
                  ${["dog", "cat", "other"].map((k) => html `<option value="${k}" ${p.kind === k ? "selected" : ""}>${k}</option>`)}
                </select>
                <input type="number" min="1" value="${p.count}" data-field="count" data-pet="${p.id}" aria-label="How many">
              </div>
              <button type="button" class="btn quiet danger" data-action="remove-pet" data-id="${p.id}">Remove</button>
            </li>`)}
        </ul>
        <div class="btn-row"><button type="button" class="btn" data-action="add-pet">Add a pet</button></div>
        ${nav()}`;
            break;
        case 1:
            body = html `
        <h1>Your home</h1>
        <p class="muted">These decide what depends on what. A pumped water supply stops with the power; gas cooking doesn't.</p>
        <fieldset class="field"><span>How does water reach your taps?</span>
          <div class="choice">
            ${choice("waterSupply", "gravity", hh.home.waterSupply, "Mains pressure or a rooftop tank", "Keeps flowing without power, at least for a while.")}
            ${choice("waterSupply", "electric-pump", hh.home.waterSupply, "An electric pump or a well", "Common in apartment blocks and houses with wells. Stops the moment the power does.")}
            ${choice("waterSupply", "bottled-only", hh.home.waterSupply, "Bottled or delivered water only", "You drink bottled water even when the tap runs, so your stored water counts from the first hour.")}
          </div>
        </fieldset>
        <fieldset class="field"><span>Cooking</span>
          <div class="choice">
            ${choice("cooking", "electric", hh.home.cooking, "Electric stove or induction", "Needs power.")}
            ${choice("cooking", "gas", hh.home.cooking, "Piped gas or a large gas cylinder", "Works through a power cut.")}
            ${choice("cooking", "camp-stove", hh.home.cooking, "Camp stove or small canisters", "You will enter the fuel on the next step.")}
            ${choice("cooking", "none", hh.home.cooking, "No way to cook without power", "")}
          </div>
        </fieldset>
        <div class="row">
          <label class="field"><span>Cooling</span>
            <select name="cooling">
              <option value="ac" ${hh.home.cooling === "ac" ? "selected" : ""}>Air conditioning</option>
              <option value="fan" ${hh.home.cooling === "fan" ? "selected" : ""}>Fans</option>
              <option value="none" ${hh.home.cooling === "none" ? "selected" : ""}>None</option>
            </select>
          </label>
          <label class="field"><span>Climate</span>
            <select name="climate">
              <option value="temperate" ${hh.home.climate === "temperate" ? "selected" : ""}>Temperate</option>
              <option value="hot" ${hh.home.climate === "hot" ? "selected" : ""}>Hot (water need doubles)</option>
            </select>
          </label>
        </div>
        <div class="row">
          <label class="field"><span>Floor</span><input type="number" name="floor" min="0" max="80" value="${hh.home.floor}"><span class="hint">0 = ground. Lifts stop with the power.</span></label>
          <label class="field"><span>Freezer</span>
            <select name="freezerFullness">
              <option value="full" ${hh.home.freezerFullness === "full" ? "selected" : ""}>Full</option>
              <option value="half" ${hh.home.freezerFullness === "half" ? "selected" : ""}>Half full</option>
              <option value="empty" ${hh.home.freezerFullness === "empty" ? "selected" : ""}>Empty or none</option>
            </select>
          </label>
        </div>
        <label class="toggle"><input type="checkbox" name="hasFridge" ${hh.home.hasFridge ? "checked" : ""}> We have a fridge</label>
        ${nav()}`;
            break;
        case 2:
            body = html `
        <h1>Water and food</h1>
        <p class="muted">Count what is actually in the home right now, not what you plan to buy.</p>
        <label class="field"><span>Stored drinking water (litres)</span>
          <input type="number" name="waterLiters" min="0" step="0.5" value="${inv.waterLiters}" inputmode="decimal">
          <span class="hint">Bottles, jugs, water-cooler refills. A 19 L cooler bottle counts as 19. Ready.gov suggests about 3.8 L per person per day.</span>
        </label>
        <label class="field"><span>Food that needs no fridge, in person-days</span>
          <input type="number" name="foodPersonDays" min="0" step="0.5" value="${inv.foodPersonDays}" inputmode="decimal">
          <span class="hint">Rice, noodles, cans, crackers, nut butter. "One person eating for one day" = 1. A full shelf for two people for three days = 6.</span>
        </label>
        <label class="field"><span>Food in the fridge, in person-days</span>
          <input type="number" name="perishableFoodPersonDays" min="0" step="0.5" value="${inv.perishableFoodPersonDays}" inputmode="decimal">
          <span class="hint">Eaten first; it spoils about 8 hours into a power cut.</span>
        </label>
        ${hh.home.cooking === "camp-stove" ? html `
        <label class="field"><span>Stove fuel, in hours of burn time</span>
          <input type="number" name="cookingFuelHours" min="0" step="0.5" value="${inv.cookingFuelHours}" inputmode="decimal">
          <span class="hint">A 230 g gas canister is usually around 1–1.5 hours on high; check the packaging.</span>
        </label>` : ""}
        ${nav("Skip, I have none")}`;
            break;
        case 3:
            body = html `
        <h1>Power and light</h1>
        <div class="field"><span>Phones in the household</span>
          <div class="stepper">
            <button type="button" data-action="dec" data-field="phones" aria-label="Fewer">−</button>
            <output>${inv.phones}</output>
            <button type="button" data-action="inc" data-field="phones" aria-label="More">+</button>
          </div>
        </div>
        <label class="field"><span>Typical phone charge right now</span>
          <input type="range" name="phoneCharge" min="0" max="100" step="5" value="${Math.round(inv.phoneCharge * 100)}" data-action="pct">
          <output>${Math.round(inv.phoneCharge * 100)}%</output>
        </label>
        <h2>Power banks</h2>
        <ul class="sub-list">
          ${inv.powerBanks.map((b) => html `
            <li>
              <div class="row">
                <input type="text" value="${b.label}" data-field="label" data-bank="${b.id}" aria-label="Name">
                <input type="number" value="${b.ratedMah}" min="0" step="1000" data-field="ratedMah" data-bank="${b.id}" aria-label="Rated mAh" inputmode="numeric">
              </div>
              <button type="button" class="btn quiet danger" data-action="remove-bank" data-id="${b.id}">Remove</button>
            </li>`)}
        </ul>
        <div class="btn-row"><button type="button" class="btn" data-action="add-bank">Add a power bank</button></div>
        <p class="hint">Rated mAh is printed on the bank. About 70% of it reaches a phone.</p>
        <div class="row">
          <label class="field"><span>Flashlights</span><input type="number" name="flashlights" min="0" value="${inv.flashlights}" inputmode="numeric"></label>
          <label class="field"><span>Spare batteries</span><input type="number" name="spareBatteries" min="0" value="${inv.spareBatteries}" inputmode="numeric"></label>
        </div>
        <label class="toggle"><input type="checkbox" name="batteryRadio" ${inv.batteryRadio ? "checked" : ""}> We have a battery or hand-crank radio</label>
        <details style="margin-top:1rem">
          <summary>Generator</summary>
          <div class="row">
            <label class="field"><span>Fuel on hand (litres)</span><input type="number" name="generatorFuelLiters" min="0" step="0.5" value="${inv.generatorFuelLiters}" inputmode="decimal"></label>
            <label class="field"><span>Litres per hour</span><input type="number" name="generatorLitersPerHour" min="0" step="0.1" value="${inv.generatorLitersPerHour}" inputmode="decimal"></label>
          </div>
        </details>
        ${nav("Skip, I have none")}`;
            break;
        case 4:
            body = html `
        <h1>Medication</h1>
        <p class="muted">Only days of supply and whether it needs the fridge. Nothing here is medical advice.</p>
        <ul class="sub-list">
          ${inv.medications.map((m) => html `
            <li>
              <div>
                <input type="text" value="${m.label}" data-field="label" data-med="${m.id}" aria-label="Medication" placeholder="Name" style="margin-bottom:.4rem">
                <div class="row">
                  <label class="field"><span class="hint">Doses on hand</span><input type="number" min="0" value="${m.dosesOnHand}" data-field="dosesOnHand" data-med="${m.id}" inputmode="numeric"></label>
                  <label class="field"><span class="hint">Doses per day</span><input type="number" min="0" step="0.5" value="${m.dosesPerDay}" data-field="dosesPerDay" data-med="${m.id}" inputmode="decimal"></label>
                </div>
                <label class="toggle"><input type="checkbox" data-field="requiresRefrigeration" data-med="${m.id}" ${m.requiresRefrigeration ? "checked" : ""}> Needs refrigeration (insulin, some biologics)</label>
              </div>
              <button type="button" class="btn quiet danger" data-action="remove-med" data-id="${m.id}">Remove</button>
            </li>`)}
        </ul>
        <div class="btn-row"><button type="button" class="btn" data-action="add-med">Add a medication</button></div>
        <label class="toggle" style="margin-top:1rem"><input type="checkbox" name="firstAidKit" ${inv.firstAidKit ? "checked" : ""}> We have a first-aid kit</label>
        ${nav("Skip, none needed")}`;
            break;
        case 5:
            body = html `
        <h1>Transport and money</h1>
        <label class="toggle"><input type="checkbox" name="vehiclePresent" ${inv.vehicle.present ? "checked" : ""}> We have a car or motorbike</label>
        <div class="row" style="margin-top:.75rem">
          <label class="field"><span>Fuel in the tank</span>
            <select name="fuelFraction">
              ${[1, 0.75, 0.5, 0.25, 0.1].map((f) => html `<option value="${f}" ${Math.abs(inv.vehicle.fuelFraction - f) < 0.01 ? "selected" : ""}>${Math.round(f * 100)}%</option>`)}
            </select>
          </label>
          <label class="field"><span>Range on a full tank (km)</span><input type="number" name="rangeKmFullTank" min="0" value="${inv.vehicle.rangeKmFullTank}" inputmode="numeric"></label>
        </div>
        <label class="field"><span>Cash at home</span>
          <input type="number" name="cashOnHand" min="0" value="${inv.cashOnHand}" inputmode="numeric">
          <span class="hint">Any currency. Card machines and ATMs need power and a network.</span>
        </label>
        ${nav("Skip")}`;
            break;
        default:
            body = html `
        <h1>Emergency contacts</h1>
        <p class="muted">These print on the backup plan. One contact outside your area helps when local networks jam.</p>
        <ul class="sub-list">
          ${inv.contacts.map((c) => html `
            <li>
              <div>
                <div class="row">
                  <input type="text" value="${c.name}" placeholder="Name" data-field="name" data-contact="${c.id}" aria-label="Name">
                  <input type="tel" value="${c.phone}" placeholder="Phone" data-field="phone" data-contact="${c.id}" aria-label="Phone">
                </div>
                <div class="row" style="margin-top:.4rem">
                  <input type="text" value="${c.relation}" placeholder="Relation (family, neighbour, doctor)" data-field="relation" data-contact="${c.id}" aria-label="Relation">
                  <label class="toggle"><input type="checkbox" data-field="outOfArea" data-contact="${c.id}" ${c.outOfArea ? "checked" : ""}> Lives out of area</label>
                </div>
              </div>
              <button type="button" class="btn quiet danger" data-action="remove-contact" data-id="${c.id}">Remove</button>
            </li>`)}
        </ul>
        <div class="btn-row"><button type="button" class="btn" data-action="add-contact">Add a contact</button></div>
        ${nav("Skip for now")}`;
    }
    mount(root, html `<form class="card" novalidate>${progress}${body}</form>`);
    const form = root.querySelector("form");
    const readStep = () => {
        const f = new FormData(form);
        const v = (k) => f.get(k);
        switch (step) {
            case 1:
                hh.home.waterSupply = v("waterSupply") ?? hh.home.waterSupply;
                hh.home.cooking = v("cooking") ?? hh.home.cooking;
                hh.home.cooling = v("cooling") ?? hh.home.cooling;
                hh.home.climate = v("climate") ?? hh.home.climate;
                hh.home.floor = num(v("floor"), 0);
                hh.home.freezerFullness = v("freezerFullness") ?? hh.home.freezerFullness;
                hh.home.hasFridge = f.has("hasFridge");
                hh.home.hasFreezer = hh.home.freezerFullness !== "empty";
                break;
            case 2:
                inv.waterLiters = num(v("waterLiters"));
                inv.foodPersonDays = num(v("foodPersonDays"));
                inv.perishableFoodPersonDays = num(v("perishableFoodPersonDays"));
                if (f.has("cookingFuelHours"))
                    inv.cookingFuelHours = num(v("cookingFuelHours"));
                break;
            case 3:
                inv.phoneCharge = num(v("phoneCharge"), 50) / 100;
                inv.flashlights = num(v("flashlights"));
                inv.spareBatteries = num(v("spareBatteries"));
                inv.batteryRadio = f.has("batteryRadio");
                inv.generatorFuelLiters = num(v("generatorFuelLiters"));
                inv.generatorLitersPerHour = num(v("generatorLitersPerHour"));
                break;
            case 4:
                inv.firstAidKit = f.has("firstAidKit");
                break;
            case 5:
                inv.vehicle.present = f.has("vehiclePresent");
                inv.vehicle.fuelFraction = num(v("fuelFraction"), 0.5);
                inv.vehicle.rangeKmFullTank = num(v("rangeKmFullTank"), 400);
                inv.cashOnHand = num(v("cashOnHand"));
                break;
            default:
                break;
        }
    };
    const go = async (next, options = {}) => {
        if (options.skip) {
            if (step === 2) {
                inv.waterLiters = 0;
                inv.foodPersonDays = 0;
                inv.perishableFoodPersonDays = 0;
                inv.cookingFuelHours = 0;
            }
            if (step === 3) {
                inv.powerBanks = [];
                inv.flashlights = 0;
                inv.spareBatteries = 0;
                inv.batteryRadio = false;
                inv.generatorFuelLiters = 0;
            }
            if (step === 4) {
                inv.medications = [];
            }
            if (step === 5) {
                inv.vehicle.present = false;
                inv.cashOnHand = 0;
            }
            if (step === 6) {
                inv.contacts = [];
            }
        }
        else {
            readStep();
        }
        if (step === 0 && hh.people.length === 0) {
            toast("Add at least one person");
            return;
        }
        await savePlan(plan);
        if (next >= STEPS.length) {
            toast("Saved. Here are your scenarios.");
            location.hash = "#/";
            return;
        }
        location.hash = `#/setup/${next}`;
    };
    form.addEventListener("submit", (ev) => { ev.preventDefault(); void go(step + 1); });
    // Live edits for list items (name fields, chips, counters).
    form.addEventListener("input", (ev) => {
        const t = ev.target;
        if (t.dataset.id && t.dataset.field === "label") {
            const p = hh.people.find((x) => x.id === t.dataset.id);
            if (p)
                p.label = t.value;
        }
        if (t.dataset.pet) {
            const p = hh.pets.find((x) => x.id === t.dataset.pet);
            if (p) {
                if (t.dataset.field === "kind")
                    p.kind = t.value;
                else
                    p.count = Math.max(1, num(t.value, 1));
            }
        }
        if (t.dataset.bank) {
            const b = inv.powerBanks.find((x) => x.id === t.dataset.bank);
            if (b) {
                if (t.dataset.field === "label")
                    b.label = t.value;
                else
                    b.ratedMah = num(t.value);
            }
        }
        if (t.dataset.med) {
            const m = inv.medications.find((x) => x.id === t.dataset.med);
            if (m) {
                if (t.dataset.field === "label")
                    m.label = t.value;
                else if (t.dataset.field === "dosesOnHand")
                    m.dosesOnHand = num(t.value);
                else if (t.dataset.field === "dosesPerDay")
                    m.dosesPerDay = num(t.value);
                else if (t.dataset.field === "requiresRefrigeration")
                    m.requiresRefrigeration = t.checked;
            }
        }
        if (t.dataset.contact) {
            const c = inv.contacts.find((x) => x.id === t.dataset.contact);
            if (c) {
                if (t.dataset.field === "outOfArea")
                    c.outOfArea = t.checked;
                else
                    c[t.dataset.field] = t.value;
            }
        }
        if (t.dataset.action === "pct") {
            const out = t.parentElement?.querySelector("output");
            if (out)
                out.textContent = `${t.value}%`;
        }
    });
    delegate(form, "click", (action, target) => {
        const id = target.dataset.id;
        const rerender = () => { readStep(); renderWizard(root, plan, step); };
        switch (action) {
            case "back":
                readStep();
                void savePlan(plan).then(() => { location.hash = `#/setup/${step - 1}`; });
                break;
            case "skip":
                void go(step + 1, { skip: true });
                break;
            case "add-person":
                hh.people.push({ id: uid("p"), label: `Person ${hh.people.length + 1}`, ageGroup: "adult" });
                rerender();
                break;
            case "remove-person":
                hh.people = hh.people.filter((p) => p.id !== id);
                rerender();
                break;
            case "age": {
                const p = hh.people.find((x) => x.id === id);
                if (p)
                    p.ageGroup = target.dataset.age;
                rerender();
                break;
            }
            case "flag": {
                const p = hh.people.find((x) => x.id === id);
                if (p) {
                    const k = target.dataset.flag;
                    p[k] = !p[k];
                }
                rerender();
                break;
            }
            case "add-pet":
                hh.pets.push({ id: uid("pet"), kind: "dog", count: 1 });
                rerender();
                break;
            case "remove-pet":
                hh.pets = hh.pets.filter((p) => p.id !== id);
                rerender();
                break;
            case "add-bank":
                inv.powerBanks.push({ id: uid("b"), label: `Power bank ${inv.powerBanks.length + 1}`, ratedMah: 10000, charge: 1 });
                rerender();
                break;
            case "remove-bank":
                inv.powerBanks = inv.powerBanks.filter((b) => b.id !== id);
                rerender();
                break;
            case "add-med":
                inv.medications.push({ id: uid("m"), label: "", dosesOnHand: 30, dosesPerDay: 1, requiresRefrigeration: false });
                rerender();
                break;
            case "remove-med":
                inv.medications = inv.medications.filter((m) => m.id !== id);
                rerender();
                break;
            case "add-contact":
                inv.contacts.push({ id: uid("c"), name: "", phone: "", relation: "", outOfArea: false });
                rerender();
                break;
            case "remove-contact":
                inv.contacts = inv.contacts.filter((c) => c.id !== id);
                rerender();
                break;
            case "inc":
                inv.phones = Math.min(20, inv.phones + 1);
                rerender();
                break;
            case "dec":
                inv.phones = Math.max(0, inv.phones - 1);
                rerender();
                break;
            default: break;
        }
    });
}
function choice(name, value, current, title, sub) {
    return html `<label><input type="radio" name="${name}" value="${value}" ${current === value ? "checked" : ""}><span>${title}${sub ? html `<span class="sub">${sub}</span>` : ""}</span></label>`;
}
export function parseStep(s) {
    const n = Math.max(0, Math.min(STEPS.length - 1, Math.floor(num(s, 0))));
    return n;
}
