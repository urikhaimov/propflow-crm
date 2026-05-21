# CRM real estate agency — Agent Instructions

## 🚀 Workflow & Verification

- **MANDATORY — BRANCH STRATEGY:** Default working branch is `dev`, never `main`. `main` is the deploy target — pushing to it triggers a production rollout, so it stays untouched while a feature is in flight. Every new feature lives on its own `feature/<name>` branch cut from `dev`; every bug fix on `bug/<name>` cut from `dev`. PRs only target `dev`; the merge from `dev → main` is performed manually by the user when a batch of work is ready to ship. Hotfixes still follow the same path (`bug/<name>` → PR → `dev` → manual promote). Never open a PR against `main`. Never push commits directly to `main` (the merge happens by hand). After landing on `dev`, the same CI checks run but the deploy job is gated on `github.ref == 'refs/heads/main'` and stays idle.
- **MANDATORY — NO CODE CHANGES WITHOUT APPROVAL:** Never edit, create, or delete source code files without the user's explicit approval. Always propose the change first, explain what will be modified, and wait for a go-ahead before writing any code.
- **MANDATORY — SKILLS FIRST:** At session start, invoke `superpowers:using-superpowers` (or the platform's discovery equivalent). For ANY UI/UX decision — component design, color, typography, layout, chart type, etc. — invoke the `ui-ux-pro-max` skill **before** writing code. If the skill isn't installed in the current environment, surface a one-line install hint to the user and proceed with sensible defaults — never silently skip this gate.
- **MANDATORY — ONE COMPONENT PER FILE:** Each React component lives in its own `.tsx` file under `components/<area>/<name>.tsx`. 
- **MANDATORY — POST-CODING ROUTINE:** After EVERY coding task, run these four steps in order before committing — `prettier + lint + build + update docs`:
  1. Update the relevant `.md` files in `docs/` (or `AGENTS.md`). Describe problem + solution + test plan. New runbooks go in `docs/runbooks/`, plans in `docs/superpowers/plans/`.
     No commit lands with a red lint, red build, or undocumented behavior change. The pre-commit hook backstops 1–3; step 4 is on you.
- **Clean Code:** Actively remove unused imports, duplicated code, and deprecated APIs (e.g., use `title` instead of `message` in `notificationApi`).
- **Release Fixes:** If encountering push rejections in CI, refer to `docs/release-fix.md` (perform `git pull --rebase` before pushing).

## Architecture



## Key Patterns

## Commands

- `npm install` — install all dependencies (root, apps, libs)
- `npm run dev` — start both client and api in dev mode via Nx
- `npm run build` — build all packages
- `npm test` — run all unit tests across the monorepo

## Testing

- **Philosophy**: Test behavior, not implementation.
- **Unit Tests**: Vitest. Files named `*.unit.test.ts(x)`.
- **Co-location**: Tests live in `__tests__/` directories next to the source files they test.
- **E2E Tests**: Playwright in `__tests__/e2e/`. Files named `*.spec.ts`.

## Important

- **Supabase MCP migration gotcha**: NEVER use `mcp__plugin_supabase_supabase__apply_migration` for changes that have a local file in `supabase/migrations/`. The MCP tool inserts a row into `supabase_migrations.schema_migrations` with its own auto-generated timestamp, which won't match your local file's timestamp — the next `supabase db push` in CI fails with "Remote migration versions not found in local migrations directory". Correct workflow when applying a fresh migration:
  1. Write the migration file under `supabase/migrations/<TIMESTAMP>_<name>.sql`.
  2. Apply the DDL via `mcp__plugin_supabase_supabase__execute_sql` (NOT `apply_migration`).
  3. **Immediately** insert the matching registry row so CI's `supabase db push` skips the file:
     ```sql
     insert into supabase_migrations.schema_migrations (version, name)
     values ('<TIMESTAMP>', '<name_without_prefix>');
     ```
     Skipping this step makes CI re-apply the DDL on the next push to main → `ERROR: type "x" already exists` and a failed deploy.
  4. Commit the local file.

  Recovery if you forgot step 3 and CI failed: run the INSERT above via `execute_sql`, re-run the failed CI job. If you used `apply_migration` and got an MCP-timestamp drift: `update supabase_migrations.schema_migrations set version = '<local-ts>' where version = '<mcp-ts>'`.

