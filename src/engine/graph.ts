import type { Household, Inventory } from "./types.js";

/**
 * The dependency graph: external supplies and stored stocks feed
 * capabilities, and capabilities serve needs. The simulation evaluates it once
 * per hour against the current supply status and stock levels.
 *
 *   grid power ─┬─> home power ──> refrigeration ──> cold-chain medicine
 *   generator ──┘       │                        └──> perishable food
 *                       └──> pump ──> tap water ──> drinking water <── stored water
 *   phone battery ──> charged phone ──> communication <── mobile network
 */

export type NodeKind = "supply" | "stock" | "capability" | "need";

export interface Requirement {
  /** Every listed node must be available. */
  all?: string[];
  /** At least one listed node must be available. */
  any?: string[];
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  requires?: Requirement;
  /** 1 (nice to have) .. 5 (life safety). Needs only. */
  severity?: number;
  /** Short explanation shown in the UI. */
  why?: string;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
}

export function buildGraph(household: Household, inventory: Inventory): Graph {
  const nodes: GraphNode[] = [];
  const add = (n: GraphNode) => nodes.push(n);
  const { home } = household;

  // External supplies. Their status is set by the scenario.
  add({ id: "grid-power", kind: "supply", label: "Grid power" });
  add({ id: "tap-water", kind: "supply", label: "Mains water" });
  add({ id: "mobile-network", kind: "supply", label: "Mobile network" });
  add({ id: "internet", kind: "supply", label: "Internet" });
  add({ id: "roads", kind: "supply", label: "Roads open" });
  add({ id: "shops", kind: "supply", label: "Shops open" });

  // Stocks. Available while their level is above zero.
  add({ id: "stored-water", kind: "stock", label: "Stored water" });
  add({ id: "nonperishable-food", kind: "stock", label: "Non-perishable food" });
  add({ id: "perishable-food", kind: "stock", label: "Fridge food" });
  add({ id: "power-banks", kind: "stock", label: "Power banks" });
  add({ id: "phone-battery", kind: "stock", label: "Phone batteries" });
  add({ id: "light-batteries", kind: "stock", label: "Flashlight batteries" });
  add({ id: "cooking-fuel", kind: "stock", label: "Stove fuel" });
  add({ id: "generator-fuel", kind: "stock", label: "Generator fuel" });
  add({ id: "vehicle-fuel", kind: "stock", label: "Vehicle fuel" });
  add({ id: "cash", kind: "stock", label: "Cash on hand" });
  add({ id: "fridge-cold", kind: "stock", label: "Cold left in the fridge" });
  for (const m of inventory.medications) {
    add({ id: `med:${m.id}`, kind: "stock", label: `${m.label} supply` });
  }

  // Capabilities.
  const homePowerSources = ["grid-power"];
  if (inventory.generatorFuelLiters > 0 && inventory.generatorLitersPerHour > 0) {
    homePowerSources.push("generator-fuel");
  }
  add({ id: "home-power", kind: "capability", label: "Power at home", requires: { any: homePowerSources } });

  const tapReq: Requirement = home.waterSupply === "electric-pump"
    ? { all: ["tap-water", "home-power"] }
    : { all: ["tap-water"] };
  add({
    id: "water-at-tap", kind: "capability", label: "Water from the tap", requires: tapReq,
    why: home.waterSupply === "electric-pump" ? "Your water comes through an electric pump, so it stops with the power." : undefined,
  });
  add({ id: "drinking-water", kind: "capability", label: "Drinking water", requires: { any: ["water-at-tap", "stored-water"] } });

  add({ id: "refrigeration", kind: "capability", label: "Refrigeration", requires: { any: ["home-power", "fridge-cold"] },
    why: "A closed fridge stays cold for a few hours after the power goes; after that it depends on power." });
  const coolingReq: Requirement | undefined = home.cooling === "none" ? { all: ["__never"] } : { all: ["home-power"] };
  add({ id: "cooling", kind: "capability", label: "Cooling (fan or AC)", requires: coolingReq });

  let cookReq: Requirement;
  if (home.cooking === "electric") cookReq = { all: ["home-power"] };
  else if (home.cooking === "gas") cookReq = { all: [] };
  else if (home.cooking === "camp-stove") cookReq = { all: ["cooking-fuel"] };
  else cookReq = { all: ["__never"] };
  add({ id: "cooking", kind: "capability", label: "Hot food", requires: cookReq });

  add({ id: "charged-phone", kind: "capability", label: "A charged phone", requires: { any: ["home-power", "phone-battery", "power-banks"] } });
  add({ id: "communication", kind: "capability", label: "Calls and messages", requires: { all: ["charged-phone", "mobile-network"] } });
  const infoSources = ["communication"];
  if (inventory.batteryRadio) infoSources.push("__always");
  add({ id: "information", kind: "capability", label: "News and alerts", requires: { any: infoSources } });
  add({ id: "lighting", kind: "capability", label: "Light after dark", requires: { any: ["home-power", "light-batteries", "charged-phone"] } });
  const transportReq: Requirement = inventory.vehicle.present ? { all: ["vehicle-fuel", "roads"] } : { all: ["__never"] };
  add({ id: "transport", kind: "capability", label: "Getting around by vehicle", requires: transportReq });
  add({ id: "buying", kind: "capability", label: "Buying supplies", requires: { all: ["shops", "cash-or-cards"] } });
  add({ id: "cash-or-cards", kind: "capability", label: "A way to pay", requires: { any: ["cash", "home-power"] },
    why: "Card terminals and ATMs need power; cash works without it." });
  add({ id: "food-supply", kind: "capability", label: "Food", requires: { any: ["nonperishable-food", "perishable-food", "buying"] } });

  // Needs.
  add({ id: "need:hydration", kind: "need", label: "Drinking water for everyone", requires: { all: ["drinking-water"] }, severity: 5 });
  add({ id: "need:food", kind: "need", label: "Enough food", requires: { all: ["food-supply"] }, severity: 4 });
  for (const m of inventory.medications) {
    add({ id: `need:med:${m.id}`, kind: "need", label: `${m.label} doses`, requires: { all: [`med:${m.id}`] }, severity: 5 });
    if (m.requiresRefrigeration) {
      add({ id: `need:cold:${m.id}`, kind: "need", label: `${m.label} kept cool`, requires: { all: ["refrigeration"] }, severity: 5,
        why: "Refrigerated medication depends on the fridge, which depends on power." });
    }
  }
  if (household.people.some((p) => p.needsPoweredDevice)) {
    add({ id: "need:medical-device", kind: "need", label: "Powered medical device", requires: { all: ["home-power"] }, severity: 5 });
  }
  add({ id: "need:food-safety", kind: "need", label: "Fridge food stays safe", requires: { all: ["refrigeration"] }, severity: 2 });
  add({ id: "need:communication", kind: "need", label: "Reaching family and help", requires: { all: ["communication"] }, severity: 3 });
  add({ id: "need:information", kind: "need", label: "Knowing what is going on", requires: { all: ["information"] }, severity: 3 });
  add({ id: "need:light", kind: "need", label: "Light at night", requires: { all: ["lighting"] }, severity: 2 });
  add({ id: "need:cooking", kind: "need", label: "A hot meal", requires: { all: ["cooking"] }, severity: 2 });
  if (home.climate === "hot" || household.people.some((p) => p.ageGroup === "older" || p.ageGroup === "infant")) {
    add({ id: "need:cooling", kind: "need", label: "Staying cool in heat", requires: { all: ["cooling"] }, severity: 4,
      why: "Older people and infants are most affected by heat without cooling." });
  } else {
    add({ id: "need:cooling", kind: "need", label: "Staying cool in heat", requires: { all: ["cooling"] }, severity: 3 });
  }
  add({ id: "need:mobility", kind: "need", label: "Able to leave if told to", requires: { all: ["transport"] }, severity: 4 });

  return { nodes: new Map(nodes.map((n) => [n.id, n])) };
}

