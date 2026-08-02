# RingBell.co.uk — Competitive / Technical Analysis

*Analysis of `ringbell.co.uk/toolkit` (v2.0.14, dated 07‑Mar‑2026) and
`ringbell.co.uk/methods`, compared against the Methodical app and the
`ringing-lib-ts` library / test‑bench PoC. Prepared 2 Aug 2026.*

Author of the site: **Steve Scanlon** — a solo developer and adult ringing
recruit (from 1993) who writes his own learning software. Worth keeping in mind:
this is a hand‑built one‑person project, not a team product.

---

## 1. Technical analysis — how it's built, and what that means for devices

### The `/toolkit` app

The whole toolkit is **hand‑written vanilla JavaScript**. Observed directly in
the running page:

- One script, `toolkit200.js` — **~12.8 KB**, minified to a single line. The
  version is baked into the filename (`…200…` = v2.0.x), which is how it does
  cache‑busting: bump the filename, browsers refetch.
- One stylesheet, `toolkit200.css`. A couple of GIF/PNG images (`ham.png`
  hamburger, `bulb.gif`, a GIF page background).
- **No framework** — no React, Vue, Angular, jQuery, Bootstrap or Ionic.
- **ES5 style throughout**: 58 `function` declarations, *zero* arrow functions,
  *zero* `class`. Event handling is inline (`onclick=` in markup) rather than
  `addEventListener`.
- Rendering is **string/`innerHTML`‑based** — no `<canvas>`, no SVG. Blue lines
  and grids are drawn as styled HTML, which is why they print cleanly to A4.
- **No `fetch`/XHR.** Method data is held in `localStorage` as a small
  per‑method JSON record — e.g. the current method was
  `{"Name":"Plain Bob Triples","Notn":"7.1.7.1.…7.127","Bob":"14,147",
  "Sgl":"14,12347","Waypoint":"2nds,3/4…"}` (~530 bytes). It works on **one
  method at a time**; picking from "Popular Methods" or the "CCCBR Library"
  loads that record.
- **Not a PWA**: no web‑app manifest and no service worker. Layout switching is
  manual — there are explicit "Smartphone" and "Laptop / Desktop" menu modes
  rather than pure CSS responsiveness (though a `viewport` meta is set).

### The `/methods` sub‑site

Despite Emma's expectation that it's "built on the toolkit", the served
`/methods` pages are **completely static HTML** — zero scripts, just a
stylesheet and images. It's a curated, print‑oriented library of blue‑line
diagrams (each page prints as one or two A4 sheets). The *relationship* to the
toolkit is that these diagrams are the kind of output the toolkit generates; the
author's own note says the toolkit can print diagrams for the majority of the
CCCBR library at Minimus → Major. So: **toolkit = the dynamic generator,
`/methods` = a hand‑curated static gallery of its output.**

### Device / performance implications

