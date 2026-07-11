# Design: Full CCCBR library in the app (power-user method loading)

Status: **Implemented (v1)** · Date: 2026-07-11 · Author: Emma
Depends on: `ringing-lib-ts` **1.3.0** — `ringing-lib-ts/cccbr-methods` loader
(library **ADR-0022**). App is currently on **1.2.1**; this feature starts with a
dep bump.

## Goal

Let a power user pull methods that aren't in the bundled `STANDARD_SET` — a
specific method they're about to ring — by fetching the relevant CCCBR file at
runtime, without disturbing the fast, offline, always-available default the app
has today. The standard set stays the default and the fallback; the full library
is opt-in.

## Current state (what the feature has to fit)

The app's method list is a **static module constant**: `data/methods.ts` maps the
bundled `STANDARD_SET` into `METHODS: MethodDef[]` (plus `STAGES`, `STAGE_NAMES`)
at import time. That constant is read directly in six places — `App.tsx`
(resolves the selected `method`), `MethodPicker` (stage-filtered dropdown),
`MethodTrainer`, `spliceSets.ts` (validates set membership at module load), and
`course.ts`/`MethodExplorer` via the `MethodDef` type.

One thing is already in our favour: the build path is **source-agnostic**.
`course.ts`'s `buildMethod` is just
`Method.fromPlaceNotation(def.notation, def.stage, def.name)`, so any `MethodDef`
with notation + stage + name drives the explorer, blueline, and trainer
identically, whether it came from the standard set or a CCCBR fetch. Nothing on
the *rendering/training* side needs to change.

## The core shift

Everything hard about this feature reduces to one change: **`METHODS` stops being
a static array and becomes a runtime catalog that can grow asynchronously.** A
static `import`-time constant can't represent "the standard set, plus the Surprise
Minor file the user just fetched." Once the list is dynamic it also has to be
*reactive* — the picker must re-render when methods arrive — which rules out a
plain mutable module singleton and points at app state.

The plan is a small **method-catalog store** (a React context/provider) that owns
these collections and the load actions. Static consumers move from importing the
constant to reading the context; the consumers that legitimately want the
*baseline only* (spliced-set validation, and the offline fallback) keep importing
`STANDARD_SET` directly.

## The three tiers (Emma's UX model)

The catalog is deliberately **not** one merged pile. Keeping the picker clean and
short is a first-class goal, so there are three distinct tiers:

1. **Standard set** — the bundled `STANDARD_SET`. Always in the picker. Never
   polluted by loaded data.
2. **Used methods** — any method the user has actually selected before, remembered
   in **localStorage** and shown **inline in the picker alongside the standard
   set**, under the same stage-filter and sort rules. This is how a method
   graduates from "searched once" to "on my regular list."
3. **Loaded set** — the full CCCBR file(s) the user has fetched for a stage/class.
   This is large and lives **only behind a search screen**, never inline in the
   picker dropdown. It is transient (in-memory); a method only persists once it's
   been *used* (tier 2).

So the dropdown only ever shows tiers 1 + 2 — short, and personal to the user.
Tier 3 is reached on demand through search.

## Design

**1. `MethodCatalogProvider` (React context).** Holds:

- `standard: MethodDef[]` — seeded from `STANDARD_SET`.
- `used: MethodDef[]` — hydrated from localStorage on start; a `remember(method)`
  action appends (de-duped) when a method becomes the active selection.
- `pickerMethods: MethodDef[]` — the derived `standard ∪ used` list the picker
  renders (de-duped by `id`, else `name|stage`; a used method already in the
  standard set is not duplicated). `stages` derives from this.
- `loaded: Map<string, MethodDef[]>` — keyed `${fileClass}/${stage}`; the
  transient fetched sets the search screen reads. Not shown in the dropdown.
- `load(fileClass, stage)` — dynamically imports the loader, fetches, maps entries
  → `MethodDef`, stores under `loaded`, records provenance. Exposes per-request
  status (`idle | loading | error`) and the typed error.
- `provenance: Record<string, LibraryProvenance>` — so the search screen can show
  "Surprise Minor · CCCBR, as of Mon 06 Jul 2026".

`App.tsx`'s `method = METHODS.find(...)` becomes a lookup against
`pickerMethods` ∪ any active loaded set, so both a remembered method and a
just-searched one resolve as the selected method.

*Assumption to confirm:* "used" = the method became the **active selection** at
least once (in Explorer or Trainer). Flagged in Open Questions.

