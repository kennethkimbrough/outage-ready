import type { Assumption, AssumptionOverrides } from "./types.js";

/**
 * Every number the simulation relies on, with its source. The app shows this
 * list on the Assumptions screen and lets the user override any value; the
 * override is stored alongside the plan and travels with exports.
 *
 * Values marked "Set by you" have no authoritative public figure, so they are
 * deliberately conservative and meant to be adjusted by the household.
 */
export const DEFAULT_ASSUMPTIONS: Assumption[] = [
  {
    key: "water.litersPerPersonPerDay",
    label: "Drinking and sanitation water per person per day",
    value: 3.785,
    unit: "L",
    source: { title: "Ready.gov: Water", url: "https://www.ready.gov/water" },
    note: "Ready.gov: store at least one gallon (3.785 L) per person per day for several days.",
  },
  {
    key: "water.hotClimateMultiplier",
    label: "Water multiplier in very hot weather",
    value: 2,
    unit: "×",
    source: { title: "Ready.gov: Water", url: "https://www.ready.gov/water" },
    note: "Ready.gov: in very hot temperatures, water needs can double.",
  },
  {
    key: "water.litersPerPetPerDay",
    label: "Water per pet per day",
    value: 0,
    unit: "L",
    source: {
      title: "CDC: Build a pet disaster preparedness kit",
      url: "https://www.cdc.gov/healthy-pets/emergency-preparedness/preparedness-kit.html",
    },
    note: "CDC recommends a two-week supply of water for each animal but gives no daily amount. Enter what your pets actually drink.",
  },
  {
    key: "fridge.safeHoursUnopened",
    label: "Hours a closed refrigerator keeps food cold without power",
    value: 4,
    unit: "h",
    source: {
      title: "FDA: Food and water safety during power outages and floods",
      url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-and-water-safety-during-power-outages-and-floods",
    },
    note: "FDA: the refrigerator will keep food cold for about 4 hours if it is unopened.",
  },
  {
    key: "freezer.safeHoursFull",
    label: "Hours a full, closed freezer keeps its temperature",
    value: 48,
    unit: "h",
    source: {
      title: "FDA: Food and water safety during power outages and floods",
      url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-and-water-safety-during-power-outages-and-floods",
    },
    note: "FDA: a full freezer holds its temperature for approximately 48 hours; 24 hours if half full.",
  },
  {
    key: "freezer.safeHoursHalf",
    label: "Hours a half-full, closed freezer keeps its temperature",
    value: 24,
    unit: "h",
    source: {
      title: "FDA: Food and water safety during power outages and floods",
      url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-and-water-safety-during-power-outages-and-floods",
    },
  },
  {
    key: "food.discardAfterHoursAboveFridgeTemp",
    label: "Hours perishable food is safe above 40°F / 4°C",
    value: 4,
    unit: "h",
    source: {
      title: "FDA: Food and water safety during power outages and floods",
      url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-and-water-safety-during-power-outages-and-floods",
    },
    note: "FDA: discard refrigerated perishables that have been above 40°F for 4 hours or more.",
  },
  {
    key: "insulin.unrefrigeratedDays",
    label: "Days insulin keeps unrefrigerated at 59–86°F (15–30°C)",
    value: 28,
    unit: "days",
    source: {
      title: "FDA: Insulin storage and switching between products in an emergency",
      url: "https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency",
    },
    note: "Applies to insulin specifically. Other refrigerated medications vary: check the label or ask a pharmacist.",
  },
  {
    key: "insulin.maxSafeTempF",
    label: "Temperature above which unrefrigerated insulin is at risk (°F)",
    value: 86,
    unit: "°F",
    source: {
      title: "FDA: Insulin storage and switching between products in an emergency",
      url: "https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency",
    },
  },
  {
    key: "powerBank.usableFraction",
    label: "Usable share of a power bank's rated mAh",
    value: 0.7,
    unit: "×",
    source: {
      title: "Anker: Why is the rated capacity of power banks lower than expected?",
      url: "https://service.anker.com/article-description/Why-is-the-Rated-Capacity-of-Power-Banks-Lower-Than-Expected",
    },
    note: "Rated mAh is at 3.7 V cell voltage. Anker's worked example applies ~82% converter efficiency and ~85% charging efficiency, about 0.70 overall.",
  },
  {
    key: "powerBank.cellVoltage",
    label: "Nominal cell voltage used to convert mAh to Wh",
    value: 3.7,
    unit: "V",
    source: {
      title: "Anker: Why is the rated capacity of power banks lower than expected?",
      url: "https://service.anker.com/article-description/Why-is-the-Rated-Capacity-of-Power-Banks-Lower-Than-Expected",
    },
  },
  {
    key: "phone.batteryWh",
    label: "Energy in one full phone battery",
    value: 18.5,
    unit: "Wh",
    source: {
      title: "Anker: Why is the rated capacity of power banks lower than expected?",
      url: "https://service.anker.com/article-description/Why-is-the-Rated-Capacity-of-Power-Banks-Lower-Than-Expected",
    },
    note: "Anker's example smartphone battery. Check your phone's spec sheet for the real figure.",
  },
  {
    key: "phone.hoursPerCharge",
    label: "Hours a phone lasts per full charge in an outage (light use)",
    value: 24,
    unit: "h",
    source: { title: "Set by you", url: "" },
    note: "No official figure. Depends on your phone and how much you use it; set it from experience.",
  },
  {
    key: "light.hoursPerBattery",
    label: "Hours of flashlight use per spare battery",
    value: 6,
    unit: "h",
    source: { title: "Set by you", url: "" },
    note: "No official figure. LED flashlights vary widely; check the packaging of the one you own.",
  },
  {
    key: "light.hoursNeededPerNight",
    label: "Hours of light needed per night",
    value: 4,
    unit: "h",
    source: { title: "Set by you", url: "" },
    note: "No official figure. Roughly dusk until bedtime.",
  },
  {
    key: "cooking.hoursPerDay",
    label: "Stove burn time needed per day",
    value: 1,
    unit: "h",
    source: { title: "Set by you", url: "" },
    note: "No official figure. Two or three short hot meals a day on a camp stove.",
  },
];

export function assumptionMap(overrides: AssumptionOverrides = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of DEFAULT_ASSUMPTIONS) out[a.key] = a.value;
  for (const [k, v] of Object.entries(overrides)) {
    if (k in out && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

export function getAssumption(key: string): Assumption {
  const a = DEFAULT_ASSUMPTIONS.find((x) => x.key === key);
  if (!a) throw new Error(`unknown assumption ${key}`);
  return a;
}
