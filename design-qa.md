# Design QA

- Source visual truth: `C:\Users\xian\.codex\generated_images\019e8e1c-a61e-79f0-b7c0-775d86c0c0de\ig_022a9864664e1f57016a2ac55f95ac819185ed9ad5b392147f.png`
- Implementation screenshots:
  - `C:\Users\xian\AppData\Local\Temp\nju-login-qa.png`
  - `C:\Users\xian\AppData\Local\Temp\nju-schedule-qa.png`
  - `C:\Users\xian\AppData\Local\Temp\nju-map-qa.png`
- Full-view comparison: `design-qa-comparison.png`
- Viewport: 1280 x 720
- States: visitor login, authenticated map, authenticated schedule with demo data

## Findings

No actionable P0, P1, or P2 findings remain.

- Typography: Chinese serif display headings and larger product text reproduce the selected academic ceremonial direction. Body and control text remain readable.
- Spacing and layout: login, map console, and schedule timeline use stable grids with no detected horizontal overflow.
- Colors and tokens: ivory, NJU purple, restrained vermillion, and semantic green are consistently applied.
- Image quality: the formal campus map remains the real project map asset rather than a fabricated illustration.
- Copy and content: all new visible product copy is Chinese; login, guest access, demo schedule, and departure reminders are explicit.
- Interaction: guest schedule access redirects to login; login redirects to the map; authenticated navigation, demo schedules, and add-schedule dialog were verified.

## Focused Review

- Login card: labels, tabs, status area, and primary action have clear hierarchy and focus treatment.
- Schedule timeline: time, route, suggested departure, status, and walking estimate are visually distinct.
- Map workspace: route planning remains the main interaction and the actual map remains the primary visual asset.

## Follow-up Polish

- P3: At the initial full-campus zoom, 122 place markers are visually dense. A future marker-clustering or zoom-level visibility rule would improve first-glance clarity.

## Patches Made

- Split login, map, and schedule into independent pages.
- Increased typography scale and introduced the selected academic ceremonial visual tokens.
- Added backend demo-schedule initialization and frontend/backend separate start scripts.
- Added responsive layout rules and authenticated/guest navigation states.

final result: passed
