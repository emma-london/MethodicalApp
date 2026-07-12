# Design: Spliced Methods in the Method Trainer

Status: Accepted · Target: Method Trainer tab · Author: Emma

## Summary

Add **spliced** ringing to the Method Trainer: a session where the method being
rung can change at each lead end, drawn from a chosen set of same-stage methods
(the *standard 8 surprise major* being the canonical example). The upcoming
method is announced at the lead end, exactly the way bobs and singles are
announced today.

## What spliced is

Spliced is a touch in which you switch from one method to another **at the lead
end**. All the work of each lead belongs to whichever method is current; at the
lead head you may hand over to a different method, which then supplies the whole
of the next lead.

Two facts shape the design:

- **The only hard constraint is stage.** Any two same-stage methods *can* be
  spliced — the lead head produced by method A is simply the start row for
  method B. "Standard groups" (the standard 8, the standard 4, …) exist for
  musical and practical reasons (shared Plain Bob lead heads, so ordinary calls
  behave and touches come round), not because splicing is otherwise impossible.
  The app therefore ships curated sets but the underlying engine treats a set as
  "any list of same-stage methods".
- **Splicing happens at the lead end** — the same seam where the trainer already
  computes `leadHeadAbs` and drops a call mark. Method changes and calls slot
  into one place, so no new timing machinery is needed.

## The skill it teaches

Spliced trains two things, and the UI must serve both:

1. Ringing each method's blue line correctly — already handled by the trainer.
2. **Knowing which method you are in, and noticing when it changes** — the new
   skill and the reason spliced exists. This makes the "current method" a
   first-class piece of the display, and makes the lead-end transition a moment
   the UI calls out.

## Decisions

Three forks were settled up front:

| Decision | Choice | Rationale |
| --- | --- | --- |
| How the learner learns the next method | **Announce it (call-style)** | Reuses the existing lead-end banner; teaches the blue lines and the transitions without adding a recognition test. A "quiz me" mode is a clean later addition. |
| How methods are chosen | **Curated presets first** | Named groups (Standard 8 Surprise Major, …) are the primary path; a custom same-stage multi-select can be layered onto the same picker later. |
| How the next method is chosen within a session | **Random per lead** | Mirrors how calls are already chosen (weighted-random per lead), so the engine change is minimal. Fixed rotation / real compositions are possible future modes. |

## Data model

A small preset table sits beside `METHODS`, referencing method names that
already exist in the library's `STANDARD_SET` (verified present: all eight
standard surprise major methods are in the bundled set). No method definitions
are copied locally — presets are name references into the single source of
truth.

```ts
// src/data/spliceSets.ts
export interface SpliceSet {
  name: string       // e.g. "Standard 8 Surprise Major"
  stage: number      // all methods in the set share this stage
  methods: string[]  // method names, each resolvable in METHODS
}
export const SPLICE_SETS: SpliceSet[]
```

## Engine change

`generateLeads` generalises from "one method, N leads" to "a list of candidate
methods, pick one at random per lead". A single-element list reproduces today's
behaviour exactly.

```ts
export interface LeadMethod {
  method: Method
  calls: CallDefinition[]   // [] in plain mode; standardCalls(m) in touch mode
  trebleLeadOffset: number  // per-method (0 for surprise major)
}

export function generateLeads(
  methods: LeadMethod[],   // one or more; a random one chosen per lead
  startRow: Row,
  numLeads: number,
  absOffset: number,
): LeadBatch
```

`LeadBatch` gains, alongside `callsAt` / `callMarks`:

- `methodMarks: Map<number,string>` — lead-head index → the method of the lead
  that just finished. Rendered beside the rows, like a call mark. Only populated
  when the set has more than one method.
- `methodAt: Map<number,string>` — the announce window for the **upcoming**
  method, spanning the lead-end transition, so the banner flashes the new method
  name as it takes over. Same pattern as `callsAt`.
- `leadMethodAt: Map<number,string>` — every row index → the method governing
  that lead, so the meta line can show the live current method cheaply.

Because a lead can be both bobbed and a method-change, the method banner and the
call banner coexist rather than replace each other.

## UI

- **Picker.** `MethodPicker` gains a top-level toggle, *Single method* vs
  *Spliced*. In spliced mode the single-method `<select>` is replaced by a preset
  `<select>` populated from `SPLICE_SETS`; the plain/touch segment still applies
  (you can splice plain courses or spliced touches).
- **Meta line.** In spliced mode it shows the live method:
  "You are ringing 5 · **Yorkshire** · lead 3", updating as the method changes.
- **Rows.** Each lead head carries a small method label beside it (reusing the
  `call-mark` treatment) so a learner can review which method each lead was.
- **Banner.** The upcoming method is announced at the lead end ("→ Cambridge"),
  reusing the `call-banner` element and timing.

## Notes / edge cases

- `App` keeps owning single-method selection (shared with the Explorer). The
  spliced set is trainer-local state, so the Trainer ignores its single `method`
  prop while in spliced mode. This keeps `App` and the Explorer untouched.
- Stage is constant within a set by construction, so "your bell" and the row
  width never change mid-session.
- The per-method `trebleLeadOffset` (the Grandsire special-case) is carried on
  each `LeadMethod`; the standard spliced sets are all offset 0.

## Custom groups (implemented)

Beyond the curated presets, the ringer can build their own group. The spliced-set
dropdown carries bottom-of-list actions in the same style as the method
dropdown's "+ Add methods from CCCBR…": **"+ New spliced group…"** (always) and
**"🗑 Delete …"** (when the selected set is a custom one).

"New spliced group…" opens a builder overlay (`SpliceSetBuilder`, styled like the
CCCBR method browser) where the ringer names the group, picks a stage, and ticks
the methods to splice. The method list is the catalog's `pickerMethods` — the
standard set plus anything the ringer has used or downloaded — filtered to the
chosen stage, so downloaded methods are eligible. A set needs a unique name and
at least two methods.

Custom sets persist in `localStorage` (`methodical.spliceSets.v1`) via a small
module store (`state/spliceSetStore.ts`) exposed through `useSpliceSets()`, which
merges built-in and custom sets and keeps the picker and trainer in sync via
`useSyncExternalStore` — the same persistence pattern as the "used methods" tier,
without adding another context provider. Because a custom set may reference a
downloaded method, the trainer resolves members through the catalog's
`findMethod` (all tiers) rather than the bundled `METHODS` list.

## Future work

- "Quiz me" mode: hide the current method and test recognition.
- Fixed rotation and real-composition sequencing as alternatives to random.
- Editing an existing custom group (currently: delete and recreate).
