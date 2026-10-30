export * from "./types.js";
export * from "./format.js";
export * from "./assumptions.js";
export * from "./scenarios.js";
export * from "./graph.js";
export * from "./simulate.js";
export * from "./prioritize.js";
export * from "./sample.js";
import { prioritize } from "./prioritize.js";
import { getScenario } from "./scenarios.js";
import { simulate } from "./simulate.js";
/** Run one scenario for a saved plan. */
export function runScenario(plan, id) {
    const scenario = getScenario(id, plan.durations[id]);
    const result = simulate(plan.household, plan.inventory, scenario, plan.overrides);
    const tasks = prioritize(plan.household, plan.inventory, scenario, result, plan.overrides);
    return { result, tasks };
}
