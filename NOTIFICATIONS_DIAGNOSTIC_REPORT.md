# ArmPal Notifications — Full End-to-End Diagnostic Report

**Generated:** 2025-02-28  
**Scope:** All notification-related code (web push, in-app, realtime, edge functions, DB, client) across `armpal`, `armpal-ai`, and `ARMPALAPP`.

---

## SECTION 1 — Inventory (Everything That Exists)

### 1.1 Client (armpal — main app)

| File | Purpose | Events / data |
|------|---------|----------------|
| `armpal/public/push-sw.js` | Push-only service worker; does not control the app. Scope `/push/`. | Listens: `push`, `notificationclick`. Expects payload `{ title, body, link }`. Shows notification; on click focuses/navigates to `link` or opens window. |
| `armpal/src/lib/push.js` | Request permission, register `/push-sw.js`, subscribe with VAPID, upsert to `push_subscriptions`. | Uses `VITE_VAPID_PUBLIC_KEY` or hardcoded fallback. Upserts `{ user_id, endpoint, keys }` with `subscription.toJSON()` (keys = `{ p256dh, auth }`). |
| `armpal/src/hooks/useNotifications.js` | On load (when SW controller exists), registers push SW, requests permission, subscribes, upserts to `push_subscriptions`. | Same VAPID as push.js. Registers `/push-sw.js` scope `/push/`. Waits for `navigator.serviceWorker.controller` or `controllerchange`. |
| `armpal/src/utils/pushNotifications.js` | **DEAD CODE** — not imported anywhere. | Would upsert `{ user_id, endpoint, p256dh, auth }` — **wrong schema** (table has `keys` jsonb, not columns `p256dh`, `auth`). |
| `armpal/src/pages/ChatPage.jsx` | On DM send (text/image/video/voice), calls `firePush(receiverId, text)`. | `firePush`: POST to `https://ewlwkasjtwsfemqnkrkp.supabase.co/functions/v1/send-push` with body `{ user_id, title, body, link }` and header `x-push-secret: armpal_push_secret_12345`. No auth header. |
| `armpal/src/components/notifications/NotificationsBell.jsx` | In-app notification UI: fetch notifications, realtime subscribe, mark read, admin post global. | Selects `notifications` with `user_id.is.null,user_id.eq.${user.id}`. Realtime: `postgres_changes` INSERT on `notifications` filter `user_id=eq.${user.id}`. Inserts to `notification_reads`. Post global uses `supabase.from("notifications").insert({ user_id: null, title, body, link })` — **only works for admin/official** (RLS). |
| `armpal/src/hooks/useProfileReactions.js` | On profile reaction, inserts a row into `notifications` for the profile owner. | `supabase.from("notifications").insert({ user_id: profileUserId, title, body, link })` — **blocked by RLS** (only `is_admin_or_official()` can insert). |
| `armpal/src/settings/SettingsOverlay.jsx` | "Enable notifications" calls `enablePush(user.id)` from `../lib/push`. | User-triggered registration. |
| `armpal/src/pages/EnableNotifications.jsx` | Dedicated page calls `enablePush(user.id)`. | Same. |
| `armpal/src/App.jsx` | Renders `NotificationsBell` on `/`, runs `useNotifications(session?.user?.id)`. | Auto bootstrap push registration + in-app bell. |

### 1.2 Server / Supabase (armpal)

| File | Purpose | Events / data |
|------|---------|----------------|
| `armpal/supabase/functions/send-push/index.ts` | Edge function: (1) Realtime listener on `notifications` INSERT → send Web Push; (2) HTTP POST fallback to send push by payload. | Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Fetches `push_subscriptions` by `user_id`, sends via `web-push`. Payload: `{ title, body, link }`. **Does not check `x-push-secret`.** CORS: localhost:5173, localhost:3000, www.armpal.net, armpal.net. |
| `armpal/supabase/migrations/20260224020000_platform_reports_roles_notifications_unpublish.sql` | Creates `notifications`, `notification_reads`, RLS, `is_admin_or_official()`. | `notifications`: id, user_id, title, body, link, created_at. INSERT policy: **only** `is_admin_or_official()` (profile.role IN ('admin','official')). SELECT: auth user can read global (user_id null) or own. |
| `armpal/supabase/migrations/20260226000000_push_subscriptions_and_webhook.sql` | Creates `push_subscriptions`, RLS, adds `notifications` to realtime publication. | `push_subscriptions`: id, user_id, endpoint, keys (jsonb), created_at. UNIQUE (user_id, endpoint). RLS: user own + service_role. |
| `armpal/supabase/migrations/20260226100000_drop_push_trigger.sql` | Removes legacy trigger on notifications. | Push is now only via edge Realtime + HTTP, not pg trigger. |

