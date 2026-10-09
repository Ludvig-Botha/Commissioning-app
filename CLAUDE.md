# Commissioning App — CLAUDE.md

Context file for Claude sessions. Read this first.

## What this is

An offline-first PWA for commissioning new **Europac coal-fired** boilers (John Thompson / ACTOM).
Single user: Ludvig. Built on the same patterns as the FSO app (`Ludvig-Botha/fso-app`).

- `index.html` — the whole app (UI + engine). Plain JS, no build step.
- `data.js` — the question bank: plant builder questions, sections and items, motors,
  nameplate fields, VSD parameter sets. **Adding content = editing data.js only.**
- `sw.js` — service worker (network-first for index.html + data.js, cache-first for the rest).
- `manifest.json`, `icons/`.

Full spec: Claude project doc `claude/commissioning-app-spec.md`.

## Flow

0. New job (details) → 1. Plant builder → 2. Pre-commissioning F27 → 3. Commissioning F63 →
4. Motors & VSDs → 5. Snag list F40 → 6. Handover F69 → Export (docx/xlsx + PDF).

The plant builder answers decide which sections, motors and VSD cards exist (`when(plant)`,
`motorsFor(plant)`). Multiple boilers = one checklist set per boiler.

## Hard rules

1. **Offline-first.** Nothing blocks on the network at capture time. Everything saves locally
   first (`touch(job)`), sync is queued and runs when online + signed in.
2. **Handover (F69) layout never changes.** Fill from commissioning data; anything not on the
   plant prints "N/A". Never remove rows.
3. **"+" options persist.** Anything added in the plant builder goes to `APP.library` and is
   offered on every future job.
4. **Pre-commissioning → snag list is optional**, never automatic.
5. **4–20 mA everywhere.** 0–20 mA is never used. CFW500 P253: 2 = 4–20 mA. P233 (input): 1 = 4–20 mA.
6. **No secrets in the repo.** The Azure Client ID is entered in Settings (public by design).

## Storage

- `APP` in localStorage (`commissioning_app_v1`): jobs, library, settings.
- Photo bytes in IndexedDB `commissioning-files` (JPEG, 1600 px, q 0.72). Metadata in `job.photos`.
- Keys: answers `"<boilerIdx>|<sectionKey>|<itemId>"`, motors `"<boilerIdx>|<motorId>"`.

## OneDrive (personal account)

- MSAL SPA + PKCE, authority `consumers`, scopes `Files.ReadWrite User.Read`.
- Re-uses the FSO app registration: add this app's Pages URL as an extra SPA redirect URI.
- Layout: `/Commissioning/<Contract> - <Customer>/job.json`, `Photos/<nn Section>/<name>.jpg`,
  `Exports/` (later). Root also holds `backup-latest.json` and `Backups/*.zip`.
- Photo name: `<Contract>_B<BoilerNo>_<Section>_<Item>_<nn>.jpg`.
- A job's folder id is stored in `job.od.folderId`, so renaming the customer never forks the folder.

## Releases

On every push: bump `APP_VERSION` in index.html, bump `CACHE_NAME` in sw.js, add a CHANGELOG entry.
Hosting: GitHub Pages from `main` (repo is public).

## Status (v0.1.0)

Built: shell, settings, OneDrive sync, backups, updates, new job, plant builder, dashboard,
ID fan section (test slice), all motors with nameplate cards, all VSD parameter sets, snag list.
Next: remaining F63 sections, F27 pre-commissioning, F69 handover with signatures, exports
filled from the original Word/Excel templates.