**2. Types.** Extend `MethodDef` with `id?: number` and
`source?: 'standard' | 'cccbr'`. `id` is the CCCBR method id both sources carry —
the de-dupe key. `source` lets the picker badge loaded methods and lets the
fallback path reason about origin.

**3. Compose + de-dupe.** Per library ADR-0022, merge is app-side:
`new MethodLibrary([...STANDARD_SET, ...loaded.library])` is the library's
suggested shape, but since the app works in `MethodDef`, the store keeps a `Map`
keyed by `id` (falling back to `name|stage` when an entry has no id) and merges
loaded entries in, **preferring the existing standard-set entry** on collision
(it's the curated one — e.g. Cambridge Surprise Minor is in both the standard set
and the Surprise Minor file). Map each `MethodLibraryEntry` → `MethodDef` with the
same field mapping used today.

**4. Dynamic import for code-splitting.** Load the subpath lazily:
`const cccbr = await import('ringing-lib-ts/cccbr-methods')`. The loader ships the
Text parser in its bundle; importing it only when a power user acts keeps it out
of the main bundle and the launch path — matching the "opt-in" intent and the
2 MB-file parse cost the ADR flags.

## UX

**The picker dropdown** shows only tiers 1 + 2 (standard set + your used methods),
stage-filtered and sorted exactly as today. At the **bottom** of the list sit one
or two action items (not selectable methods):

- **"Add methods…"** — always present. Opens the class/stage loader: a
  **file-class + stage** selector driven by `CCCBR_AVAILABILITY` /
  `classesForStage` / `stagesForClass` (only offers pairs CCCBR publishes) and a
  Load button that calls `load(class, stage)`. Per-(class, stage) granularity —
  never eager whole-stage (the Surprise Major file alone is 2 MB).
- **"Search loaded methods…"** — appears once a set has been loaded for the
  current stage/class. Opens the **search screen** (typeahead) over that loaded
  set.

**The search screen.** A typeahead over the loaded set(s) — the current picker is
a stage-filtered dropdown, fine for tens of methods but unusable at thousands, so
the large catalog is only ever navigated by search. Picking a method there makes
it the active method **and** remembers it (tier 2 → localStorage), so next time it
appears inline in the picker and doesn't need searching again. This search screen
is the biggest single piece of UI work in the feature.

