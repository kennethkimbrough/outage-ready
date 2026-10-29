import { test } from "node:test";
import assert from "node:assert/strict";
import { prioritize, scoreTask } from "../src/engine/prioritize.js";
import { simulate } from "../src/engine/simulate.js";
import { getScenario } from "../src/engine/scenarios.js";
import { runScenario, formatHours } from "../src/engine/index.js";
import { emptyHousehold, emptyInventory, samplePlan } from "../src/engine/sample.js";

test("score rises with severity and urgency and falls with effort", () => {
  assert.ok(scoreTask(5, 0, 1) > scoreTask(5, 48, 1));
  assert.ok(scoreTask(5, null, 1) > scoreTask(3, null, 1));
  assert.ok(scoreTask(4, 10, 1) > scoreTask(4, 10, 3));
});

test("water shortfall produces a concrete litre figure", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.waterLiters = 2;
  const sc = getScenario("water", 72);
  const tasks = prioritize(hh, inv, sc, simulate(hh, inv, sc));
  const t = tasks.find((x) => x.id === "water:store-water")!;
  assert.match(t.title, /Store about 10 L more water/); // 3.785*3 = 11.36 -> 12 needed, have 2
  assert.equal(t.phase, "before");
  assert.equal(t.source?.url, "https://www.ready.gov/water");
});

test("tasks are grouped now → before → during and sorted by score within a phase", () => {
  const { tasks } = runScenario(samplePlan(), "storm");
  const order = { now: 0, before: 1, during: 2 };
  for (let i = 1; i < tasks.length; i++) {
    const a = tasks[i - 1]!, b = tasks[i]!;
    assert.ok(order[a.phase] < order[b.phase] || (a.phase === b.phase && a.score >= b.score));
  }
  assert.ok(tasks.some((t) => t.id === "storm:fill-containers"), "pumped water supply gets a fill-containers task");
  assert.ok(tasks.some((t) => t.id === "all:print-plan"));
  const ids = tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "task ids are unique");
});

test("medication refill is flagged when supply is short", () => {
  const plan = samplePlan();
  plan.inventory.medications[0]!.dosesOnHand = 2;
  const { tasks } = runScenario(plan, "power");
  const t = tasks.find((x) => x.id.startsWith("all:refill-"))!;
  assert.equal(t.phase, "now");
  assert.equal(t.severity, 5);
});

test("evacuation tasks cover fuel, go-bag and cash", () => {
  const { tasks } = runScenario(samplePlan(), "evacuation");
  for (const id of ["evacuation:fuel", "evacuation:go-bag", "all:cash"]) {
    assert.ok(tasks.some((t) => t.id === id), `missing ${id}`);
  }
});

test("formatHours", () => {
  assert.equal(formatHours(0.5), "30 min");
  assert.equal(formatHours(5), "5 h");
  assert.equal(formatHours(24), "1 day");
  assert.equal(formatHours(36), "1 day 12 h");
  assert.equal(formatHours(96), "4 days");
});
