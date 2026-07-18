# Engineering Principles — Change Management Tool

These principles govern all work in this repo. When a change would violate one, prefer the option that upholds it, and call out the trade-off. The overriding goal:

> **Build simple, maintainable, resilient systems that solve real business problems and remain easy to adapt as requirements evolve.**

---

## Code & design principles

- **DRY** — every business rule or piece of logic has one authoritative home. Before adding code, look for an existing function/pattern to reuse or extend. Duplicated logic is a defect waiting to desync.
- **KISS** — favour the simplest solution that solves the problem. Simple code is easier to read, test, and change.
- **YAGNI** — build only what's required now. No speculative parameters, abstractions, or "future-proofing" without a concrete present need.
- **SOLID**
  - **SRP** — a module has one reason to change.
  - **OCP** — extend behaviour without modifying existing, working code.
  - **LSP** — a subtype must be substitutable for its base without surprises.
  - **ISP** — depend only on the interface you use; keep them narrow.
  - **DIP** — depend on abstractions and injected collaborators, not concrete singletons.

## Architectural principles

- **Separation of concerns** — keep UI, business logic, and data access in distinct layers with clear ownership.
- **Loose coupling, high cohesion** — minimise dependencies between components; keep related responsibilities together. Components should evolve independently.
- **Explicit dependencies over magic** — declare and inject dependencies; avoid hidden globals and implicit behaviour. Behaviour should be predictable from the call site.
- **Design for failure** — assume networks, services, and inputs will fail. Surface errors to the user, add timeouts, degrade gracefully, and never lose user data silently.

## Leadership & mindset

- **Own the problem, not just the code** — measure success by the business outcome, not technical elegance.
- **Boy Scout rule** — leave every file you touch better than you found it: remove dead code, improve a name, add the missing test.
- **Optimise for change** — the real measure of quality is how easily the system adapts to new requirements. Favour modularity, clear boundaries, good tests, and low coupling.

---

## How these apply in this repo

### Structure & dependency flow
- npm-workspaces monorepo, three packages with a strict **one-way dependency flow: `client → domain ← server`**.
  - `packages/domain` — pure TypeScript (only runtime dep is `zod`): the Prosci methodology as code — types/zod schemas (`entities/`), vocabularies (`vocab/`), verbatim content (`content/`), and calculations (`calc/`). **It must never import from `server` or `client`.**
  - `packages/server` — Express 5 + better-sqlite3 API.
  - `packages/client` — Vite + React 18 + TanStack Query + React Router.
- Business logic and all Excel-parity math live in `domain/calc` and are imported by **both** server and client, so a computed value agrees everywhere. **Derived values (PCT scores, bands, risk quadrant, degree of impact, progress %) are never stored** — always recompute from raw responses.

### Server layering (router → service → repo)
- **Routers** handle HTTP only: read params, validate the body with `parseBody(schema, …)` (`infra/http.ts`), call a service, shape the response. No SQL, no business rules.
- **Services** own invariants, cross-entity coordination, and transactions.
- **Repos** are SQL-only; no domain logic.
- `db: Db` is **passed explicitly** from the composition root (`app.ts`) down through every router factory → service → repo. There is no module-level/global connection. Keep it that way.
- Errors: throw `HttpError`/`notFound()`; the central `errorHandler` maps them and never leaks stack traces.

### Client conventions
- Features talk to the server **only** through the typed `api` helper (`lib/api.ts`) and their feature data-hooks.
- **Feature data-hooks live in their own `useX.ts` file — never export a hook from a page component, and never import one page's hook from another feature.** (It couples features and defeats code-splitting.) `useGroups.ts`, `useActivities.ts`, `useBlueprints.ts` are the model to follow.
- Shared, presentation-only components live in `ui/`.
- Design for failure on the client is a live concern: surface mutation/query errors to the user and don't let autosave drop edits silently.

### Quality gate & testing
- **`npm run check` (typecheck + tests) must be green before every commit.** Add `lint` to this gate if/when a linter is introduced.
- Every behavioural change lands with tests at the right level: domain unit (vitest), server integration (supertest against a real in-memory SQLite with real migrations), client component (React Testing Library). A new `domain/calc` function must have a spec with boundary cases.
- Prefer extending an existing pattern over inventing a new one.

### Domain-specific constraints
- Prosci content is transcribed **verbatim** into `domain/src/content` — never paraphrase factor wording, definitions, or vocabularies.
- The Prosci content is under a **single-user license**: this app is for the license holder's personal use. Never publish it publicly, deploy it to a shared/public host, or distribute it.
- **Gotcha:** the API server reads `CMT_PORT` (not `PORT`) — dev harnesses set `PORT` for Vite and it would collide.

### Migrations & data
- SQLite migrations in `server/src/infra/migrations` run **transactionally and atomically** (a failed migration rolls back and does not advance `user_version`). Add new migrations as `NNN_name.sql`; never edit a shipped migration.

---

## Known improvement backlog

A prioritized list of principle-aligned improvements (design-for-failure gaps, DRY consolidations, tooling) is tracked in the review plan, not here — this file stays stable while the backlog evolves. When picking one up, follow the layering and testing rules above.
