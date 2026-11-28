# Agility Camp

A family Advent calendar game: a miniature schnauzer runs a Christmas agility course, and a new door opens every day of December.

The browser game and its small server live in [`web/`](web/). The original Rust/Bevy version is preserved under the git tag `v0.1-bevy`.

## Running locally

Needs Node.js 26 or newer.

```bash
cd web
npm install
npm run server   # API on http://localhost:8787
npm run dev      # game on http://localhost:5173
```

`npm test` runs the rules, level and server tests; `npm run typecheck` checks types.
