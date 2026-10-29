import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/engine/simulate.js";
import { getScenario } from "../src/engine/scenarios.js";
import { emptyHousehold, emptyInventory, samplePlan } from "../src/engine/sample.js";

test("stored water depletes at one gallon per person per day", () => {
  const hh = emptyHousehold();
  hh.people.push({ id: "p2", label: "B", ageGroup: "adult" });
  const inv = emptyInventory();
  inv.waterLiters = 3.785 * 2 * 2; // exactly two days for two people
  const r = simulate(hh, inv, getScenario("water", 96));
  const water = r.stocks.find((s) => s.id === "stored-water")!;
  assert.equal(water.depletedAt, 48);
  assert.equal(r.dailyWaterLiters, 3.785 * 2);
  const hydration = r.unmetNeeds.find((n) => n.id === "need:hydration")!;
  assert.equal(hydration.failsAt, 48);
  assert.equal(r.sustainableHours, 48);
  assert.equal(r.holdsFullDuration, false);
});

test("water need doubles in a heatwave and when the climate is hot", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.waterLiters = 100;
  const normal = simulate(hh, inv, getScenario("water", 24));
  const heat = simulate(hh, inv, getScenario("heat-power", 24));
  assert.equal(heat.dailyWaterLiters, normal.dailyWaterLiters * 2);
  hh.home.climate = "hot";
  assert.equal(simulate(hh, inv, getScenario("water", 24)).dailyWaterLiters, normal.dailyWaterLiters * 2);
});

test("a plain power outage with gravity water never runs out of drinking water", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  const r = simulate(hh, inv, getScenario("power", 72));
  assert.equal(r.nodes.find((n) => n.id === "need:hydration")!.failsAt, null);
});

test("fridge warms after 4 h and food is discarded 4 h later", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.perishableFoodPersonDays = 5;
  const r = simulate(hh, inv, getScenario("power", 24));
  const warm = r.timeline.find((e) => e.label === "Fridge warms up")!;
  const lost = r.timeline.find((e) => e.label === "Fridge food unsafe")!;
  assert.equal(warm.hour, 4);
  assert.equal(lost.hour, 8);
  const perishable = r.stocks.find((s) => s.id === "perishable-food")!;
  assert.equal(perishable.series[9], 0);
  assert.equal(r.nodes.find((n) => n.id === "need:food-safety")!.failsAt, 4);
});

test("freezer warning depends on fullness", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  hh.home.freezerFullness = "full";
  assert.equal(simulate(hh, inv, getScenario("power", 72)).timeline.find((e) => e.label === "Freezer thaws")!.hour, 48);
  hh.home.freezerFullness = "half";
  assert.equal(simulate(hh, inv, getScenario("power", 72)).timeline.find((e) => e.label === "Freezer thaws")!.hour, 24);
});

test("phones drain, then draw from power banks, then go flat", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.phones = 1;
  inv.phoneCharge = 1; // 18.5 Wh, lasts 24 h
  inv.powerBanks = [{ id: "b", label: "bank", ratedMah: 10000, charge: 1 }]; // 10 * 3.7 * 0.7 = 25.9 Wh usable
  const r = simulate(hh, inv, getScenario("power", 96));
  const phone = r.nodes.find((n) => n.id === "charged-phone")!;
  // 18.5 Wh phone + 25.9 Wh bank at 18.5 Wh/day ≈ 2.4 days ≈ 57-58 h
  assert.ok(phone.failsAt! >= 56 && phone.failsAt! <= 59, `failsAt=${phone.failsAt}`);
  const noBank = simulate(hh, { ...inv, powerBanks: [] }, getScenario("power", 96));
  assert.equal(noBank.nodes.find((n) => n.id === "charged-phone")!.failsAt, 24);
});

test("phones do not drain while home power is available", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.phoneCharge = 1;
  const r = simulate(hh, inv, getScenario("water", 96));
  assert.equal(r.stocks.find((s) => s.id === "phone-battery")!.depletedAt, null);
});

test("medication runs out by doses per day regardless of scenario", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.medications.push({ id: "m", label: "Pills", dosesOnHand: 4, dosesPerDay: 2, requiresRefrigeration: false });
  const r = simulate(hh, inv, getScenario("comms", 72));
  assert.equal(r.nodes.find((n) => n.id === "need:med:m")!.failsAt, 48);
  assert.equal(r.sustainableHours, 48);
});

test("refrigerated medication warning differs in a heatwave", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.medications.push({ id: "ins", label: "Insulin", dosesOnHand: 60, dosesPerDay: 2, requiresRefrigeration: true });
  const mild = simulate(hh, inv, getScenario("power", 24)).timeline.find((e) => e.nodeId === "cold-warn:ins")!;
  const hot = simulate(hh, inv, getScenario("heat-power", 24)).timeline.find((e) => e.nodeId === "cold-warn:ins")!;
  assert.equal(mild.hour, 4);
  assert.match(mild.detail, /28 days/);
  assert.match(hot.detail, /86°F/);
});

test("irrelevant needs are hidden: no cooling failure outside a heatwave, no mobility unless evacuating", () => {
  const hh = emptyHousehold();
  hh.home.cooling = "none";
  const inv = emptyInventory();
  const power = simulate(hh, inv, getScenario("power", 24));
  assert.ok(!power.failsFirst.some((n) => n.id === "need:cooling"));
  assert.ok(!power.failsFirst.some((n) => n.id === "need:mobility"));
  const heat = simulate(hh, inv, getScenario("heat-power", 24));
  assert.ok(heat.failsFirst.some((n) => n.id === "need:cooling"));
  const evac = simulate(hh, inv, getScenario("evacuation", 24));
  assert.ok(evac.failsFirst.some((n) => n.id === "need:mobility"));
});

test("failsFirst is sorted soonest first, then by severity", () => {
  const plan = samplePlan();
  const r = simulate(plan.household, plan.inventory, getScenario("storm", 96));
  for (let i = 1; i < r.failsFirst.length; i++) {
    const a = r.failsFirst[i - 1]!, b = r.failsFirst[i]!;
    assert.ok(a.failsAt! < b.failsAt! || (a.failsAt === b.failsAt && a.severity >= b.severity));
  }
  assert.equal(r.stocks.find((s) => s.id === "stored-water")!.series.length, 97);
});

test("overrides change the simulation", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.waterLiters = 10;
  const base = simulate(hh, inv, getScenario("water", 240));
  const thirsty = simulate(hh, inv, getScenario("water", 240), { "water.litersPerPersonPerDay": 10 });
  assert.ok(thirsty.sustainableHours < base.sustainableHours);
  const ignored = simulate(hh, inv, getScenario("water", 240), { "not.a.key": 5, "water.litersPerPersonPerDay": -1 });
  assert.equal(ignored.sustainableHours, base.sustainableHours);
});
