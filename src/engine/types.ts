/**
 * Data model for a household, what it has on hand, and the scenarios it can
 * be run against. Everything is plain JSON so it round-trips through
 * IndexedDB and the export/import feature unchanged.
 */

export type AgeGroup = "infant" | "child" | "adult" | "older";

export interface Person {
  id: string;
  label: string;
  ageGroup: AgeGroup;
  /** Needs that change the plan: mobility limits, a powered medical device, etc. */
  needsPoweredDevice?: boolean;
  limitedMobility?: boolean;
  pregnantOrNursing?: boolean;
}

export interface Pet {
  id: string;
  kind: "dog" | "cat" | "other";
  count: number;
}

export type WaterSupply = "gravity" | "electric-pump" | "bottled-only";
export type CookingMeans = "electric" | "gas" | "camp-stove" | "none";
export type CoolingMeans = "ac" | "fan" | "none";
export type Climate = "temperate" | "hot";

export interface Home {
  /** How tap water reaches the home. An electric pump stops with the power. */
  waterSupply: WaterSupply;
  cooking: CookingMeans;
  cooling: CoolingMeans;
  climate: Climate;
  hasFridge: boolean;
  hasFreezer: boolean;
  freezerFullness: "full" | "half" | "empty";
  /** Floor number matters for evacuation and water pressure; 0 = ground. */
  floor: number;
}

export interface Household {
  people: Person[];
  pets: Pet[];
  home: Home;
}

export interface PowerBank {
  id: string;
  label: string;
  ratedMah: number;
  /** 0..1 */
  charge: number;
}

export interface Medication {
  id: string;
  label: string;
  /** Who takes it (person id) or empty for shared. */
  personId?: string;
  dosesOnHand: number;
  dosesPerDay: number;
  requiresRefrigeration: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  /** Out-of-area contacts are easier to reach when local networks are congested. */
  outOfArea: boolean;
}

export interface Vehicle {
  present: boolean;
  /** 0..1 of a tank */
  fuelFraction: number;
  rangeKmFullTank: number;
}

export interface Inventory {
  /** Stored drinking water, litres (bottles, jugs, filled containers). */
  waterLiters: number;
  /** Non-perishable food, expressed as person-days at normal intake. */
  foodPersonDays: number;
  /** Perishable food currently in the fridge, in person-days. */
  perishableFoodPersonDays: number;
  powerBanks: PowerBank[];
  phones: number;
  /** Charge level of the household's phones, 0..1 average. */
  phoneCharge: number;
  flashlights: number;
  /** Spare batteries (any size) for lights and radio. */
  spareBatteries: number;
  batteryRadio: boolean;
  /** Fuel for a gas or camp stove, in hours of burn time. */
  cookingFuelHours: number;
  /** Fuel for a generator in litres; 0 if no generator. */
  generatorFuelLiters: number;
  generatorLitersPerHour: number;
  medications: Medication[];
  vehicle: Vehicle;
  cashOnHand: number;
  firstAidKit: boolean;
  contacts: Contact[];
}

export type ScenarioId =
  | "power"
  | "water"
  | "comms"
  | "heat-power"
  | "storm"
  | "evacuation";

export type Hazard =
  | "grid-power"
  | "tap-water"
  | "mobile-network"
  | "internet"
  | "roads"
  | "extreme-heat"
  | "shops-closed";

export interface Scenario {
  id: ScenarioId;
  name: string;
  description: string;
  /** Hours the outage lasts. User-adjustable. */
  durationHours: number;
  hazards: Hazard[];
  shelter: "home" | "evacuate";
}

/** A single assumption used by the simulation, with where it came from. */
export interface Assumption {
  key: string;
  label: string;
  value: number;
  unit: string;
  source: { title: string; url: string };
  note?: string;
}

export type AssumptionOverrides = Record<string, number>;

export interface Plan {
  household: Household;
  inventory: Inventory;
  overrides: AssumptionOverrides;
  /** Scenario durations the user has set, by id. */
  durations: Partial<Record<ScenarioId, number>>;
  /** Tasks the user has ticked off, by task id. */
  completedTasks: string[];
  updatedAt: string;
}
