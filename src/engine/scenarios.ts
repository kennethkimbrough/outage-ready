import type { Scenario, ScenarioId } from "./types.js";

export const SCENARIOS: Scenario[] = [
  {
    id: "power",
    name: "Power outage",
    description: "The grid is down. Water, phones and roads are unaffected unless they depend on your own power.",
    durationHours: 48,
    hazards: ["grid-power"],
    shelter: "home",
  },
  {
    id: "water",
    name: "Water outage",
    description: "No tap water, or a boil notice you treat as no water. Power stays on.",
    durationHours: 72,
    hazards: ["tap-water"],
    shelter: "home",
  },
  {
    id: "comms",
    name: "Mobile and internet outage",
    description: "Networks are down or overloaded. Everything else works.",
    durationHours: 24,
    hazards: ["mobile-network", "internet"],
    shelter: "home",
  },
  {
    id: "heat-power",
    name: "Heatwave with power outage",
    description: "No power during extreme heat: no cooling, more water needed, refrigerated medicine at risk sooner.",
    durationHours: 48,
    hazards: ["grid-power", "extreme-heat"],
    shelter: "home",
  },
  {
    id: "storm",
    name: "Typhoon or flood (shelter in place)",
    description: "Stay home through a storm: power and tap water out, roads closed, shops shut, networks patchy.",
    durationHours: 96,
    hazards: ["grid-power", "tap-water", "roads", "shops-closed", "mobile-network"],
    shelter: "home",
  },
  {
    id: "evacuation",
    name: "Evacuation",
    description: "You have to leave. What matters is what you can carry, your vehicle, cash and contacts.",
    durationHours: 72,
    hazards: ["grid-power", "tap-water", "shops-closed"],
    shelter: "evacuate",
  },
];

export function getScenario(id: ScenarioId, durationHours?: number): Scenario {
  const base = SCENARIOS.find((s) => s.id === id);
  if (!base) throw new Error(`unknown scenario ${id}`);
  return durationHours && durationHours > 0 ? { ...base, durationHours } : { ...base };
}
