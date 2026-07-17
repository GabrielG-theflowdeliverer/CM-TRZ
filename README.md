# Change Management Tool

A web workspace for Prosci change management practitioners with **feature parity to Prosci Proxima Offline** (the Excel workbook), extended with:

- **Multiple projects** and a unified **Portfolio Dashboard** (PCT bands, risk quadrant, barrier-point distribution, activity progress, overdue counts, next milestones).
- **Repeatable assessments** — run PCT, Risk, ADKAR and Sponsor/Manager Competency assessments any number of times per project; PCT runs build the Organizational Performance trend automatically.
- **Multiple ADKAR blueprints** per project (overall / per group / custom) with point-in-time **snapshots** for versioning.
- Live cross-module data flow: Roadmap ADKAR milestone dates feed blueprint targets and the Tracking Calendar; impacted groups link to plan activities, roles and resistance rows.

> **License note:** the Prosci assessment items and helper texts reproduced in `packages/domain/src/content` are covered by a Prosci Digital Product Single User License. This app is for the license holder's personal use and must not be published or distributed.

## Architecture

npm workspaces monorepo, one-way dependency flow `client → domain ← server`:

| Package | Role |
| --- | --- |
| `@cmt/domain` | Pure TS: verbatim Prosci content, vocabularies, zod entities, and all Excel-parity calculations (PCT scoring/bands, risk quadrant, degree of impact, ADKAR barrier point, competency totals, progress/health rollups). Used by both client and server so computed values always agree. |
| `@cmt/server` | Express 5 + better-sqlite3. Feature modules (`projects`, `assessments`, `impact`, `roles`, `roadmap`, `blueprints`, `plans`, `tracking`, `docs`, `transfer`, `dashboard`), each layered router → service → repo. Derived values are never stored. DB at `packages/server/data/proxima.db`. |
| `@cmt/client` | Vite + React 18 + Tailwind v4 + React Router + TanStack Query + Recharts. Feature-sliced pages mirroring the server modules, autosave-on-blur editing. |

## Commands

```bash
npm install
npm run dev     # server on :3001 + Vite client on :5173 (proxying /api)
npm test        # domain unit + server integration + client component suites
npm run check   # typecheck + all tests
npm run build   # production client build (served by the server when present)
npm start       # production mode: API + built client on :3001 (CMT_PORT to override)
```

## Testing

- **Domain** (`packages/domain/src/**/*.test.ts`): Excel-parity cases for every calculation, including band/quadrant boundary values and null-handling semantics lifted from the workbook formulas.
- **Server** (`packages/server/test`): supertest integration suites against a real in-memory SQLite with real migrations — CRUD, validation rejections, FK behavior, project duplication deep-copy, export/import round-trip, dashboard aggregation.
- **Client** (`packages/client/src`): React Testing Library specs for the logic-bearing components (score pickers, band chips, autosave fields, PCT triangle).
