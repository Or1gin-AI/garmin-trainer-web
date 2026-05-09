# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The umbrella `../CLAUDE.md` covers cross-repo context. Read it first if you arrive cold. The companion api repo (`../api/CLAUDE.md`) documents what this frontend talks to.

## This is Next.js 16

Behavior, file conventions, and built-in APIs may differ from older training data. The bundled docs at `node_modules/next/dist/docs/01-app/` are authoritative — read the relevant guide before changing routing, caching, or middleware. Heed any deprecation notices in dev-server output.

## Commands

```bash
pnpm install
pnpm dev              # turbopack on PORT (default 3000; we use 3001 locally)
pnpm build            # production build
pnpm start            # serve the build
```

There's no test/lint runner. `pnpm build` is the truth check — it runs tsc + next build.

## Layout

```
src/
├── app/
│   ├── layout.tsx                       # root <html> — Geist fonts, zinc bg
│   ├── page.tsx                         # landing → sign-in/up
│   ├── sign-in/, sign-up/               # public auth pages
│   ├── forgot-password/, reset-password/ # password reset (email via Resend on api)
│   └── (app)/                           # auth-required group
│       ├── layout.tsx                   # nav + sign-out + redirect-if-not-authed
│       ├── dashboard/                   # sync trigger + recent-jobs table
│       ├── garmin/
│       │   ├── page.tsx                 # status of cn/global accounts + Connect button
│       │   └── connect/[region]/        # Garmin login: hosts gauth-widget
│       ├── subscription/                # current plan + redeem code form
│       └── admin/                       # role=admin only: codes, users, grant
└── lib/
    ├── auth-client.ts                   # createAuthClient + usernameClient plugin
    └── api.ts                           # fetch wrapper with credentials:'include'
```

All `(app)` pages are `'use client'`. `(app)/layout.tsx` calls `useSession()` and redirects to `/sign-in` while pending or unauthenticated.

## Garmin connect page is fragile — read before changing

`(app)/garmin/connect/[region]/page.tsx` injects Garmin's official `gauth-widget.js` script and listens for a JS event with the service ticket. The integration is sensitive:

- The `<script>` is appended to `document.body` once per mount (guarded by `initialized.current`). Hot reload re-runs the effect; the cleanup removes the tag but `window.GAUTH` may already be polluted — refresh the tab if you hit "GAUTH already initialized" type errors during dev.
- We run the widget in "Mode C" per the gauth-widget docstring (line 174-186): no `redirectAfterAccountLoginUrl` + `consumeServiceTicket: false`. In this mode the widget posts `{status:'SUCCESS', serviceTicket, serviceUrl}` back to the parent, and the SUCCESS / MESSAGE-POSTED events expose the ticket. We also keep a raw `window.addEventListener('message', ...)` as a fallback in case the widget's origin filter rejects the message (Garmin's signin template leaves `parent_url` empty server-side).
- Do **not** set `redirectAfterAccountLoginUrl: sso/embed`. That puts the iframe in an infinite `sso/embed?ticket=...` recursion: the embed.html page re-runs the widget, calls `checkAuthentication()`, and `document.location.href`s itself with the new ticket — never postMessaging the parent.
- Do **not** set GAUTH's `target` option. With it set, the widget runs `window.location.href = target + "?serviceTicket=..."` on success, navigating the parent page away before the callback POST can finish.
- Do **not** call `GAUTH.checkAuthentication()` from a non-Garmin origin. It does a cross-origin XHR to the SSO probe endpoint and always CORS-fails, just to surface noisy "Network error" events.
- `embedWidget` semantics are inverted from the name: `true` means `document.location.href = sso/signin?...` (full-page navigation away), `false` means `appendIFrame(...)` inline. Always use `false`.
- `MESSAGE-POSTED` also fires for non-ticket cases (`gauthInitHeight` for layout adjustment, `openLiteBox` for additional verification). Don't blindly treat any MESSAGE-POSTED as a ticket — check for `serviceTicket`.
- Once a ticket is captured, POST `{ ticket, serviceUrl }` to `${NEXT_PUBLIC_API_URL}/api/garmin/callback/:region`. `serviceUrl` is whatever Garmin returned alongside the ticket; the backend monkey-patches the lib's `login-url` to that URL because the lib hardcodes `sso/embed` and CAS rejects mismatches. The api server requires a BetterAuth session cookie — works because both domains share `garmin-trainer.uk`.
- Don't switch back to redirecting the browser to Garmin's portal SSO with `service=our_callback`. Garmin SSO refuses arbitrary external redirect URIs; the callback never fires. (We tried; it fails silently.)

## Auth client

`signIn.email({ email, password })` and `signIn.username({ username, password })` are both exposed via the `usernameClient()` plugin. Frontend routes by `@` presence in the input. Server's `username` plugin is configured to lowercase for uniqueness but allow Chinese characters in display.

## Env

```
NEXT_PUBLIC_API_URL=https://api.garmin-trainer.uk
```

`.env.local` is gitignored; `.env.example` is checked in. In Vercel, the same var is set on Production / Preview / Development envs. For preview deployments to talk to prod api, you'd need to add the preview URL to `CORS_ORIGINS` and `BETTER_AUTH_TRUSTED_ORIGINS` on the api side.

## Vercel project

- Project: `wzq/garmin-trainer-web` (personal scope; `vercel list_teams` returns empty)
- Domains: `garmin-trainer.uk` + `www.garmin-trainer.uk` are aliased per deploy
- Git: connected to `Or1gin-AI/garmin-trainer-web` (main → production). Push triggers auto-build.
- Manual deploy: `vercel deploy --prod --yes` from this dir.

## Don't

- Don't add `'use server'` actions that hit Garmin SSO from the server side — Garmin's anti-bot will block server-side IP, and the embed widget contract requires running in the user's browser anyway.
- Don't move `/garmin/connect/[region]` out of the `(app)` group — the auth gate must run before the widget loads, otherwise an unauthed visitor can submit a ticket that the api just rejects with 401.
- Don't add the "save Garmin password" form back without coordinating the api side (MFA flow, encrypted-creds storage). The api currently has no endpoints for this.