**Provenance, loading, errors.** Show a spinner + "Loading Surprise Minor…" during
the fetch; on success, surface the provenance date on the search screen; on
failure, a non-blocking message ("Couldn't reach CCCBR — showing the standard
set").

**Fallback (app owns policy, ADR-0022/ADR-0014).** `load` catches
`CccbrLoadError` (network/HTTP) and `RangeError` (unpublished pair — the
availability-driven UI should prevent these anyway) and leaves the catalog as-is.
The standard set (and your remembered methods) always work, so a CCCBR outage
degrades to "standard + remembered only," never a broken app.

## Offline / caching

The three-tier model mostly settles this. The loader is pure-fetch (the library's
persistent-cache seam is deferred to a Phase 5 spike), so a **loaded set** (tier 3)
is in-memory only and lost on reload — which is fine, because it's transient by
design. What the user cares about keeping is their **used** methods (tier 2), and
those persist in **localStorage** with their full `MethodDef` (notation included),
so they **resolve offline without any re-fetch**. A ringer's actual working set
survives reload and works with no signal; the full library is re-fetched on demand
only when they go looking for something new.

So **no IndexedDB / full-file cache is needed for v1** — localStorage of used
methods is the cache, keyed by usage rather than by file. If whole-file offline
browsing ever becomes a goal, adopt the library's Phase 5 storage-adapter seam
rather than building a bespoke cache now.

## Touchpoints (change inventory)

- `package.json` — bump `ringing-lib-ts` to `^1.3.0`.
- `src/data/methods.ts` — keep the `STANDARD_SET` → `MethodDef` mapping as the
  seed; extend `MethodDef` with `id?`, `source?`; export the seed and the
  entry→`MethodDef` mapper for reuse by the store.
- `src/state/MethodCatalog.tsx` *(new)* — the provider: `standard` / `used` /
  `loaded` tiers, `pickerMethods` derivation + de-dupe, `load` action (dynamic
  import), `remember` action, provenance, status.
- `src/hooks/useUsedMethods.ts` *(new)* — localStorage hydrate/persist of tier 2
  (mirrors the existing `hooks/` pattern).
- `src/components/MethodSearch.tsx` *(new)* — the typeahead search screen over the
  loaded set; selecting a method sets it active + calls `remember`.
- `src/App.tsx` — wrap in the provider; resolve the selected method from
  `pickerMethods` ∪ active loaded set; host the search screen (modal/overlay or a
  transient view).
- `src/components/MethodPicker.tsx` — read `pickerMethods` from context; add the
  bottom action items ("Add methods…" loader; "Search loaded methods…").
- `src/components/MethodTrainer.tsx` — read catalog from context (drop the static
  `METHODS` import).
- `src/data/spliceSets.ts` — **unchanged**: keep validating against `STANDARD_SET`
  (spliced sets are curated against the standard 8, not the full library).
- `src/logic/course.ts`, `src/components/MethodExplorer.tsx` — unchanged (type
  only; source-agnostic build path).

## Open questions for Emma

1. **What counts as "used"?** Assumed: a method becomes tier 2 when it's the
   **active selection** (Explorer or Trainer). Alternative: only when explicitly
   chosen from the search screen. (Affects whether merely browsing standard
   methods ever writes to localStorage — it shouldn't, and the "active selection"
   rule is fine since standard methods are already tier 1.)
2. **Search screen as overlay vs its own view?** A modal/overlay over the current
   tab keeps context; a full view gives more room for results. Leaning overlay.
3. **Managing tier 2** — do users need to remove/forget a remembered method (a
   long list could accrue)? Suggest deferring an edit UI until it's a problem.
4. **"Add methods…" ↔ "Search loaded" as one entry or two?** Combined
   ("Add / search methods…") is tidier; two is clearer about load-vs-search. Minor
   — settle during build.

*(Earlier caching question is now resolved by the three-tier model — localStorage
of used methods is the v1 cache; no IndexedDB.)*

## Suggested phasing

1. Dep bump to 1.3.0 + verify build (small, de-risks the rest).
2. Catalog store + move consumers to context, seeded from `STANDARD_SET` — pure
   refactor, no new feature; ship and confirm nothing regressed.
3. Tier 2: `remember` + localStorage hydrate/persist; used methods appear inline.
4. `load(class, stage)` + the "Add methods…" bottom item + provenance/error UI.
5. The search screen (typeahead over the loaded set) + "Search loaded methods…"
   entry; selecting there sets active and feeds tier 2.

## Built (2026-07-11)

Implemented in one pass; `tsc` clean, ESLint 0 errors, production build green
with `MethodBrowser` code-split into its own chunk (CCCBR parser off the launch
path). Files:

- `package.json` — `ringing-lib-ts` → `^1.3.0`.
- `src/data/methods.ts` — `MethodDef` gains `id?`/`source?`; `entryToMethodDef`
  mapper; `methodKey` de-dupe key; `STAGE_NAMES` extended to 16.
- `src/state/MethodCatalog.tsx` *(new)* — provider + `useMethodCatalog`: the three
  tiers, `pickerMethods`/`stages` derivation, `findMethod`, `remember`
  (localStorage, key `methodical.usedMethods.v1`), `load` (dynamic import of
  `ringing-lib-ts/cccbr-methods`), per-(class,stage) status, provenance, typed
  error → message.
- `src/App.tsx` — provider wrap + `AppInner` resolving the method from the catalog.
- `src/components/Dropdown.tsx` — optional `actions` prop (pinned bottom items).
- `src/components/MethodPicker.tsx` — reads catalog; bottom actions; hosts the
  browser (React.lazy + Suspense).
- `src/components/MethodBrowser.tsx` *(new)* — the overlay: class+stage load
  (availability-driven) **and** typeahead search in one screen; picking a result
  calls `remember` + activates it.
- `src/App.css` — dropdown-action + browser-overlay styles.

**Deviations from the plan, worth noting.** (1) The loader panel and search screen
were merged into a single `MethodBrowser` overlay rather than a separate
`MethodSearch` — one screen serves both bottom items with less duplication.
(2) localStorage persistence lives inline in the provider, not a separate
`useUsedMethods` hook. (3) `MethodTrainer` needed no change — it already receives
the resolved `method` and only touches `STANDARD_SET` methods for splicing.

**Not verified here:** the live CCCBR fetch — this sandbox has no outbound route
to `methods.cccbr.org.uk` (same limitation the library hit). The failure/fallback
path and all app logic are exercised by the build; the happy-path fetch needs a
run in the browser (`npm run dev`, open the picker → "Add methods from CCCBR").
