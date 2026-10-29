import type { Household, Inventory, Plan } from "./types.js";

/** A blank plan for a new household. */
export function emptyHousehold(): Household {
  return {
    people: [{ id: "p1", label: "Me", ageGroup: "adult" }],
    pets: [],
    home: {
      waterSupply: "gravity", cooking: "gas", cooling: "fan", climate: "temperate",
      hasFridge: true, hasFreezer: true, freezerFullness: "half", floor: 0,
    },
  };
}

export function emptyInventory(): Inventory {
  return {
    waterLiters: 0, foodPersonDays: 0, perishableFoodPersonDays: 1,
    powerBanks: [], phones: 1, phoneCharge: 0.5,
    flashlights: 0, spareBatteries: 0, batteryRadio: false,
    cookingFuelHours: 0, generatorFuelLiters: 0, generatorLitersPerHour: 0,
    medications: [],
    vehicle: { present: false, fuelFraction: 0, rangeKmFullTank: 500 },
    cashOnHand: 0, firstAidKit: false, contacts: [],
  };
}

export function emptyPlan(): Plan {
  return { household: emptyHousehold(), inventory: emptyInventory(), overrides: {}, durations: {},
    completedTasks: [], updatedAt: new Date(0).toISOString() };
}

/** A worked example: two adults in a hot-climate apartment with a pumped water supply. */
export function samplePlan(): Plan {
  const plan = emptyPlan();
  plan.household = {
    people: [
      { id: "p1", label: "Me", ageGroup: "adult" },
      { id: "p2", label: "Partner", ageGroup: "adult" },
    ],
    pets: [],
    home: {
      waterSupply: "electric-pump", cooking: "electric", cooling: "ac", climate: "hot",
      hasFridge: true, hasFreezer: true, freezerFullness: "half", floor: 4,
    },
  };
  plan.inventory = {
    waterLiters: 12, foodPersonDays: 4, perishableFoodPersonDays: 2,
    powerBanks: [{ id: "b1", label: "Anker 20k", ratedMah: 20000, charge: 0.8 }],
    phones: 2, phoneCharge: 0.6,
    flashlights: 1, spareBatteries: 2, batteryRadio: false,
    cookingFuelHours: 0, generatorFuelLiters: 0, generatorLitersPerHour: 0,
    medications: [{ id: "m1", label: "Blood pressure tablets", personId: "p2", dosesOnHand: 10, dosesPerDay: 1, requiresRefrigeration: false }],
    vehicle: { present: true, fuelFraction: 0.3, rangeKmFullTank: 300 },
    cashOnHand: 0, firstAidKit: true,
    contacts: [
      { id: "c1", name: "Building manager", phone: "+84 90 000 0000", relation: "Building", outOfArea: false },
      { id: "c2", name: "Mom", phone: "+1 555 010 0000", relation: "Family", outOfArea: true },
    ],
  };
  plan.updatedAt = new Date().toISOString();
  return plan;
}
