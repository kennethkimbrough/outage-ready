# Prior art

A scan of existing products and open-source projects that overlap with Outage
Ready, done on 2026-10-30 with web and GitHub search. The question was: does
something already do "tell me what my household can sustain, what fails first,
and what to do next"?

Short answer: supply trackers that report "days of readiness" are common, and
two or three projects run scenario stress tests. None found models the
dependency chain (pump → power, fridge → power → medication, phone → power
bank → network) hour by hour, and none produce a prioritised task list from
the time-to-failure. That chain is where Outage Ready differs.

## Commercial products

| Product | What it does | Scenarios | What fails first | Offline | Notes |
|---|---|---|---|---|---|
| [MyPlann](https://www.myplann.com/) | Household + inventory (water, food, fuel, medicine, baby and pet supplies with expiry and location). Days-of-readiness figure, gap analysis, FEMA kit check, shopping list. | Yes: grid-down, pandemic, hurricane, earthquake; counts only resources that still work and lets you adjust how long power, water and gas stay on. | Reports which resource runs out first at the category level. | Not stated; web app with login. | Closest commercial match. Free in early access, paid Household/Plus tiers. |
| [Provision Planner](https://provisionplanner.com/) | Barcode-scanned pantry/garage/go-bag inventory; days per person; gap list; printable binder with contacts and meeting points. | Scenario tools (power outage, winter storm) show what is covered. | Not described. | Desktop app runs fully offline; web/mobile unclear. | Free tier, subscription, lifetime purchase. iOS, Android, web, desktop. |
| [Salt & Prepper](https://www.saltandprepper.com/) | "Food storage tracker that tells your family how many days your supplies will last." | Not stated. | Not stated. | Not stated. | Coming-soon page only. |
| [Be Ready](https://thebereadyapp.com/) | Emergency kit planner and 72-hour family plan. | Checklist-based. | No. | Not stated. | Checklist style. |

## Open-source projects on GitHub

| Project | What it does | Scenarios | What fails first | Offline | Stack |
|---|---|---|---|---|---|
| [MuhammadNabiyev/ready72](https://github.com/MuhammadNabiyev/ready72) | Household + hazards + stored supplies → checklist, 0–100 readiness score, shopping list, family plan. | "Stress tests": shelter 3 days, week-long outage, 15-minute evacuation, heatwave + blackout, each pass/fail with the shortfall. | A "time machine" simulates 0–14 days of water, food, medication and pet-food consumption. Supply depletion only; no utility or equipment dependencies. | PWA, localStorage, JSON backup. | Next.js, Tailwind, Radix. |
| [holdTheDoorHoid/ready-reckoner](https://github.com/holdTheDoorHoid/ready-reckoner) | US ZIP/county + household + budget → ranked local hazards with cited frequencies, days of readiness per consequence, month-by-month purchase plan, printable binder. | Hazard → consequence mapping (no power, no safe water, no income). | No time-based simulation described. | Static, offline, no server. | Rust→WASM engine, Svelte. Every number cited, which is the same discipline this project follows. |
| [Sreenivas-Sadhu-Prabhakara/readykit](https://github.com/Sreenivas-Sadhu-Prabhakara/readykit) | Region-aware checklist with quantities and a reason per item. | By hazard. | No. | 100% offline, printable. | — |
| [TheMooseSaysMoo/bunkerr](https://github.com/TheMooseSaysMoo/bunkerr) | Self-hosted inventory with expiry alerts, barcode scanning, power equipment, Meshtastic node health. | No. | No. | Offline-capable PWA. | Self-hosted server. |
| [TimoM84/8star-prep](https://github.com/TimoM84/8star-prep) | Supplies, nutrition coverage, expiry reminders, automatic ration planning. | No. | Nutrition coverage in days. | Web app. | — |
| [geoffreycrofte/kitzy-survival-kit](https://github.com/geoffreycrofte/kitzy-survival-kit) | Survival-bag and stock checklist. | No. | No. | PWA. | — |
| [aradhya315/NIRANTAR](https://github.com/aradhya315/NIRANTAR) | Offline-first preparedness web app. | — | — | Offline-first. | — |

Several of these are recent and small (zero or single-digit stars), which
suggests the idea is being rediscovered rather than solved.

## Where Outage Ready sits

What is the same as the better projects above:

- days-of-supply arithmetic for water, food and medication
- offline-first, no account, data stays on the device, JSON export
- cited sources for every default figure (ready-reckoner does this too)
- a printable plan

What is different:

1. **A dependency graph, not a list of supplies.** Resources feed capabilities
   that serve needs. A pumped water supply fails with the power; refrigerated
   medication depends on the fridge, which depends on power or a generator; a
   phone depends on its battery, then the power bank, and still needs the
   network. The same inventory gives different answers in different homes.
2. **Hour-by-hour simulation per scenario**, including cold-chain timing
   (fridge 4 h, freezer 24/48 h, insulin 28 days at room temperature) and
   phone/power-bank energy, producing a "what fails when" timeline rather than
   a single days-of-readiness number.
3. **A prioritised task list derived from the simulation**, scored by
   severity × time-to-failure ÷ effort and split into do now / before / during,
   so the output is actions, not a score.
4. **Zero runtime dependencies.** Plain TypeScript and Web Components, under
   100 KB uncompressed, which matters when the first visit might be on a
   patchy connection and the next one has none.

What the alternatives do better, and Outage Ready does not attempt yet:

- barcode scanning and expiry tracking (Provision Planner, bunkerr, MyPlann)
- region-specific hazard likelihoods (ready-reckoner)
- nutrition-level food modelling (8star-prep)
- a readiness score to show progress over time (ready72)

## Still to validate

A search is not proof that the engine is useful to real households. See
[USER_TESTING.md](USER_TESTING.md) for the plan to test it with 3–5 households.
