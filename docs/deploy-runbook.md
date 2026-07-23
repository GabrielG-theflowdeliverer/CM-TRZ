# Deploy Runbook — Fly.io (single private instance)

Prod-readiness **item 2**. This is the step-by-step to stand up the *one* private,
password-protected instance the license allows. Run the numbered commands
yourself (they need your Fly account); nothing here deploys automatically.

> **License reminder:** one private instance for the license holder only. Do not
> share the URL, do not scale past one machine, do not make it multi-tenant.

## What's already verified
- The production runtime was exercised locally: `npm start` serves the built SPA,
  `/api/health` returns `{"ok":true}`, the app mounts under the enforced CSP.
- `fly.toml`, `Dockerfile`, and the env-var wiring (`CMT_PORT`/`CMT_DB_FILE`/
  `CMT_BACKUP_DIR`, volume at `/data`, health check on `/api/health`) are
  consistent and reviewed.
- **Not** verified here: the Docker *image build* (no Docker daemon on the dev
  box). Fly builds the image remotely on first deploy — that deploy is the build
  test. `--remote-only` below means you don't need local Docker either.

## Prerequisites
1. Install flyctl: `brew install flyctl` (or `curl -L https://fly.io/install.sh | sh`).
2. Log in — run this yourself in the session with `!`:
   ```
   ! fly auth login
   ```

## One-time setup

**1. Pick a globally-unique app slug.** `fly.toml` currently has
`app = "change-management-tool"`. If Fly says it's taken, change just that line
(the file comment suggests `cm-trz`). Then create the app:
```
! fly apps create <your-slug>
```
(Keep `fly.toml`'s `app = ...` in sync with the slug you create.)

**2. Create the data volume** (SQLite DB + startup backups live here; `fly.toml`
mounts `cmt_data` → `/data`, region `ams`):
```
! fly volumes create cmt_data --region ams --size 1 --app <your-slug>
```

**3. Set the two runtime secrets** (auth is enabled only when BOTH are present —
`resolveAuth()` fails loud if only one is set):
```
# Session-cookie signing key — generate a fresh random one:
! fly secrets set CMT_SESSION_SECRET="$(openssl rand -hex 32)" --app <your-slug>

# Editor password hash — generate the scrypt hash from your chosen password:
! npm run hash-password -w @cmt/server -- '<your-strong-password>'
# copy the printed salt:hash value into:
! fly secrets set CMT_EDITOR_PASSWORD_HASH='<paste-salt:hash-here>' --app <your-slug>
```
Notes:
- Cookies default to `Secure` (Fly serves HTTPS with `force_https`), so no
  `CMT_INSECURE_COOKIES` override is needed in prod.
- To rotate the password later: re-run `hash-password` and re-set the secret.
  Rotating `CMT_SESSION_SECRET` revokes every live session.

## First deploy
```
! flyctl deploy --remote-only --app <your-slug>
```
This is the real image-build test. Watch for the better-sqlite3 native build in
the builder stage to succeed.

## Verify (do together after deploy)
```
! curl -s https://<your-slug>.fly.dev/api/health        # -> {"ok":true}
```
Then in a browser: load the app → you should be prompted for the editor login →
log in with your password → create/open a project. Optionally round-trip a survey
token to confirm the public capture path works over HTTPS.

## Enable CI auto-deploy (optional)
`.github/workflows/deploy.yml` auto-deploys `main` after green CI, using the
GitHub Actions secret `FLY_DEPLOY_TOKEN`. To wire it up:
```
! fly tokens create deploy --app <your-slug> --expiry 8760h
! gh secret set FLY_DEPLOY_TOKEN --body '<paste-token>'
```
Until this is set, deploys are manual via the `flyctl deploy` step above (which
is fine, and arguably preferable for a single-user app you deploy deliberately).

## Rollback
```
! fly releases --app <your-slug>            # list releases
! fly deploy --image <previous-image-ref>   # or: fly releases rollback
```
The volume (and its data) is untouched by a rollback.

## Acceptance (marks item 2 done)
- [ ] `flyctl deploy` succeeds (image builds, machine boots).
- [ ] `GET /api/health` is green over HTTPS.
- [ ] Editor login works; the API is 401 without the session cookie.
- [ ] A startup backup was written under `/data/backups` (check `fly logs`).
