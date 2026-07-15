# Publish Manager: background "your resource is live" notifications

## Goal

Let a user know their `PUBLISH_QDN_RESOURCE` transaction actually confirmed on
chain, even if they've closed the Publish Manager tab, by registering a
durable Home-side subscription against `RESOURCE_PUBLISHED` for their own
registered name.

## Background

Qortium Home ships `NOTIFICATION_ADD` / `NOTIFICATION_GET` / `NOTIFICATION_REMOVE`
/ `NOTIFICATION_HAS_PERMISSION` (see `qortium-home/upstream/docs/APP_NOTIFICATIONS.md`).
An app registers rules (event + filters + presentational title/text/link);
Home keeps one websocket to Core's `/websockets/notifications` and fires a
system notification when a pushed event matches a rule, gated by a durable
per-app permission grant, the global notification switch, mute, rate limit,
and focused-tab suppression.

Two constraints from reading `qortium-home/upstream/electron/notification-rules.ts`
and `notification-watcher.ts` shape this design:

- `filters.names` (plural, array) is the actual field for name-matching on
  `RESOURCE_PUBLISHED` — not `name`.
- `rule.title` / `rule.text` / `rule.link` are fixed at registration time.
  Home has no per-event substitution for `RESOURCE_PUBLISHED` (its default
  body generator returns `undefined` for that event, and the click handler
  always opens the static `rule.link`). A single persistent rule scoped to
  "your name" therefore cannot show the specific resource's title or deep-link
  to that specific resource per publish — confirmed with the user, who chose
  static text + a link that opens Publish Manager itself (where the new
  resource will be visible) over a materially more complex per-publish
  one-off-rule design.

## Feature detection

`SHOW_ACTIONS` is checked once on load (same pattern as `RatingControl.tsx`'s
`RATE_RESOURCE` check). If `NOTIFICATION_ADD` isn't in the list, the feature is
inert: no bell icon, no registration attempts, no `NOTIFICATION_*` calls.

## State

- `notificationsEnabledAtom` — `atomWithStorage('publish-own-notifications-enabled', true)`
  in `src/state/atoms.ts`. Persisted local on/off toggle, independent of Home's
  global "App notifications" switch. Defaults on.
- `notificationsSupportedAtom` — plain `atom<boolean>(false)`, set once after
  the `SHOW_ACTIONS` check.

## Registration flow

A new hook, `useOwnPublishNotifications`, invoked once from `App.tsx` next to
the existing account-fetch effects (no new `SELECTED_ACCOUNT_CHANGED` listener
needed — it reacts to the existing `accountAtom`, which that listener already
keeps current):

1. On mount: `SHOW_ACTIONS` → set `notificationsSupportedAtom`.
2. Effect keyed on `[supported, enabled, account?.name]`:
   - Not supported → no-op.
   - Disabled, or no registered name → `NOTIFICATION_REMOVE` (no ids = remove
     all of this app's rules; idempotent no-op if nothing is registered).
   - Enabled and a name exists → `NOTIFICATION_GET`; if a rule with id
     `own-resource-published` already exists with `filters.names` equal to
     `[account.name]`, skip. Otherwise `NOTIFICATION_ADD` with exactly one
     subscription (this call replaces the app's whole rule set, which is fine
     since this app only ever wants one rule):

     ```ts
     {
       notificationId: 'own-resource-published',
       event: 'RESOURCE_PUBLISHED',
       filters: { names: [account.name] },
       title: 'Your resource is now live',
     }
     ```

     `text` and `link` are omitted deliberately (see Background).

All bridge calls are wrapped in `try/catch` → swallow, matching how
`useQdnLists` and `TopBar`'s existing follow-list sync already treat
non-critical background sync failures. A denied permission or a mid-flight
account switch (Home rejects `NOTIFICATION_ADD` if the active account changed
during approval) both just fail silently; the effect re-runs on the next
relevant state change anyway.

## UI

A bell `IconButton` in `TopBar.tsx`, next to the existing follow/help/theme
icons, rendered only when `notificationsSupportedAtom` is true. Toggles
`notificationsEnabledAtom`. Icon/tooltip reflect on/off state
(`NotificationsActiveIcon` / `NotificationsOffIcon`, "Notify me when my
publishes go live" / "Notifications off").

## Bug fix: My Uploads sort order

While reviewing this, confirmed from `qortium-core`'s
`HSQLDBArbitraryRepository.getArbitraryResources` that the name-filtered query
path (used whenever `LIST_QDN_RESOURCES` is called with a specific `name`, as
`MyUploadsPage` always does) orders by `ORDER BY name [DESC]` — never by
`created_when`. Passing `reverse: true` was never sorting a single name's
resources by recency. Fix: sort client-side by `created` descending in
`MyUploadsPage`'s `load()`, so newly published resources appear at the top —
this also makes the new notification's static link (which opens Publish
Manager landing on My Uploads) actually useful.

## Files touched

- `src/state/atoms.ts` — two new atoms.
- `src/api/qortal.ts` — `supportsNotifications`, `getNotificationRules`,
  `addNotificationRule`, `removeNotificationRules`.
- `src/hooks/useOwnPublishNotifications.ts` — new hook.
- `src/App.tsx` — call the new hook.
- `src/components/layout/TopBar.tsx` — bell icon.
- `src/pages/MyUploadsPage.tsx` — sort by `created` descending in `load()`.

## Verification

- `npm run build` / `tsc --noEmit` clean.
- Manual: publish a resource → confirm exactly one `NOTIFICATION_ADD` call
  (via a temporary console log or Home's own rule inspector), republish →
  no duplicate `NOTIFICATION_ADD` call, switch the active account → rule
  re-registers under the new name, toggle the bell off → `NOTIFICATION_REMOVE`
  fires and the rule disappears, toggle back on → re-registers.
- My Uploads: publish two resources back-to-back, confirm the most recent one
  renders first regardless of `name`'s alphabetical position.

## Out of scope

- Generic "watch any resource" subscriptions.
- Any change to `qortium-core` or `qortium-home`.
- Per-publish dynamic notification title/link (see Background).
