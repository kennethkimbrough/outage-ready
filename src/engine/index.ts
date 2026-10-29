export * from "./types.js";
export * from "./assumptions.js";
export * from "./scenarios.js";
export * from "./graph.js";
export * from "./simulate.js";
export * from "./prioritize.js";
export * from "./sample.js";

import { prioritize, type Task } from "./prioritize.js";
import { getScenario } from "./scenarios.js";
import { simulate, type SimulationResult } from "./simulate.js";
import type { Plan, ScenarioId } from "./types.js";

export interface ScenarioReport {
  result: SimulationResult;
  tasks: Task[];
}

/** Run one scenario for a saved plan. */
export function runScenario(plan: Plan, id: ScenarioId): ScenarioReport {
  const scenario = getScenario(id, plan.durations[id]);
  const result = simulate(plan.household, plan.inventory, scenario, plan.overrides);
  const tasks = prioritize(plan.household, plan.inventory, scenario, result, plan.overrides);
  return { result, tasks };
}

/** Hours as a short human string: 0.5 → "30 min", 36 → "1 day 12 h". */
export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  if (d === 0) return `${h} h`;
  if (h === 0) return `${d} day${d === 1 ? "" : "s"}`;
  return `${d} day${d === 1 ? "" : "s"} ${h} h`;
}
