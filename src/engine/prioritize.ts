import { assumptionMap } from "./assumptions.js";
import type { SimulationResult } from "./simulate.js";
import type { AssumptionOverrides, Household, Inventory, Scenario } from "./types.js";

export type Phase = "now" | "before" | "during";

export interface Task {
  /** Stable id so completion survives re-runs: `${scenario or 'all'}:${slug}`. */
  id: string;
  phase: Phase;
  title: string;
  detail: string;
  /** 1..5 */
  severity: number;
  /** 1 (minutes) .. 3 (a trip or a purchase) */
  effort: number;
  /** Hours until the related failure, if any. */
  hoursToFailure: number | null;
  score: number;
  source?: { title: string; url: string };
}

const SRC = {
  water: { title: "Ready.gov: Water", url: "https://www.ready.gov/water" },
  fda: { title: "FDA: Food safety during power outages", url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-and-water-safety-during-power-outages-and-floods" },
  insulin: { title: "FDA: Insulin storage in an emergency", url: "https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency" },
  pets: { title: "CDC: Pet disaster kit", url: "https://www.cdc.gov/healthy-pets/emergency-preparedness/preparedness-kit.html" },
};

const PHASE_ORDER: Record<Phase, number> = { now: 0, before: 1, during: 2 };

export function scoreTask(severity: number, hoursToFailure: number | null, effort: number): number {
  const urgency = hoursToFailure === null ? 1 : 1 + 48 / (hoursToFailure + 1);
  return Math.round((severity * urgency / effort) * 100) / 100;
}

interface Ctx {
  household: Household;
  inventory: Inventory;
  scenario: Scenario;
  result: SimulationResult;
  A: Record<string, number>;
}

export function prioritize(
  household: Household,
  inventory: Inventory,
  scenario: Scenario,
  result: SimulationResult,
  overrides: AssumptionOverrides = {},
): Task[] {
  const ctx: Ctx = { household, inventory, scenario, result, A: assumptionMap(overrides) };
  const tasks: Task[] = [];
  const add = (t: Omit<Task, "score">) => {
    if (tasks.some((x) => x.id === t.id)) return;
    tasks.push({ ...t, score: scoreTask(t.severity, t.hoursToFailure, t.effort) });
  };
  const fails = (id: string) => result.nodes.find((n) => n.id === id)?.failsAt ?? null;
  const hz = (h: string) => scenario.hazards.includes(h as never);
  const people = household.people.length;
  const days = result.durationHours / 24;
  const sid = scenario.id;

  // Water.
  const waterNeeded = result.dailyWaterLiters * days;
  const waterFail = fails("need:hydration");
  if (waterFail !== null || (hz("tap-water") && inventory.waterLiters < waterNeeded)) {
    const shortfall = Math.max(0, waterNeeded - inventory.waterLiters);
    add({ id: `${sid}:store-water`, phase: "before", severity: 5, effort: 2, hoursToFailure: waterFail,
      title: `Store about ${Math.ceil(shortfall)} L more water`,
      detail: `${people} ${people === 1 ? "person" : "people"} for ${Math.round(days * 10) / 10} days needs about ${Math.ceil(waterNeeded)} L (Ready.gov: at least 1 gallon per person per day${result.dailyWaterLiters > people * ctx.A["water.litersPerPersonPerDay"]! ? ", doubled for heat" : ""}). You have ${inventory.waterLiters} L.`,
      source: SRC.water });
  }
  if (household.home.waterSupply === "electric-pump" && (hz("grid-power") || hz("tap-water"))) {
    add({ id: `${sid}:fill-containers`, phase: "before", severity: 4, effort: 1, hoursToFailure: waterFail,
      title: "Fill the bathtub and every clean container when a warning is issued",
      detail: "Your tap depends on an electric pump, so it stops the moment the power does. Bathtub water covers flushing and washing; keep bottled water for drinking." });
  }
  if (household.people.some((p) => p.pregnantOrNursing || p.ageGroup === "infant")) {
    add({ id: `${sid}:extra-water-vulnerable`, phase: "before", severity: 3, effort: 1, hoursToFailure: null,
      title: "Add extra water for infants or nursing mothers",
      detail: "Ready.gov notes children, nursing mothers and sick people may need more than the baseline gallon per day.", source: SRC.water });
  }
  const petCount = household.pets.reduce((s, p) => s + p.count, 0);
  if (petCount > 0) {
    add({ id: `all:pet-supplies`, phase: "before", severity: 3, effort: 2, hoursToFailure: null,
      title: `Keep a two-week supply of food and water for ${petCount === 1 ? "your pet" : "each pet"}`,
      detail: ctx.A["water.litersPerPetPerDay"] === 0
        ? "CDC recommends a two-week supply per animal. Pet water is not yet counted in your plan: set 'Water per pet per day' in Assumptions."
        : "CDC recommends a two-week supply of food and water per animal.", source: SRC.pets });
  }

  // Food.
  const foodFail = fails("need:food");
  if (foodFail !== null) {
    const needDays = people * days;
    add({ id: `${sid}:stock-food`, phase: "before", severity: 4, effort: 2, hoursToFailure: foodFail,
      title: `Stock about ${Math.ceil(Math.max(0, needDays - inventory.foodPersonDays))} more person-days of no-cook food`,
      detail: `Food runs out around hour ${foodFail}. Canned, dried and ready-to-eat food that needs no refrigeration or cooking.` });
  }
  if (household.home.hasFridge && hz("grid-power")) {
    add({ id: `${sid}:fridge-closed`, phase: "during", severity: 2, effort: 1, hoursToFailure: ctx.A["fridge.safeHoursUnopened"]!,
      title: "Keep the fridge and freezer shut; eat fridge food in the first 4 hours",
      detail: `A closed fridge stays cold about ${ctx.A["fridge.safeHoursUnopened"]} h; a full freezer about ${ctx.A["freezer.safeHoursFull"]} h. Discard perishables that were above 40°F / 4°C for 4 h or more.`,
      source: SRC.fda });
  }
  if (fails("need:cooking") !== null && household.home.cooking !== "none") {
    add({ id: `${sid}:cooking-backup`, phase: "before", severity: 2, effort: 3, hoursToFailure: fails("need:cooking"),
      title: household.home.cooking === "camp-stove" ? "Get more stove fuel" : "Have a way to heat food without electricity",
      detail: household.home.cooking === "camp-stove"
        ? `Your stove fuel runs out around hour ${fails("need:cooking")}.`
        : "A camp stove used outdoors or on a balcony, or enough no-cook food that it doesn't matter." });
  }

  // Medication.
  for (const m of inventory.medications) {
    const f = fails(`need:med:${m.id}`);
    const daysLeft = m.dosesPerDay > 0 ? m.dosesOnHand / m.dosesPerDay : Infinity;
    if (f !== null || daysLeft < days + 3) {
      add({ id: `all:refill-${m.id}`, phase: "now", severity: 5, effort: 3, hoursToFailure: f,
        title: `Refill ${m.label} (${Math.floor(daysLeft)} days left)`,
        detail: f !== null ? `Runs out around hour ${f} of this scenario, and pharmacies may be closed.`
          : "Keep at least a few days beyond the scenario length, since pharmacies may be closed." });
    }
    if (m.requiresRefrigeration && fails(`need:cold:${m.id}`) !== null) {
      add({ id: `${sid}:cool-${m.id}`, phase: "before", severity: 5, effort: 2, hoursToFailure: fails(`need:cold:${m.id}`),
        title: `Plan how to keep ${m.label} cool without the fridge`,
        detail: hz("extreme-heat")
          ? "In a heatwave the fridge warms past the safe range for insulin (59–86°F) within hours. Prepare a cooler with ice packs, keep it out of sun, and never let it freeze."
          : "A cooler with ice packs, kept out of the sun. For insulin, FDA says vials keep up to 28 days at 59–86°F; for other medication check the label or ask a pharmacist.",
        source: SRC.insulin });
    }
  }
  if (fails("need:medical-device") !== null) {
    add({ id: `all:medical-device-power`, phase: "now", severity: 5, effort: 3, hoursToFailure: fails("need:medical-device"),
      title: "Arrange backup power for the medical device",
      detail: "Ask the device supplier about battery backup, register with your electricity provider as a priority customer, and plan where you would go if power is out for long." });
  }

  // Power, phones, light.
  if (hz("grid-power")) {
    add({ id: `${sid}:charge-everything`, phase: "before", severity: 3, effort: 1, hoursToFailure: fails("charged-phone"),
      title: "Charge every phone and power bank to 100%",
      detail: inventory.powerBanks.length === 0
        ? "You have no power bank listed. Even a small one adds a day of phone use."
        : `Your ${inventory.powerBanks.length} power bank(s) give roughly ${Math.round(result.stocks.find((s) => s.id === "power-banks")?.initial ?? 0)} Wh usable.` });
    if (fails("charged-phone") !== null) {
      add({ id: `${sid}:power-bank`, phase: "before", severity: 3, effort: 2, hoursToFailure: fails("charged-phone"),
        title: "Add power-bank capacity",
        detail: `Phones go flat around hour ${fails("charged-phone")}. Each 20,000 mAh bank adds about ${Math.round(20 * ctx.A["powerBank.cellVoltage"]! * ctx.A["powerBank.usableFraction"]!)} Wh, roughly ${Math.floor(20 * ctx.A["powerBank.cellVoltage"]! * ctx.A["powerBank.usableFraction"]! / ctx.A["phone.batteryWh"]!)} phone charges.` });
    }
    add({ id: `${sid}:phone-conserve`, phase: "during", severity: 2, effort: 1, hoursToFailure: fails("charged-phone"),
      title: "Put phones in low-power mode and agree check-in times",
      detail: "Texts use far less battery and network than calls. Set two times a day to check in with your contact." });
    if (fails("need:light") !== null) {
      add({ id: `${sid}:batteries`, phase: "before", severity: 2, effort: 2, hoursToFailure: fails("need:light"),
        title: "Get a flashlight and spare batteries",
        detail: `Light runs out around hour ${fails("need:light")}. Avoid candles where there are children or pets.` });
    }
  }

  // Communication and information.
  if (hz("mobile-network")) {
    const outOfArea = inventory.contacts.some((c) => c.outOfArea);
    add({ id: `all:out-of-area-contact`, phase: "now", severity: 3, effort: 1, hoursToFailure: 0,
      title: outOfArea ? "Tell your out-of-area contact the plan" : "Pick an out-of-area contact",
      detail: "Local networks jam first. Everyone in the household checks in with one person outside the area, who relays news." });
    add({ id: `all:meeting-point`, phase: "now", severity: 3, effort: 1, hoursToFailure: 0,
      title: "Agree a meeting point if phones stop working",
      detail: "One near home and one outside the neighbourhood, written on the printed plan." });
    if (!inventory.batteryRadio) {
      add({ id: `all:radio`, phase: "before", severity: 2, effort: 2, hoursToFailure: fails("need:information"),
        title: "Get a battery or hand-crank radio",
        detail: "The only source of official updates when both the network and the power are down." });
    }
  }
  if (inventory.contacts.length === 0) {
    add({ id: `all:add-contacts`, phase: "now", severity: 3, effort: 1, hoursToFailure: 0,
      title: "Add emergency contacts to the plan",
      detail: "Family, a neighbour, your doctor and the building manager. The printed plan is where you look when the phone is dead." });
  }

  // Heat.
  if (hz("extreme-heat")) {
    const vulnerable = household.people.filter((p) => p.ageGroup === "older" || p.ageGroup === "infant").length;
    add({ id: `${sid}:cooling-place`, phase: "before", severity: vulnerable ? 5 : 4, effort: 2, hoursToFailure: fails("need:cooling"),
      title: "Identify a cool place to go if the home gets too hot",
      detail: `${vulnerable ? `${vulnerable} household member(s) are at higher risk in heat. ` : ""}A mall, library, cooling centre or a friend's place with power. Decide the trigger: a time of day or an indoor temperature.` });
    add({ id: `${sid}:heat-during`, phase: "during", severity: 4, effort: 1, hoursToFailure: null,
      title: "Close blinds by day, open windows at night, drink more than usual",
      detail: "Water needs can double in very hot weather (Ready.gov). Wet cloths on the neck and wrists help; check on anyone older or unwell twice a day.", source: SRC.water });
  }

  // Storm / shelter in place.
  if (sid === "storm") {
    add({ id: `storm:secure-home`, phase: "before", severity: 4, effort: 2, hoursToFailure: null,
      title: "Secure the home before the storm arrives",
      detail: `Bring loose items in from balconies, move valuables and documents off the floor${household.home.floor === 0 ? " (you are on the ground floor, so flooding is the bigger risk)" : ""}, and park the vehicle on high ground.` });
    add({ id: `storm:stay-put`, phase: "during", severity: 4, effort: 1, hoursToFailure: null,
      title: "Stay inside until authorities say it is over",
      detail: "Flood water hides open drains and live wires. Don't drive through standing water." });
  }

  // Evacuation.
  if (scenario.shelter === "evacuate") {
    if (inventory.vehicle.present && inventory.vehicle.fuelFraction < 0.5) {
      add({ id: `evacuation:fuel`, phase: "now", severity: 4, effort: 2, hoursToFailure: 0,
        title: "Fill the vehicle's tank",
        detail: "Fuel stations need power to pump. Keep the tank above half whenever a warning is possible." });
    }
    if (!inventory.vehicle.present) {
      add({ id: `evacuation:transport-plan`, phase: "now", severity: 4, effort: 2, hoursToFailure: 0,
        title: "Arrange a ride out: a neighbour, family or the official evacuation transport",
        detail: "Without a vehicle, know who you would call and where the pickup point is before it is needed." });
    }
    if (household.people.some((p) => p.limitedMobility)) {
      add({ id: `evacuation:mobility-help`, phase: "now", severity: 5, effort: 2, hoursToFailure: 0,
        title: "Plan help for the person with limited mobility",
        detail: `You are on floor ${household.home.floor}; lifts stop with the power. Agree who helps and how, and tell your building manager or local services.` });
    }
    add({ id: `evacuation:go-bag`, phase: "before", severity: 4, effort: 2, hoursToFailure: 0,
      title: "Pack a go-bag per person",
      detail: "Water, snacks, medication, chargers, copies of ID and the printed plan, cash, a change of clothes, and pet supplies." });
    if (inventory.cashOnHand <= 0) {
      add({ id: `all:cash`, phase: "before", severity: 3, effort: 2, hoursToFailure: null,
        title: "Keep some cash at home",
        detail: "Card terminals and ATMs need power and a network. Small notes are easier to use." });
    }
  } else if (hz("shops-closed") && inventory.cashOnHand <= 0) {
    add({ id: `all:cash`, phase: "before", severity: 2, effort: 2, hoursToFailure: null,
      title: "Keep some cash at home",
      detail: "Card terminals and ATMs need power and a network." });
  }

  // General.
  if (!inventory.firstAidKit) {
    add({ id: `all:first-aid`, phase: "before", severity: 3, effort: 2, hoursToFailure: null,
      title: "Put together a first-aid kit", detail: "Bandages, antiseptic, pain relief, any personal medication, and a list of what is in it." });
  }
  add({ id: `all:print-plan`, phase: "now", severity: 3, effort: 1, hoursToFailure: 0,
    title: "Print the backup plan and put it somewhere everyone can find",
    detail: "On the fridge and in each go-bag. It works when nothing else does." });
  add({ id: `${sid}:neighbours`, phase: "during", severity: 2, effort: 1, hoursToFailure: null,
    title: "Check on neighbours who live alone or are older", detail: "Share what you have; an outage is easier as a group." });

  return tasks.sort((a, b) => PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] || b.score - a.score || a.title.localeCompare(b.title));
}