/**
 * Evaluate availability of every node given which supplies are up and which
 * stocks are above zero. `__always` and `__never` are pseudo-nodes.
 */
export function evaluate(graph: Graph, supplies: Record<string, boolean>, stocks: Record<string, boolean>): Map<string, boolean> {
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();
  const avail = (id: string): boolean => {
    if (id === "__always") return true;
    if (id === "__never") return false;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) throw new Error(`dependency cycle at ${id}`);
    const node = graph.nodes.get(id);
    if (!node) throw new Error(`unknown node ${id}`);
    visiting.add(id);
    let result: boolean;
    if (node.kind === "supply") result = supplies[id] ?? true;
    else if (node.kind === "stock") result = stocks[id] ?? false;
    else {
      const req = node.requires ?? { all: [] };
      const allOk = (req.all ?? []).every(avail);
      const anyOk = req.any ? req.any.some(avail) : true;
      result = allOk && anyOk;
    }
    visiting.delete(id);
    memo.set(id, result);
    return result;
  };
  for (const id of graph.nodes.keys()) avail(id);
  return memo;
}

/** Which unavailable dependencies explain a node being unavailable right now. */
export function explain(graph: Graph, availability: Map<string, boolean>, id: string): string[] {
  const node = graph.nodes.get(id);
  if (!node || availability.get(id)) return [];
  if (node.kind === "supply" || node.kind === "stock") return [node.label];
  const req = node.requires ?? {};
  const causes: string[] = [];
  for (const dep of req.all ?? []) {
    if (dep.startsWith("__")) continue;
    if (!availability.get(dep)) causes.push(...explain(graph, availability, dep));
  }
  if (req.any && !req.any.some((d) => availability.get(d) || d === "__always")) {
    for (const dep of req.any) if (!dep.startsWith("__")) causes.push(...explain(graph, availability, dep));
  }
  return [...new Set(causes)];
}
