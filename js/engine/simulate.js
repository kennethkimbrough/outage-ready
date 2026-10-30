import { assumptionMap } from "./assumptions.js";
import { formatAmount, formatHours } from "./format.js";
import { buildGraph, evaluate, explain, unmetDependencies } from "./graph.js";
const hazardSupply = {
    "grid-power": "grid-power",
    "tap-water": "tap-water",
    "mobile-network": "mobile-network",
    internet: "internet",
    roads: "roads",
    "shops-closed": "shops",
    "extreme-heat": null,
};
/** Hours of the day (0-23) counted as "dark" for lighting demand. */
function isNightHour(hour, hoursPerNight) {
    const h = hour % 24;
    const start = 18;
    return h >= start && h < start + hoursPerNight;
}
export function simulate(household, inventory, scenario, overrides = {}) {
    const A = assumptionMap(overrides);
    const graph = buildGraph(household, inventory);
    const duration = Math.max(1, Math.round(scenario.durationHours));
    const heat = scenario.hazards.includes("extreme-heat");
    const people = household.people.length;
    const petCount = household.pets.reduce((s, p) => s + p.count, 0);
    const supplies = {
        "grid-power": true, "tap-water": true, "mobile-network": true, internet: true, roads: true, shops: true,
    };
    for (const hz of scenario.hazards) {
        const s = hazardSupply[hz];
        if (s)
            supplies[s] = false;
    }
    // Demand rates.
    const hotMultiplier = (heat || household.home.climate === "hot") ? A["water.hotClimateMultiplier"] : 1;
    const dailyWater = people * A["water.litersPerPersonPerDay"] * hotMultiplier + petCount * A["water.litersPerPetPerDay"];
    const waterPerHour = dailyWater / 24;
    const foodPerHour = people / 24; // person-days per hour
    const phoneWhTotal = inventory.phones * A["phone.batteryWh"];
    const phoneDrainPerHour = inventory.phones > 0 ? phoneWhTotal / Math.max(A["phone.hoursPerCharge"], 1) : 0;
    const bankWh = inventory.powerBanks.reduce((s, b) => s + (b.ratedMah / 1000) * A["powerBank.cellVoltage"] * A["powerBank.usableFraction"] * clamp01(b.charge), 0);
    const lightHoursTotal = (inventory.flashlights + inventory.spareBatteries) * A["light.hoursPerBattery"];
    const lightNeedPerNight = A["light.hoursNeededPerNight"];
    const cookingPerHour = A["cooking.hoursPerDay"] / 24;
    const freezerHours = household.home.freezerFullness === "full" ? A["freezer.safeHoursFull"]
        : household.home.freezerFullness === "half" ? A["freezer.safeHoursHalf"] : 0;
    // Stock levels.
    const level = {
        "stored-water": inventory.waterLiters,
        "nonperishable-food": inventory.foodPersonDays,
        "perishable-food": household.home.hasFridge ? inventory.perishableFoodPersonDays : 0,
        "power-banks": bankWh,
        "phone-battery": phoneWhTotal * clamp01(inventory.phoneCharge),
        "light-batteries": lightHoursTotal,
        "cooking-fuel": inventory.cookingFuelHours,
        "generator-fuel": inventory.generatorFuelLiters,
        "vehicle-fuel": inventory.vehicle.present ? clamp01(inventory.vehicle.fuelFraction) * inventory.vehicle.rangeKmFullTank : 0,
        cash: inventory.cashOnHand,
        "fridge-cold": household.home.hasFridge ? A["fridge.safeHoursUnopened"] : 0,
    };
    const units = {
        "stored-water": "L", "nonperishable-food": "person-days", "perishable-food": "person-days",
        "power-banks": "Wh", "phone-battery": "Wh", "light-batteries": "h", "cooking-fuel": "h",
        "generator-fuel": "L", "vehicle-fuel": "km", cash: "cash", "fridge-cold": "h",
    };
    for (const m of inventory.medications) {
        level[`med:${m.id}`] = m.dosesOnHand;
        units[`med:${m.id}`] = "doses";
    }
    const series = {};
    for (const id of Object.keys(level))
        series[id] = [level[id]];
    const failsAt = new Map();
    const causesAt = new Map();
    const timeline = [];
    let fridgeWarmSince = null;
    let fridgeFoodLost = false;
    let fridgeFoodLostAt = null;
    let freezerWarnDone = false;
    let perishablesWarnDone = false;
    const stockAvail = () => Object.fromEntries(Object.entries(level).map(([k, v]) => [k, v > 1e-9]));
    for (let hour = 0; hour < duration; hour++) {
        const availability = evaluate(graph, supplies, stockAvail());
        // Record first failures.
        for (const node of graph.nodes.values()) {
            if (node.kind === "supply")
                continue;
            if (!availability.get(node.id) && !failsAt.has(node.id)) {
                const causes = explain(graph, availability, node.id);
                failsAt.set(node.id, hour);
                causesAt.set(node.id, causes);
                if (node.kind === "need" || node.kind === "capability") {
                    timeline.push({ hour, nodeId: node.id, label: node.label, kind: "fails",
                        detail: causes.length ? `Needs: ${causes.join(", ")}` : "Not available in this scenario" });
                }
            }
        }
        const homePower = availability.get("home-power") ?? false;
        const tapOk = availability.get("water-at-tap") ?? false;
        // Fridge and freezer cold chain. The fridge's stored cold runs down while
        // there is no power and comes back once power returns.
        if (!homePower && household.home.hasFridge) {
            level["fridge-cold"] = Math.max(0, level["fridge-cold"] - 1);
            if (fridgeWarmSince === null)
                fridgeWarmSince = hour;
            const warmFor = hour - fridgeWarmSince;
            if (!perishablesWarnDone && warmFor >= A["fridge.safeHoursUnopened"]) {
                perishablesWarnDone = true;
                timeline.push({ hour, nodeId: "perishable-food", label: "Fridge warms up", kind: "warning",
                    detail: `After ${A["fridge.safeHoursUnopened"]} h without power a closed fridge is no longer cold (FDA). Move what you can to a cooler with ice.` });
            }
            if (!fridgeFoodLost && warmFor >= A["fridge.safeHoursUnopened"] + A["food.discardAfterHoursAboveFridgeTemp"]) {
                fridgeFoodLost = true;
                fridgeFoodLostAt = hour;
                level["perishable-food"] = 0;
                timeline.push({ hour, nodeId: "perishable-food", label: "Fridge food unsafe", kind: "warning",
                    detail: "Perishables held above 40°F / 4°C for 4 hours or more should be discarded (FDA)." });
            }
            if (household.home.hasFreezer && !freezerWarnDone && freezerHours > 0 && warmFor >= freezerHours) {
                freezerWarnDone = true;
                timeline.push({ hour, nodeId: "freezer", label: "Freezer thaws", kind: "warning",
                    detail: `A closed ${household.home.freezerFullness} freezer holds for about ${freezerHours} h (FDA). Check for ice crystals before refreezing.` });
            }
            for (const m of inventory.medications) {
                if (!m.requiresRefrigeration)
                    continue;
                const key = `cold-warn:${m.id}`;
                if (warmFor >= A["fridge.safeHoursUnopened"] && !timeline.some((e) => e.nodeId === key)) {
                    const limitDays = A["insulin.unrefrigeratedDays"];
                    timeline.push({ hour, nodeId: key, label: `${m.label} out of refrigeration`, kind: "warning",
                        detail: heat
                            ? `Room temperature is likely above ${A["insulin.maxSafeTempF"]}°F. FDA guidance for insulin covers 59–86°F only; keep it as cool as possible without freezing and replace it afterwards.`
                            : `For insulin, FDA says vials and pens keep up to ${limitDays} days at 59–86°F. Other medications vary; check the label.` });
                }
            }
        }
        else if (homePower) {
            fridgeWarmSince = null;
            level["fridge-cold"] = household.home.hasFridge ? A["fridge.safeHoursUnopened"] : 0;
        }
        // Consumption for this hour. A home that drinks bottled water draws on its
        // stored supply whenever it cannot buy more; other homes only when the tap is off.
        const canBuy = availability.get("buying") ?? false;
        const drawStoredWater = household.home.waterSupply === "bottled-only" ? !canBuy : !tapOk;
        if (drawStoredWater)
            level["stored-water"] = Math.max(0, level["stored-water"] - waterPerHour);
        if (level["perishable-food"] > 0) {
            level["perishable-food"] = Math.max(0, level["perishable-food"] - foodPerHour);
        }
        else if (!canBuy) {
            level["nonperishable-food"] = Math.max(0, level["nonperishable-food"] - foodPerHour);
        }
        if (!homePower && inventory.phones > 0) {
            let drain = phoneDrainPerHour;
            const fromPhone = Math.min(level["phone-battery"], drain);
            level["phone-battery"] = level["phone-battery"] - fromPhone;
            drain -= fromPhone;
            if (drain > 0) {
                const fromBank = Math.min(level["power-banks"], drain);
                level["power-banks"] = level["power-banks"] - fromBank;
                // Top the phone up from the bank so "phone-battery" reflects usable charge.
                if (level["phone-battery"] <= 1e-9 && level["power-banks"] > 0) {
                    const refill = Math.min(level["power-banks"], phoneWhTotal);
                    level["power-banks"] = level["power-banks"] - refill;
                    level["phone-battery"] = refill;
                }
            }
        }
        if (!homePower && isNightHour(hour, lightNeedPerNight)) {
            level["light-batteries"] = Math.max(0, level["light-batteries"] - 1);
        }
        if (household.home.cooking === "camp-stove")
            level["cooking-fuel"] = Math.max(0, level["cooking-fuel"] - cookingPerHour);
        if (!supplies["grid-power"] && inventory.generatorFuelLiters > 0) {
            level["generator-fuel"] = Math.max(0, level["generator-fuel"] - inventory.generatorLitersPerHour);
        }
        for (const m of inventory.medications) {
            level[`med:${m.id}`] = Math.max(0, level[`med:${m.id}`] - m.dosesPerDay / 24);
        }
        for (const id of Object.keys(level))
            series[id].push(level[id]);
    }
    // Final pass so a stock that hits zero in the last hour is recorded.
    const finalAvail = evaluate(graph, supplies, stockAvail());
    for (const node of graph.nodes.values()) {
        if (node.kind === "supply")
            continue;
        if (!finalAvail.get(node.id) && !failsAt.has(node.id)) {
            failsAt.set(node.id, duration);
            causesAt.set(node.id, explain(graph, finalAvail, node.id));
        }
    }
    const stocks = Object.keys(level).map((id) => {
        const s = series[id];
        const node = graph.nodes.get(id);
        const depletedIdx = s[0] > 0 ? s.findIndex((v) => v <= 1e-9) : (s[0] <= 0 ? 0 : -1);
        return { id, label: node?.label ?? id, unit: units[id] ?? "", initial: s[0], series: s,
            depletedAt: depletedIdx >= 0 ? depletedIdx : null };
    });
    // The chain behind each failing need, evaluated at the hour it failed.
    const stockById = new Map(stocks.map((st) => [st.id, st]));
    const availabilityAt = (hour) => evaluate(graph, supplies, Object.fromEntries(Object.entries(series).map(([k, v]) => [k, (v[Math.min(hour, duration)] ?? 0) > 1e-9])));
    const describe = (id, availability) => {
        const node = graph.nodes.get(id);
        const cause = { id, label: node.label, kind: node.kind, failsAt: failsAt.get(id) ?? 0, children: [] };
        if (node.why)
            cause.why = node.why;
        if (node.kind === "supply") {
            cause.reason = node.reason ?? "down";
        }
        else if (node.kind === "stock") {
            const st = stockById.get(id);
            const initial = st?.initial ?? 0;
            if (initial > 0 && st)
                cause.amount = `${formatAmount(initial)} ${st.unit}`.trim();
            if (id === "perishable-food" && fridgeFoodLostAt !== null)
                cause.reason = `lost at ${formatHours(fridgeFoodLostAt)} when the fridge warmed`;
            else if (initial <= 0)
                cause.reason = "none on hand";
            else
                cause.reason = `ran out at ${formatHours(st?.depletedAt ?? cause.failsAt)}`;
        }
        else {
            const deps = unmetDependencies(graph, availability, id);
            if (deps.length === 0)
                cause.reason = node.reason ?? "not available in this home";
            cause.children = deps.map((d) => describe(d, availability));
        }
        return cause;
    };
    const nodes = [];
    for (const node of graph.nodes.values()) {
        if (node.kind === "supply")
            continue;
        const outcome = {
            id: node.id, label: node.label, kind: node.kind, severity: node.severity ?? 0,
            failsAt: failsAt.has(node.id) ? failsAt.get(node.id) : null,
            causes: causesAt.get(node.id) ?? [],
            because: [],
        };
        if (node.short)
            outcome.short = node.short;
        if (node.why)
            outcome.why = node.why;
        if (node.kind === "need" && outcome.failsAt !== null) {
            // A need depends on exactly one capability, which fails at the same hour,
            // so the chain starts from that capability's own causes.
            const availability = availabilityAt(outcome.failsAt);
            const [capability] = unmetDependencies(graph, availability, node.id);
            if (capability) {
                const top = describe(capability, availability);
                outcome.because = top.children;
                if (top.children.length === 0 && top.reason)
                    outcome.reason = top.reason;
                if (top.why && !outcome.why)
                    outcome.why = top.why;
            }
        }
        nodes.push(outcome);
    }
    const relevant = (n) => n.failsAt !== null && (n.kind === "need" || n.kind === "capability")
        && !isIrrelevant(n, scenario, household);
    const failsFirst = nodes.filter(relevant).sort((a, b) => (a.failsAt - b.failsAt) || (b.severity - a.severity));
    const unmetNeeds = failsFirst.filter((n) => n.kind === "need");
    const critical = unmetNeeds.filter((n) => n.severity >= 4);
    const sustainableHours = critical.length ? Math.min(...critical.map((n) => n.failsAt)) : duration;
    timeline.sort((a, b) => a.hour - b.hour);
    return {
        scenarioId: scenario.id, scenarioName: scenario.name, durationHours: duration,
        stocks, nodes, failsFirst, unmetNeeds, timeline,
        sustainableHours, holdsFullDuration: critical.length === 0, dailyWaterLiters: dailyWater,
    };
}
/** Needs that don't apply to this household or scenario are hidden rather than shown as failures. */
function isIrrelevant(n, scenario, household) {
    if (n.id === "need:cooling" && !scenario.hazards.includes("extreme-heat"))
        return true;
    if (n.id === "cooling" && !scenario.hazards.includes("extreme-heat"))
        return true;
    if (n.id === "need:mobility" && scenario.shelter !== "evacuate")
        return true;
    if (n.id === "transport" && scenario.shelter !== "evacuate")
        return true;
    if ((n.id === "need:food-safety" || n.id === "perishable-food") && !household.home.hasFridge)
        return true;
    return false;
}
/**
 * The need that decides the verdict: the earliest critical need that fails
 * (severity 4 or more), or, when none does, the earliest failing need of any
 * severity. Null when every need holds.
 */
export function headlineNeed(result) {
    const critical = result.unmetNeeds.filter((n) => n.severity >= 4);
    return critical[0] ?? result.unmetNeeds[0] ?? null;
}
function clamp01(x) {
    return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}
