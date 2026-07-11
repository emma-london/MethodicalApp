# Design: Loading the full CCCBR method library via a library-provided loader

Status: **Proposed** · Date: 2026-07-11 · Author: Emma
Target repo: `ringing-lib-ts` (proposed **ADR-0021**) — drafted here because that's
the mounted folder; move into `docs/adr/` when accepted.
Revises: **ADR-0015** (bundled snapshot vs live fetch), consistent with
**ADR-0001** (zero-I/O core), **ADR-0016** (interface contract), **ADR-0019**
(subpath export / tree-shaking).

## Context

The querying interface is already done and is the right shape: the core exports
`MethodLibrary` + `MethodLibraryEntry`, and `MethodLibrary` is constructed from a
plain array — no file or network I/O in the core (ADR-0001). The lean field set
the full library needs (`id`, `leadHeadCode`, `symmetry`, `little`, plus name,
stage, classification, notation) is already on `MethodLibraryEntry`. So the app
can consume a full library with **zero interface changes** the moment it has the
array.

Two things are missing: the full data, and something that turns it into that
array. ADR-0015 resolved both — full library as per-stage JSON shards
(`data/method-library/full/stage-<n>.json`) plus a `manifest.json`, produced by
`npm run data:refresh`, **vendored into the package**, with a "thin loader
(import JSON → `new MethodLibrary`) is a one-liner per app." That plan was
designed but never executed (the shards were never vendored), and it made two
choices this proposal deliberately revisits:

1. **Bundle, don't fetch.** Chosen for offline reliability, given the upstream
   changes only ~monthly. The consequence ADR-0015 itself flagged: freshness is
   traded away, and "someone has to actually re-run the refresh or the bundled
   data silently goes stale."
2. **Loader per app.** Left to each app as a one-liner. Fine for one app; but a
   real loader for the *full* library isn't a one-liner once it has to pick
   shards, read the manifest, handle staleness, and cache — and Emma will write
   more than one app on this library.

The new direction: **fetch fresh data dynamically, and provide the loader from
the library** so apps don't re-implement it. The task is to do this without
regressing the offline guarantee that was ADR-0015's whole reason for existing.

## Decision

Add a **library-provided async loader as a new subpath export**
(`ringing-lib-ts/loader`) that dynamically fetches the full library from a
**hosted, versioned snapshot** and returns a `MethodLibrary`. The bundled
standard set stays as the always-available, zero-network default.

Four layers, only the middle two are new:

**1. Core — unchanged.** `MethodLibrary(entries)` stays zero-I/O (ADR-0001). The
loader is never imported by the core; apps that want offline-only never touch it.
This is the same isolation ADR-0019 already uses for `STANDARD_SET`.

**2. Hosted snapshot (the "fresh data" enabler).** The exact files the existing
`data:refresh` pipeline already produces — `manifest.json` +
`full/stage-<n>.json` — are **published to a stable, versioned URL** rather than
vendored into the npm package. Updating the data becomes "re-run refresh +
publish," decoupled from any package release. That is the freshness Emma wants,
and it directly fixes ADR-0015's staleness worry if the publish is a scheduled
CI job (monthly, matching upstream cadence). No client-side CCCBR parsing: the
Text-format parser stays build-time only; the client fetches already-normalized
`MethodLibraryEntry[]` JSON.

**3. Loader subpath `ringing-lib-ts/loader` (the reusable piece).**

```ts
// its own module → apps code-split it out of the main bundle,
// and it fetches at runtime → fresh data. Both senses of "dynamic import".
const { loadMethodLibrary } = await import('ringing-lib-ts/loader')
const lib = await loadMethodLibrary({ stage: 8 })   // → MethodLibrary
```

Proposed surface:

```ts
interface LoadOptions {
  stage?: number | number[]   // load only needed shards (ADR-0015 access pattern)
  baseUrl?: string            // override host: self-host, pin a version, tests
  fetch?: typeof fetch        // injectable; defaults to globalThis.fetch (Node 18+/browser)
  cache?: CacheAdapter        // optional persistence hook (see layer 4)
  signal?: AbortSignal
}
// resolves to a MethodLibrary; manifest metadata (upstream date, counts,
// schemaVersion) is exposed too so apps can show "data as of …".
loadMethodLibrary(options?: LoadOptions): Promise<MethodLibrary>
```

