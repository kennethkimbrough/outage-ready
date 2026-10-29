import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, evaluate, explain } from "../src/engine/graph.js";
import { emptyHousehold, emptyInventory } from "../src/engine/sample.js";

const allUp = { "grid-power": true, "tap-water": true, "mobile-network": true, internet: true, roads: true, shops: true };
const stocks = { "stored-water": true, "nonperishable-food": true, "perishable-food": true, "power-banks": true,
  "phone-battery": true, "light-batteries": true, "cooking-fuel": true, "generator-fuel": false, "vehicle-fuel": false, cash: true };

test("gravity-fed water survives a power cut; a pumped supply does not", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  hh.home.waterSupply = "gravity";
  let a = evaluate(buildGraph(hh, inv), { ...allUp, "grid-power": false }, stocks);
  assert.equal(a.get("water-at-tap"), true);

  hh.home.waterSupply = "electric-pump";
  a = evaluate(buildGraph(hh, inv), { ...allUp, "grid-power": false }, stocks);
  assert.equal(a.get("water-at-tap"), false);
  assert.equal(a.get("drinking-water"), true, "stored water still covers drinking");
  a = evaluate(buildGraph(hh, inv), { ...allUp, "grid-power": false }, { ...stocks, "stored-water": false });
  assert.equal(a.get("need:hydration"), false);
  assert.deepEqual(explain(buildGraph(hh, inv), a, "need:hydration").sort(), ["Grid power", "Stored water"]);
});

test("a generator keeps home power on while fuel lasts", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.generatorFuelLiters = 10;
  inv.generatorLitersPerHour = 1;
  const g = buildGraph(hh, inv);
  assert.equal(evaluate(g, { ...allUp, "grid-power": false }, { ...stocks, "generator-fuel": true }).get("home-power"), true);
  assert.equal(evaluate(g, { ...allUp, "grid-power": false }, { ...stocks, "generator-fuel": false }).get("home-power"), false);
});

test("communication needs both a charged phone and the network", () => {
  const g = buildGraph(emptyHousehold(), emptyInventory());
  assert.equal(evaluate(g, allUp, stocks).get("communication"), true);
  assert.equal(evaluate(g, { ...allUp, "mobile-network": false }, stocks).get("communication"), false);
  assert.equal(evaluate(g, { ...allUp, "grid-power": false }, { ...stocks, "phone-battery": false, "power-banks": false }).get("communication"), false);
});

test("refrigerated medication adds a cold-chain need that follows power", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  inv.medications.push({ id: "ins", label: "Insulin", dosesOnHand: 30, dosesPerDay: 2, requiresRefrigeration: true });
  const g = buildGraph(hh, inv);
  assert.ok(g.nodes.has("need:cold:ins"));
  assert.equal(evaluate(g, { ...allUp, "grid-power": false }, { ...stocks, "med:ins": true, "fridge-cold": true }).get("need:cold:ins"), true, "stored cold still counts");
  assert.equal(evaluate(g, { ...allUp, "grid-power": false }, { ...stocks, "med:ins": true, "fridge-cold": false }).get("need:cold:ins"), false);
  assert.equal(evaluate(g, allUp, { ...stocks, "med:ins": true }).get("need:cold:ins"), true);
});

test("a battery radio keeps information available without the network", () => {
  const hh = emptyHousehold();
  const inv = emptyInventory();
  const down = { ...allUp, "mobile-network": false };
  assert.equal(evaluate(buildGraph(hh, inv), down, stocks).get("need:information"), false);
  inv.batteryRadio = true;
  assert.equal(evaluate(buildGraph(hh, inv), down, stocks).get("need:information"), true);
});
