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

`(app)/garmin/connect/[region]/page.tsx` constructs the Garmin SSO iframe URL by hand and listens for `postMessage` from `sso.garmin.{cn,com}`. **We deliberately do NOT load `gauth-widget.js`.** It's fragile and forces wrong defaults; the page does its job (signin template + casEmbedSuccess.html postMessage flow) when called with the right URL params, and that's all we need.

The exact iframe URL we use:

```
https://sso.garmin.{cn,com}/sso/signin
  ?clientId=GarminConnect
  &consumeServiceTicket=false
  &locale={zh_CN|en_US}
  &embedWidget=false
  &service=https://sso.garmin.{cn,com}/sso/embed
  &source=<parent URL>
```

Each parameter is load-bearing. **Empirically verified end-to-end with a valid CN account.** Reasoning:

- `service=sso.garmin.{cn,com}/sso/embed`: Garmin's CAS whitelist rejects non-Garmin service URLs. `sso/embed` is whitelisted. Bonus: `@gooin/garmin-connect`'s `getOauth1Token` hardcodes `login-url=GARMIN_SSO_EMBED`, so the ticket is bound to the same URL the lib presents to the OAuth1 exchange — no monkey-patch required.
- `consumeServiceTicket=false`: this is the switch in `casEmbedSuccess.html` between "send `{status:SUCCESS, serviceTicket, serviceUrl}` to parent (no nav)" and "consume the ticket via JSONP". We need the ticket on our side, so `false`.
- **No `redirectAfterAccountLoginUrl` / `redirectAfterAccountCreationUrl`**: when EITHER is set, `casEmbedSuccess.html` runs `top.location.href = response_url`, navigating our parent page to `sso.garmin.{cn,com}/sso/embed?ticket=...`. The flow is dead at that point — that's what we kept seeing in production.
- `source=<parent URL>`: server uses this to set `parent_url` in the rendered templates so `XD.postMessage` targets us correctly.
- `embedWidget=false`: name is inverted — `false` means inline iframe, `true` means `document.location.href` (full-page nav). Counterintuitive but verified in `gauth-widget.js` line 598-611.
- `clientId=GarminConnect`: the only clientId the upstream has been observed to use.

Listener: a single `window.addEventListener('message', ...)` filters by `event.origin === ssoOrigin`, parses `event.data` as JSON if it's a string, then dispatches:
- `gauthInitHeight` / `gauthHeight` → resize iframe
- `openLiteBox` → reCaptcha lightbox warning
- `status === 'SUCCESS' && serviceTicket` → POST `{ticket, serviceUrl}` to `/api/garmin/callback/:region`
- `status === 'FAIL' / 'ACCOUNT_LOCKED' / 'ACCOUNT_DISABLED'` → user-facing error

Backend (`api/src/garmin/client.ts`) accepts `serviceUrl` and shadows `client.client.url.GARMIN_SSO_EMBED` for the lib's `getOauth1Token` call. With our current config the override is a no-op (serviceUrl already equals sso/embed), but the plumbing stays in case Garmin ever switches what URL the ticket gets bound to.

### Don't

- Don't reintroduce `gauth-widget.js`. Its `loadGAuth` defaults `service` to the parent URL when `redirectAfterAccountLoginUrl` is unset → CAS rejects → "发生意外错误". And setting `redirectAfter*` triggers `casEmbedSuccess.html`'s `top.location.href` parent-window navigation → flow is dead.
- Don't set `target` in any equivalent config. The widget's `target` and the success page's `redirectAfter*` both navigate the parent away.
- Don't change `service=sso/embed` without also patching `@gooin/garmin-connect`'s `login-url`. CAS service binding must match what the OAuth1 exchange presents.
- Don't switch to redirecting the browser to Garmin's portal SSO with `service=garmin-trainer.uk/...`. Garmin SSO refuses arbitrary external redirect URIs; tested, fails silently.
- Don't add the "save Garmin password" form back without coordinating the api side (MFA flow, encrypted-creds storage). The api currently has no endpoints for this.

## Training routes / SSE consumer pattern

The training UI lives under `(app)/training/`. The full plan-generation pipeline streams via SSE — `fetch` (not `EventSource`, because we need `credentials:'include'` for the BetterAuth cookie):

- `POST /api/training/plans` (create) → emits `plan_created`, `context`, `schedule`, `workout`, `violations`, `summary_delta`, `monitoring`, `adjustment_rules`, `done|error`
- `POST /api/training/plans/:id/regenerate-day` → emits `workout`, `violations`, `done|error`
- `POST /api/training/plans/:id/chat` → emits `user_message_saved`, `text_delta`, `tool_call`, `workout_updated`, `assistant_message_saved`, `done|error`

URLs are pre-built constants in `lib/api.ts`: `trainingPlanStreamUrl`, `trainingDayRegenerateUrl(planId)`, `trainingChatStreamUrl(planId)`.

Consumer pattern: `await fetch(url, { method:'POST', credentials:'include', body: JSON.stringify(...) })`, then read `res.body!.getReader()` and parse `data: …\n\n` events line by line. Plan-generation errors return JSON (e.g. `402 quota_exceeded`) BEFORE the SSE stream opens — check `res.headers.get('content-type')`. `requireProAndQuota` gates the three endpoints above; quota is consumed only on success (after the `done` event), so failed turns don't burn the user's monthly budget.

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

- Don't add `'use server'` actions that hit Garmin SSO from the server side — Garmin's anti-bot will block server-side IP (the iframe load requires real browser headers/Referer), and the SSO postMessage contract requires running in the user's browser anyway.
- Don't move `/garmin/connect/[region]` out of the `(app)` group — the auth gate must run before the iframe loads, otherwise an unauthed visitor can submit a ticket that the api just rejects with 401.
