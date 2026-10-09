# Changelog

## v0.1.0 — 2026-10-09
First test build.

- App shell from the FSO app pattern: offline storage, IndexedDB photos, OneDrive sync,
  backup to OneDrive (zip with photos) and to file, update check and update banner, bug log.
- New job (F63 header details, boiler and stoker numbers).
- Plant builder with "+ Add" on equipment lists; added options are kept for future jobs.
- Job dashboard: phase tiles, sections filtered to the plant, per-boiler tabs.
- ID fan section (test slice): OK / Snag / N/A, as found, action taken, comment, photos.
- Motors & VSDs: nameplate card (photo + data) for every motor on the plant; nameplate
  values fill the VSD motor parameters.
- VSD parameter sets: Yaskawa GA700/GA500 (TD102 tables 1, 3, 4, 5, 7, 8, 9) and
  WEG CFW11/CFW500 (F63 BCP 16.30 / 16.40). Tick to confirm, type the actual value
  if different (flagged red). Yaskawa auto-tune and DriveWizard backup checks.
- Snag list (F40 columns) built from items marked Snag, plus manual snags with photos.

### Corrections to the F63 source data
- CFW11 P100/P101 units corrected from rpm to s.
- "P101 – Acceleration" corrected to Deceleration (stoker, overfire, coal screw).
- Overfire fan 6b corrected to RHS.
- CFW500 P253 set to 2 = 4–20 mA everywhere (1 = 0–20 mA, never used).
- RC and BPA fans removed (not used). K-Tek removed (LP21 only).