### 1.3 armpal-ai and ARMPALAPP (alternate codebases)

| File | Purpose | Events / data |
|------|---------|----------------|
| `armpal-ai/public/sw.js` | Generic push SW (no scope restriction). | Handles `push` / `notificationclick`; opens `/` on click. |
| `armpal-ai/src/onesignal.ts` | OneSignal init and permission. | App ID hardcoded. Used by App.jsx `initOneSignal()`. |
| `armpal-ai/src/hooks/useNotifications.js` | Registers `/sw.js`, requests permission, subscribes with **hardcoded VAPID**, **never stores subscription** (TODO comment). | VAPID different from main app. No Supabase upsert. |
| `armpal-ai/src/utils/push.js` | `registerForPush()`: permission, `serviceWorker.ready`, subscribe, upsert. | **Wrong schema**: upserts `endpoint, p256dh, auth` as columns — table has `keys` jsonb. Would fail or be ignored. |
| `armpal-ai/supabase/functions/send-push/index.ts` | **OneSignal** sender, not Web Push. | Expects `ONESIGNAL_REST_API_KEY`. Sends to OneSignal API by `user_id` as external_user_id. |
| `ARMPALAPP/*` | Same pattern as armpal-ai: OneSignal, `sw.js`, broken push.js schema, send-push uses OneSignal. | Same issues. |
| `armpal/api/stripe-webhook.js` | Stripe webhook: checkout.session.completed, invoice.paid. | **Does not create or send any notification.** Only updates `profiles` (is_pro, stripe_customer_id, referral points). |

### 1.4 Config / deployment

| File | Relevance |
|------|------------|
| `armpal/vercel.json` | `routes`: api → api, then filesystem, then `/*` → index.html. Static assets (e.g. `dist/push-sw.js`) served from filesystem if present. |
| `armpal-ai/vercel.json`, `ARMPALAPP/vercel.json` | Same pattern. No explicit headers for SW or cache. |

---

## SECTION 2 — Current Flow Map

### A) Push notification flow (browser/device) — main armpal only

1. **Registration**
   - User opens app → `App.jsx` runs `useNotifications(userId)`.
   - After load (and when `navigator.serviceWorker.controller` exists), hook registers `/push-sw.js` with scope `/push/`, requests `Notification.requestPermission()`, subscribes with VAPID, then upserts `{ user_id, endpoint, keys }` to `push_subscriptions` (via anon/authenticated client; RLS allows own row).
   - Alternatively user enables via Settings or `/enable-notifications` → `enablePush(userId)` in `lib/push.js` (same steps).

2. **Sending (chat DM)**
   - User A sends DM to User B → `ChatPage` inserts into `messages`, then calls `firePush(friendId, payload)`.
   - `firePush` POSTs to `https://ewlwkasjtwsfemqnkrkp.supabase.co/functions/v1/send-push` with `{ user_id, title, body, link }`. No Supabase auth; `x-push-secret` sent but **not validated** by edge function.
   - Edge function `send-push`: POST handler reads body, calls `handleNotification(record)`, which loads `push_subscriptions` for `user_id` (service role), then `webpush.sendNotification(endpoint, keys, payload)` for each subscription. Payload is `{ title, body, link }`.

3. **Sending (DB path — notifications table)**
   - Intended: insert into `notifications` → Realtime fires → edge function’s Realtime listener runs → `handleNotification(row)` → same webpush send.
   - In practice: **only** admin/official can insert (RLS). Profile reactions call `notifications.insert` as normal user → **RLS blocks** → no insert → no realtime → no push.

4. **Device**
   - Browser delivers push to the SW that registered the subscription. That SW is the one registered from `/push-sw.js` with scope `/push/`. So the push is delivered to `push-sw.js`, which shows the notification and handles click (focus/navigate to `link`).

### B) In-app notification flow (DB → UI)

1. **Source**
   - Rows in `notifications` (global: `user_id` null; user-specific: `user_id` set). Only way they get in today: admin/official via NotificationsBell “Post global” (or future backend).

2. **Read**
   - `NotificationsBell` loads list: `.from("notifications").or("user_id.is.null,user_id.eq.${user.id}")` (allowed by RLS). Loads `notification_reads` for current user and merges to show unread count and list.

3. **Realtime**
   - Same component subscribes to `postgres_changes` on `notifications` with filter `user_id=eq.${user.id}`. On INSERT it calls `refresh()` so the list updates without reload.