It reads `manifest.json`, fetches the requested stage shard(s), builds the
`MethodLibrary`, and returns it. `fetch` injection keeps it a genuine
*platform-agnostic* loader (browser, Node, tests) rather than browser-only — the
"platform-specific loader" the core docstring anticipated, solved by dependency
injection instead of platform branching.

**4. Offline reconciliation (honours ADR-0015's reason to exist).** Two layers
so moving bundle→fetch doesn't regress offline use:

- **Standard set stays bundled.** Listing/training the ~45 common methods needs
  no network — instant first paint, fully offline. The full loader is opt-in and
  lazy, behind a user action ("load full library"). ADR-0015's specific fear —
  needing connectivity *just to list methods* — never materialises, because that
  path uses `STANDARD_SET`, not the loader.
- **Cache adapter.** Once a stage is fetched, a `CacheAdapter` (IndexedDB in the
  browser, filesystem in Node) keeps it for next time; the manifest's
  version/date drives revalidation. Result: **fresh when online, last-known when
  offline.** HTTP caching (ETag / Cache-Control on the hosted assets) plus an
  in-memory memo give the network-efficiency baseline for free.

## Options considered

- **Keep ADR-0015 as-is (bundle full library in npm).** Rejected: no freshness
  without a package release, and the manual-refresh staleness risk stays. Still
  bloats every install with a few-MB dataset most sessions don't use.
- **Loader lives in the core.** Rejected: reintroduces I/O into the zero-I/O core
  and defeats tree-shaking. A subpath module keeps the same boundary ADR-0019
  drew for `STANDARD_SET`.
- **Loader per app (ADR-0015's "one-liner").** Rejected as the primary reason for
  this ADR: the full-library loader isn't a one-liner (shards, manifest,
  staleness, cache, fetch injection), and re-implementing it per app is exactly
  what Emma wants to avoid. It still "stays out of the core" — it's just shared.
- **Fetch raw CCCBR Text/XML at runtime and parse client-side.** Rejected:
  ships a parser into every app bundle and couples clients to upstream format
  quirks. Publish the pre-normalized snapshot instead; the parser stays
  build-time (reusing `parse-cccbr-text.mjs`).
- **One monolithic hosted asset vs per-stage shards.** Keep per-stage shards
  (ADR-0015) — matches the loader's `stage` option and the "a band rings one
  stage at a time" access pattern; a phone never parses all 20k+ methods.
- **Caching: none / HTTP-only / pluggable adapter.** Pluggable adapter, with
  HTTP + in-memory memo as the baseline. The browser IndexedDB impl can ship as
  a second tiny subpath or start app-provided.

## Consequences

- The library gains a network-facing module for the first time — acceptable
  because it's isolated to an opt-in subpath the core never imports, but it does
  mean the library now owns a hosting + publish story it didn't before.
- Freshness is *decoupled from releases* and, with scheduled CI publishing,
  ADR-0015's "data silently goes stale" consequence is actually resolved rather
  than merely accepted.
- One loader, reused across future apps — the direct goal. New apps get the full
  library in one `await loadMethodLibrary()` line.
- `MethodLibrary` is now instantiated from three sources for three purposes:
  `STANDARD_METHODS` (truth corpus, tests), `STANDARD_SET` (bundled offline
  default), and the fetched full library (loader) — worth naming clearly in code.

## Open questions for Emma

1. **Where to host?** GitHub Pages of the library repo (free, CDN-fronted,
   versioned by path) vs release assets vs a CDN. Pages with a versioned path +
   a `latest` alias is my default suggestion.
2. **Pin vs latest.** Does an app pin a snapshot version (reproducible) or always
   take `latest` (freshest)? Suggest: manifest carries a version; loader defaults
   to a pinned known-good, `baseUrl`/option to opt into `latest`.
3. **Cache in v1?** Ship a default browser (IndexedDB) `CacheAdapter` in the
   first cut, or rely on HTTP caching first and add persistence later?
4. **Confirm `STANDARD_SET` stays bundled** as the offline default once the
   loader exists (I'm assuming yes).
5. **Automate the refresh+publish** as scheduled CI (monthly)? This is what turns
   "fresh data" from aspiration into something that stays true without anyone
   remembering to run it.
