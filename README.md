# Methodical

A cross-platform web app to **look up and learn change ringing methods**. Runs
in any browser — no Android/iOS lock-in.

Built on [`ringing-lib-ts`](https://www.npmjs.com/package/ringing-lib-ts), the
same domain library behind the Ringing Library test bench, with the tech stack
and look-and-feel of the Call Change App (React + TypeScript + Vite, deployed to
GitHub Pages).

## Tabs

- **Method Explorer** — pick a method and see its plain course as a numbers grid
  or as a blue line (treble in red, a selectable working bell in blue).
- **Method Trainer** — a MethodTutor-style drill. You control one bell; the three
  buttons move it down a place, make places, or up a place. The app checks each
  move and reveals the next row when you’re right. Practise the plain course, or
  a randomly-called touch. (Loading real compositions is a planned enhancement.)

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm run preview  # preview the build
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. The Vite `base` is set to `/MethodicalApp/` to match
the repository path — update it if the repo is renamed.

## Method data

v1 ships a curated subset of common methods across stages (see
`src/data/methods.ts`). The full CCCBR library (25k+ methods) can be added later
as a bundled snapshot generated from the Ringing Library’s `data:refresh`
tooling — it is application data, not part of the npm package.