4. **Mark read**
   - User clicks item (or “mark all”) → upsert into `notification_reads` (RLS allows own insert).

### C) Realtime flow

- **notifications table:** In publication `supabase_realtime`. Used by:
  - **Client:** NotificationsBell (`postgres_changes`, filter by user_id).
  - **Edge:** send-push function subscribes to INSERT on `notifications` (no filter) and calls `handleNotification` for each new row (skips when `user_id` null).
- **Other:** group_messages, arena, etc. are separate; no notification-specific logic.

### D) Email / SMS flow

- **None.** No email or SMS sending code found. Reset password uses Supabase Auth `resetPasswordForEmail` (Supabase’s own email).

---

## SECTION 3 — Config Matrix

| Item | Main armpal | armpal-ai / ARMPALAPP |
|------|-------------|------------------------|
| **VAPID keys** | Client: `VITE_VAPID_PUBLIC_KEY` or hardcoded in `lib/push.js` / `useNotifications.js`. Edge: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (env in Supabase). | Different hardcoded VAPID in useNotifications; push.js uses another. Edge uses OneSignal, not VAPID. |
| **Service worker path** | `/push-sw.js` (from `public/` → root of dist). | `/sw.js`. |
| **SW scope** | `/push/` (so SW does not control main app). | Default (/) — can conflict with main app SW if any. |
| **Permission** | After SW registered; in useNotifications after controller ready; in enablePush before register. | On load in useNotifications; before subscribe. |
| **Subscription storage** | `push_subscriptions`: `user_id`, `endpoint`, `keys` (jsonb from `subscription.toJSON().keys`). Conflict: `user_id,endpoint`. | useNotifications: **not stored** (TODO). push.js: wrong columns (p256dh, auth) — schema mismatch. |
| **Backend send** | Supabase Edge `send-push`: Web Push via `web-push`; reads from `push_subscriptions`. | Supabase Edge `send-push`: OneSignal API by external_user_id. No use of `push_subscriptions`. |
| **Provider** | Web Push (VAPID). | OneSignal (REST API). |
| **Env vars (client)** | `VITE_VAPID_PUBLIC_KEY` (optional; fallback in code). | OneSignal app ID in code; no env. |
| **Env vars (edge)** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. | OneSignal: `ONESIGNAL_REST_API_KEY`. |
| **Vercel** | No special headers for SW; filesystem serves static files. | Same. |
| **Supabase notifications table** | Exists. RLS: SELECT own or global; INSERT **only** admin/official. | Same DB if shared; same RLS. |
| **Supabase push_subscriptions** | Used by main app + send-push (Web Push). | Not used by armpal-ai/ARMPALAPP send-push (OneSignal). |
| **Realtime** | `notifications` in publication; client + edge use it. | Same if same project. |
| **iOS PWA** | Not implemented. Web Push on iOS Safari PWA has specific constraints (Add to Home Screen, permission, etc.); no special handling in repo. | Same. |

---

## SECTION 4 — Contradictions / Breakpoints

1. **RLS blocks profile reaction notifications**  
   - **Where:** `useProfileReactions.js` lines 144–148: `supabase.from("notifications").insert({ user_id, title, body, link })`.  
   - **Policy:** `Notifications insert admin/official` (WITH CHECK (is_admin_or_official())).  
   - **Result:** Insert fails for normal users; no row → no realtime → no push. Reaction is saved; notification never is.

2. **Chat push endpoint is unauthenticated and secret unused**  
   - **Where:** `ChatPage.jsx` lines 368–382: POST to `send-push` with `x-push-secret: armpal_push_secret_12345`.  
   - **Edge:** `send-push/index.ts` POST handler does not read or validate `x-push-secret`.  
   - **Result:** Anyone who knows the edge URL can send a push to any `user_id`; secret is not used.

3. **Hardcoded Supabase URL in ChatPage**  
   - **Where:** `ChatPage.jsx` line 370: `https://ewlwkasjtwsfemqnkrkp.supabase.co/functions/v1/send-push`.  
   - **Result:** Different Supabase project or custom URL cannot be used without code change; should use env (e.g. `SUPABASE_URL` or `VITE_SUPABASE_URL`) and append `/functions/v1/send-push`.

4. **armpal-ai / ARMPALAPP: subscription never stored**  
   - **Where:** `armpal-ai/src/hooks/useNotifications.js` line 39: `// TODO: Later we send "subscription" to Supabase to store it per user.`  
   - **Result:** Push is subscribed in browser but never saved; OneSignal path uses external_user_id, so if they mix Web Push and OneSignal, Web Push side will never have subscriptions.