- **Runs almost anywhere.** ES5, no framework, no modern browser APIs required,
  tiny payload. It will work on very old phones, locked‑down work machines, and
  cheap tower tablets with poor connectivity — which is explicitly the author's
  stated goal ("circumstances where it is not practical to install external
  software", e.g. a work machine).
- **Very fast, very light.** ~13 KB of JS plus a little CSS/images; near‑instant
  load even on weak signal.
- **No offline app mode.** With no service worker or manifest it can't be
  installed to the home screen and doesn't cache for true offline use; it relies
  on the normal HTTP cache and `localStorage` retaining the current method.
- **Simple, but dated, engineering.** Inline handlers + `innerHTML`, no build
  pipeline, no module system, single maintainer. Cheap to host (pure static
  files), but harder to extend and a small XSS surface (low risk since the data
  is the user's own).
- **Ceiling at Major (8 bells).** Coverage is Minimus, Doubles, Minor, Triples,
  Major — no Royal/Maximus.

### Contrast with Methodical's stack

Methodical is **React 19 + TypeScript + Vite**, built on the `ringing-lib-ts`
package, deployed to GitHub Pages, **installable as a PWA** (install prompt +
pinch‑zoom). Heavier payload and needs a modern browser, but far more
maintainable, offline‑capable, and backed by a typed domain library instead of
hand‑rolled string logic. The trade is reach‑on‑ancient‑devices (toolkit wins)
vs. maintainability, offline, and depth of engine (Methodical wins).

---

## 2. Feature comparison — toolkit vs Methodical

The toolkit's full menu (read from the live app):

**Method selection** — Popular Methods, CCCBR Library.
**Display / diagrams** — Method Diagram, Quick Chart (grid), Quick Line (blue
line), **Blue Circle Drawing** (circle‑of‑work), with customisable layout,
colours and *which bell* the line follows; print‑to‑A4 throughout.
**Learning aids** — Waypoints, Call Points, Learn Line, **Roller Coaster**,
Review P‑B‑S, plus plain‑language helpers (`OrdinalBell`, `PlaceWord`,
`LeadWord`, `SayNumber` — "make 4ths", etc.).
**Calls / touches** — Add Bob / Single, Touch Explorer, **Lead‑Based Touch
Editor**, **Course‑Based Touch Editor**, Display / Print Touch, and touch
proving (`ProveTch`).
**Other** — Call Changes mode, Smartphone/Desktop layouts, and **Share /
Export / Import**.

Methodical today:

- **Method Explorer** — grid + blue line (treble red, selectable working bell).
- **Method Trainer** — MethodTutor‑style drill; plain course or a
  *randomly‑called* touch (loading *real* compositions is flagged as planned).
- **Splice‑set builder**, **Call examples**, **Pinboard** (from the source).
- PWA install, pinch‑zoom, curated method set (~45 now; full CCCBR planned).

### Where the toolkit currently does more (worth considering)

- **Interactive touch entry + proving in the UI** — two touch editors
  (lead‑based and course‑based) plus a truth check. Methodical's trainer only
  plays random calls; there's no compose‑and‑prove surface yet.
- **Rich learner scaffolding** — waypoints, call points, circle‑of‑work
  ("Blue Circle"), plain‑language place calling, "Roller Coaster" and
  "Learn Line" modes.
- **Print‑to‑A4** with customisable layout/colour — a genuinely useful,
  low‑tech feature for tower/practice night.
- **Share / Export / Import** of touches and methods.
- **Call Changes** mode.

### Where Methodical already leads (or easily can)

- **Offline‑installable PWA**; the toolkit is online‑only.
- **A real typed domain core** (`ringing-lib-ts`) versus hand‑rolled string
  logic — the composing capability underneath Methodical is in a different
  league (see §3).
- **Stage reach** — the library/engine go to Royal (10)/Maximus for display,
  vs the toolkit's Major ceiling.
- **Full CCCBR library** via the planned bundled snapshot + loader (matches the
  `MethodLibrary` API, with classification and lead‑head codes for querying).

**Net:** the toolkit is a more *polished learner front‑end* right now;
Methodical has a stronger *foundation* but hasn't yet surfaced touches,
proving, printing, or the learner scaffolding.

---

## 3. Touches / composing — toolkit vs our library & PoC

This is the most interesting comparison, because the two tools are in different
categories.

### What the toolkit does

Touch **entry and basic proving for one method**:

- Add bobs/singles at calling positions via a **Lead‑Based** or **Course‑Based
  Touch Editor**; a **Touch Explorer** to move around it.
- `ProveTch` — a compact (~440‑char) routine that checks the entered touch for
  truth (repeated‑row detection) and whether it comes round.
- Display / print / share the resulting touch.

There is **no search or generation** — the ringer types the calling in; the tool
tells them if it's true. It's a learner/practice aid, capped at Major.

### What the PoC test bench actually does (confirmed from the repo)

The PoC (`app/` in the Ringing‑Library repo — a Vite + TypeScript app whose
`main.ts` is a deliberately **thin client that imports the real `src` directly**)
has four views:

- **Compose & Prove** — pick a method, type a calling (one char per lead),
  run. It builds a `Composition` via `fromCalling`, proves it with `.prove()`,
  and — nicely — surfaces the composition's canonical **`key()`, `hash()` and
  `toJSON()`** alongside the expanded rows. That's the shareable‑identity model
  made visible.
- **Search** — method, min/max changes, calls (bobs only / singles only /
  both), result cap → runs **`searchTouches` *and* `searchStedmanTouches`** to
  *generate* true come‑round touches shortest‑first. This is the capability the
  toolkit has no equivalent of.
- **Explore** — a method explorer over `STANDARD_SET` / `MethodLibrary` with
  plain‑course rows and working‑bell highlighting.
- **Playground** — apply a change/place notation to a row, and row algebra
  (transpose/compose two rows).

One important gap to note: the **Phase‑4a engine** (`LeadHeadEngine`,
meet‑in‑the‑middle counting, Q‑sets, to Royal) exists in the library but is
**not wired into the PoC UI** — the PoC only exposes the bounded
`searchTouches`/`searchStedmanTouches` searcher. The fast engine is capability
in hand that no front‑end surfaces yet.

### The library underneath (`ringing-lib-ts`)

The library is a genuine **composition engine**, not just a touch checker:

- **`Composition`** — an immutable, serializable, content‑hashed description of a
  touch (method + start + calls + length). Has a builder, a `fromCalling` parser,
  and **schema‑versioned JSON** (`toJSON`/`fromJSON`) built for caching, sharing
  and persistence. This is exactly the substrate a Share/Export/Import feature
  would want.
- **`Touch`** — expands a composition to rows with rigorous come‑round detection,
  including **Grandsire snap finishes**, and multi‑extent truth (`maxOccurs`).
- **`Prover`** — incremental, early‑exit, reports each false row *with the line
  numbers* where it recurred; emits a serializable `Proof` (a standalone truth
  fact). Considerably more than the toolkit's yes/no check.
- **Search** — `searchTouches` / `searchStedmanTouches` actually **generate**
  true come‑round touches, shortest‑first, bounded — a composing capability the
  toolkit lacks entirely. (Explicitly built to serve the test‑bench "Search"
  tab.)
- **Phase‑4a engine** — `LeadHeadEngine` / `GrandsireTriplesEngine`: dense‑rank +
  bitset kernel (Lehmer ranking, reachability DP, **meet‑in‑the‑middle**
  counting, **Q‑sets**), re‑provable results, generic over any lead‑head method,
  good to Royal. Designed behind a stable seam so a Rust/WASM engine can drop in.
- **`MethodLibrary`** — query by name/stage/classification/lead‑head code.
- ADR‑governed architecture throughout.

### Verdict

| | RingBell toolkit | Our library / PoC |
|---|---|---|
| Enter a calling | ✅ two editors | ✅ (`fromCalling`, builder) |
| Prove true/false | ✅ basic | ✅ rich (false rows + lines, multi‑extent) |
| **Generate/search touches** | ❌ | ✅ `searchTouches`, Stedman search |
| Counting / MITM / Q‑sets | ❌ | ✅ Phase‑4a engine |
| Serialize / share compositions | ✅ (its own format) | ✅ schema‑versioned JSON |
| Stage reach | ≤ Major | ≤ Royal (engine) |
| Polished end‑user UI | ✅ | ⚠️ throwaway test bench |

The toolkit beats us on **finished, ringer‑friendly UI**; we beat it on
**compositional depth** — we can *find* true touches and count/analyse them,
not just check one a user typed. The gap to close is presentation, not
capability.

---

## 4. Things to consider going forward

1. **Surface the engine we already have.** A compose‑and‑prove screen in
   Methodical (lead‑ or course‑based, like the toolkit) backed by
   `Composition`/`Touch`/`Prover` — plus a "find true touches" mode using
   `searchTouches` — would immediately leapfrog the toolkit, which has no search.
   The PoC already proves out exactly this wiring (Compose & Prove + Search
   views); Methodical can reuse the same library calls behind a real UI.
   Separately, the **Phase‑4a engine** (MITM/Q‑sets, to Royal) is built but
   unsurfaced — worth a spike to expose counting/analysis no other tool offers.
2. **Borrow the learner scaffolding.** Waypoints, call points, circle‑of‑work
   ("Blue Circle"), plain‑language place calling and print‑to‑A4 are the
   toolkit's real strengths and are cheap wins for Methodical's audience.
3. **Share / Export / Import touches.** `Composition.toJSON` (schema‑versioned)
   already makes this clean and forward‑compatible — a differentiator for a
   community‑shared library.
4. **Lean into stage reach and offline.** Royal/Maximus display and PWA offline
   are things the toolkit structurally can't match — worth making explicit.
5. **Mind device reach.** If any target users are on old tower tablets or
   locked‑down machines, the React 19 stack is heavier than the toolkit's ES5;
   the PWA/offline story is the counter‑argument, so keep it solid.
6. **Full CCCBR library.** The toolkit only holds one compact method record at a
   time and caps at Major. Methodical's planned bundled snapshot + loader
   (`MethodLibrary` with classification/lead‑head codes) is a clear upgrade path.

---

### Sources
- https://ringbell.co.uk/toolkit/ (live app, v2.0.14) — inspected in browser
- https://ringbell.co.uk/methods/ (static diagram gallery)
- `ringing-lib-ts` v1.3.3 type definitions (`composition`, `touch`, `prover`,
  `search`, `engine`, `method-library`) as bundled in the Methodical app
- PoC test bench: `github.com/emma-london/Ringing-Library` — `app/` (Vite/TS,
  `index.html` + `main.ts`) and the older single‑file `ringing-test-bench.html`;
  live demo at `emma-london.github.io/Ringing-Library`
