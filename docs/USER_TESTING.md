# User testing plan

Goal: find out whether real households can enter their situation in a few
minutes, whether the "what fails first" result matches what they would expect
or teaches them something, and whether the task list leads to an action.

Three to five households, 30–40 minutes each, on their own phone. Mix:
apartment with a pumped water supply, house with gravity water, at least one
household with a refrigerated or daily medication, one with an older person or
an infant, one with pets.

## Before the session

- Ask them to open the live link once on Wi-Fi so it is cached, then put the
  phone in airplane mode for the session. If it does not load offline, that is
  finding number one.
- Have a notepad; do not look at their screen unless invited.

## Script

1. **Warm-up (3 min).** "When was the last time you lost power or water? What
   ran out, or what did you worry about?" Write down their own words for the
   worst part. The app should later name that thing.
2. **Intake (10 min, timed).** "Fill this in for your home as it is right now.
   Think out loud." Note every pause longer than five seconds, every "what does
   this mean?", and every field they guess. Record the finishing time.
3. **First reaction (5 min).** On the scenarios screen, before they tap
   anything: "Which of these would you worry about most? Which number
   surprises you?" Then let them open one.
4. **Fails-first check (5 min).** "Does the order match what you'd expect?
   Is anything missing from the list of what fails?" If they disagree, ask
   what the app would need to know to get it right.
5. **Task list (5 min).** "Pick one thing from 'Do now' you'd actually do this
   week." Then: "Is there a task here you'd never do? Why?"
6. **Print plan (3 min).** Show the print view. "Would you put this on the
   fridge? What is missing from it?"
7. **Wrap-up (4 min).** "If this disappeared tomorrow, would you miss it?
   What would you tell a neighbour it does?"

## What to measure

| Measure | How | Pass |
|---|---|---|
| Intake time | Stopwatch from step 2 start to the scenarios screen | Under 8 minutes without help |
| Confusing fields | Count of "what does this mean?" and guesses | Any field confusing to 2+ households gets rewritten |
| Credibility | In step 4, did they agree with the first two "fails first" items? | 4 of 5 households agree, or disagree with a reason the engine can model |
| Surprise | Step 3: at least one "I didn't know that" | 3 of 5 |
| Action | Step 5: a concrete task they commit to, and a follow-up message a week later asking if they did it | 3 of 5 did it |
| Offline | Loaded in airplane mode | 5 of 5 |

## Likely findings to watch for

- Person-days of food is an unnatural unit. If two households struggle,
  switch to "how many days would your cupboard feed everyone?"
- The assumptions screen is for the curious; most people will never open it.
  Check whether the tasks and hero line carry the key numbers on their own.
- Pet water defaults to zero because no official daily figure exists. See
  whether pet owners notice the task that asks them to set it.
- Households with a generator or solar: the current model is crude (litres per
  hour). Ask what they actually know about their setup.

## After each session

Write up in this format and commit it under `docs/sessions/`:

```
Household: 2 adults, apartment, pumped water, 1 cat
Intake time: 6:40
Confusing: "person-days", "freezer fullness"
Fails-first agreement: yes (water at 19 h matched their 2023 outage)
Surprise: did not know the fridge is only good for 4 hours
Committed task: fill the bathtub when a typhoon warning is issued
Would miss it: "yes, before storm season"
```