5. **armpal-ai / ARMPALAPP: push.js and pushNotifications.js wrong schema**  
   - **Where:** `armpal-ai/src/utils/push.js` and `ARMPALAPP/src/utils/push.js`: upsert `{ user_id, endpoint, p256dh, auth }`.  
   - **Table:** `push_subscriptions` has `keys` jsonb, not columns `p256dh`, `auth`.  
   - **Result:** Upsert would fail (unknown columns) or ignore those fields; subscription not stored correctly even if called.

6. **Two different push systems in repo**  
   - Main armpal: Web Push (VAPID) + `push_subscriptions` + `send-push` (web-push).  
   - armpal-ai/ARMPALAPP: OneSignal + `send-push` (OneSignal API), plus broken Web Push client code.  
   - **Result:** Confusion; deploying “armpal-ai” or “ARMPALAPP” with shared Supabase will not send Web Push from DB path; OneSignal needs separate setup and external_user_id set.

7. **Dead code: pushNotifications.js**  
   - **Where:** `armpal/src/utils/pushNotifications.js` — wrong schema (p256dh, auth as columns).  
   - **Result:** Not imported anywhere; dead. If ever used, would break.

8. **VAPID key consistency**  
   - Client uses `VITE_VAPID_PUBLIC_KEY` or hardcoded key. Edge uses env `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. If these don’t match the same key pair, push will fail at send.

9. **Realtime from edge function**  
   - Edge subscribes with service role to `postgres_changes` on `notifications`. Supabase Realtime from server/edge is supported; if the project has Realtime disabled or the table not in the publication, listener would never fire (no second path besides HTTP).

10. **No Stripe → notification**  
    - Stripe webhook updates profiles only; no insert into `notifications` and no call to send-push. So “Pro purchased” or similar is not pushed or in-app unless you add it.

---

## SECTION 5 — Missing External Setup

- **Supabase (main armpal)**  
  - Edge function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (optional).  
  - Ensure Realtime is enabled for the project and `notifications` is in the Realtime publication (migration does this).

- **Vercel (or host)**  
  - Build must include `public/push-sw.js` at root (e.g. `dist/push-sw.js`).  
  - Optional: `VITE_VAPID_PUBLIC_KEY` so the same key pair is used as in the edge function.

- **Main app**  
  - No Apple/Google/FCM/APNs setup in repo; Web Push only.  
  - iOS: Web Push for PWA requires Add to Home Screen and proper permission flow; no special code in repo.

- **armpal-ai / ARMPALAPP (if using OneSignal)**  
  - OneSignal dashboard: app, REST API key.  
  - Env for edge: `ONESIGNAL_REST_API_KEY`.  
  - Client must set external_user_id to `user_id` (or equivalent) for the backend to target the right user; not seen in the code searched.

- **Chat push**  
  - No auth or secret check; if you want to restrict who can call send-push, add validation (e.g. secret or Supabase JWT) in the edge function.

---

## SECTION 6 — Minimal Fix Plan (Main armpal — “make it work”)

1. **Allow app-generated user notifications (e.g. profile reactions)**  
   - **Option A (recommended):** Add an RLS policy so authenticated users can insert into `notifications` only when `user_id` is set and equals the target user (e.g. “recipient” only), and optionally restrict to certain `title`/types (e.g. “reaction”) to avoid abuse.  
   - **Option B:** Use a small Edge function or backend that uses the service role to insert the notification row (client calls the function with recipient user_id and payload; function validates sender and inserts).

2. **Secure send-push HTTP endpoint**  
   - In `armpal/supabase/functions/send-push/index.ts` POST handler: read `x-push-secret` (or Authorization) and compare to a secret from env (e.g. `PUSH_SECRET`). Reject 401 if missing or wrong.  
   - Set `PUSH_SECRET` in Supabase edge secrets and use the same value in the client (from env, e.g. `VITE_PUSH_SECRET`), or use Supabase anon key + RLS if you move to a “create notification” API instead of direct push.

3. **Use env for send-push URL**  
   - In `armpal/src/pages/ChatPage.jsx`: replace hardcoded Supabase URL with `import.meta.env.VITE_SUPABASE_URL` (or existing Supabase client base URL) + `/functions/v1/send-push`. Ensure build has the correct env on Vercel.

4. **Confirm VAPID pair**  
   - Generate one VAPID pair. Set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in Supabase Edge secrets. Set `VITE_VAPID_PUBLIC_KEY` in Vercel (and optionally in .env.local) so the client uses the same public key. Remove or override hardcoded fallbacks in `lib/push.js` and `useNotifications.js` in production so there’s a single source of truth.

5. **Verify push_subscriptions and Realtime**  
   - In Supabase: confirm table `push_subscriptions` exists and RLS allows users to insert/update own row. Confirm `notifications` is in the Realtime publication.  
   - After a user enables notifications, check `push_subscriptions` has a row for that user. After an admin posts a user notification (or after fixing reaction insert), check edge logs to see that Realtime fired and `handleNotification` ran.

6. **Optional: Stripe → notification**  
   - In `armpal/api/stripe-webhook.js`, after successful profile update for Pro, insert a row into `notifications` (user_id = upgraded user, title/body/link as desired). Use Supabase service role client. That will trigger the existing Realtime → send-push flow.

---

## SECTION 7 — Test Protocol

### Local (dev)

1. **Env**  
   - `.env.local`: `VITE_VAPID_PUBLIC_KEY`, `VITE_SUPABASE_URL` (and any existing Supabase/Vite vars).  
   - Supabase local or linked project: edge secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

2. **Registration**  
   - Run app (e.g. npm run dev). Log in. Open DevTools → Application → Service Workers: confirm `/push-sw.js` is registered with scope `/push/`.  
   - Enable notifications (Settings or /enable-notifications). In Application → Storage (or Network), confirm a request to Supabase that upserts into `push_subscriptions`. In Supabase Table Editor, confirm one row for your user with `endpoint` and `keys` populated.

3. **Send path (HTTP)**  
   - In Console or a small test script:  
     `fetch('https://<SUPABASE_URL>/functions/v1/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: '<your-user-uuid>', title: 'Test', body: 'Hello', link: '/' }) })`  
   - You should get 200 and a push on the same browser (or another device logged in as that user with push enabled).

4. **Send path (DB + Realtime)**  
   - As admin/official: open NotificationsBell, post a “global” or user-specific notification.  
   - As normal user (after RLS fix): trigger a profile reaction; confirm `notifications` has a new row and push is received.  
   - In Supabase Dashboard → Edge Function logs, confirm Realtime INSERT and “Push result” logs.

5. **Chat**  
   - Two accounts (A and B). Enable push for B. From A, send a DM to B. Confirm B receives a push (and that send-push was called; e.g. Network tab).

### Deployed (Vercel)

1. **Build**  
   - Confirm `dist/push-sw.js` exists in build output (from `public/push-sw.js`).

2. **Env**  
   - Vercel: `VITE_VAPID_PUBLIC_KEY`, `VITE_SUPABASE_URL` (and `VITE_PUSH_SECRET` if you add secret check).  
   - Supabase project (prod): same edge secrets as above.

3. **HTTPS**  
   - Test on production HTTPS origin. Enable notifications and repeat registration + send tests. Check that push is received and click opens the correct `link`.

### Verification checklist

- [ ] Subscription exists: `SELECT * FROM push_subscriptions WHERE user_id = '<id>';`  
- [ ] Send path works: POST to send-push returns 200 and device receives notification.  
- [ ] Device receives: notification appears and click navigates to `link`.  
- [ ] Realtime path: insert into `notifications` (as allowed by RLS) and confirm push and edge logs.

### Logging to add

- **Edge `send-push/index.ts`:**  
  - In Realtime INSERT callback: already logs `Realtime INSERT on notifications` and `Push result`.  
  - In POST handler: log `user_id` and `result.sent` (and optionally `result.reason` when sent === 0).  
- **Client:**  
  - In `lib/push.js` or `useNotifications.js` after upsert: log success/failure (e.g. “Push registered” / “Push registration failed: …”).  
  - In `firePush`: log when fetch fails (e.g. response status and body) instead of silent `.catch(() => {})`.

---

## Summary Table

| Component | Status | Action |
|-----------|--------|--------|
| push-sw.js (main) | OK | Ensure served at /push-sw.js in prod. |
| lib/push.js + useNotifications (main) | OK | Prefer env VAPID; add logging. |
| push_subscriptions schema | OK | — |
| send-push edge (main) | OK | Add secret check; use env URL in client. |
| Chat firePush | Unauthenticated | Add secret or auth; use env for URL. |
| notifications INSERT RLS | Blocks reactions | Add policy or backend insert for user notifications. |
| useProfileReactions insert | Fails (RLS) | Fix as above. |
| armpal-ai/ARMPALAPP push | Mixed/broken | Choose OneSignal or Web Push; fix subscription storage and send path. |
| pushNotifications.js (main) | Dead / wrong schema | Remove or fix and use single registration path. |
| Stripe webhook | No notification | Optional: insert notification on success. |

---

*End of report.*
