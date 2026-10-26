# Review request: `screens-12`

- Team member: `screens`
- Branch: `fix/screens/identify-details`
- Base and exact head: see request line.
- Scope: freeze-allowed C02 Identify alignment, user decision October 27.

## What changed and why

Identify now shows each running screen's name, resolution, monitor refresh rate,
Audience or Stage kind, presentation method, and System output type. A monitor
without a running screen shows its hardware name and display details instead. An
unknown refresh rate is identified explicitly rather than reported as zero.

The main process supplies the identities and actual output placements. The
renderer does not infer monitor ownership. Multiple outputs on one monitor get
separate cards. Cards keep the existing 240 DIP size, three-second timeout,
click-through behavior and capture-area avoidance. Repeated Identify reuses the
same windows and resets the timeout; changed names or details replace them. If
the existing center and corner candidates are occupied, that card is skipped
under the existing capture-avoidance policy. No new output is enabled by
Identify.

The overlay windows remain unfocusable and call `showInactive` only in normal
mode. Offscreen runs now draw real hidden Identify pages for app verification,
without presenting a window, changing window order or taking focus. Output
handles expose their virtual bounds in offscreen mode to exercise placement and
capture avoidance through the same main-process path.

Details cross into the isolated page as URL data with an additive bounded
schema: 200-character names, finite refresh from 0 to 1000 Hz, bounded positive
pixel dimensions and explicit kind/method enums. The page uses text nodes and
rejects malformed or oversized data. No preload bridge is added to Identify. The
ScreenEditor and selection APIs remain unchanged.

## ProPresenter evidence

The comparison in [screens-11](screens-11.md) contains the source audit. The
[specified ProPresenter 7.5 guide snapshot](https://web.archive.org/web/20250802220651/https://files.renewedvision.com/propresenter/support/Pro7UserGuide.pdf),
printed p. 33, documents Identify names and technical output details while
Audience or Stage outputs are on. C02 in `docs/qa/proposals-vs-pp.md` and the
October 27 user decision authorize this alignment. The exact duration, card
size, capture avoidance and noninterference remain our existing rules; they are
not claimed as ProPresenter measurements. Separate Screen/Output identify modes
and advanced output drivers are outside this request.

## Changes outside my paths

All Identify windows live in output's paths. Changed paths are listed
explicitly:

- `src/main/outputs/monitorNumbers.ts` and tests: screen identities, safe card
  placement, reuse and changed-details handling.
- `src/main/outputs/numberWindow.ts` and tests: encoded details and hidden
  offscreen drawing, preserving no-focus behavior.
- `src/main/outputs/start.ts` and tests: connect the existing main-owned output
  placements to Identify and exercise hidden Identify windows.
- `src/main/outputs/outputWindow.ts`, `manager.ts` and manager tests: expose
  currently shown output metadata and actual bounds; exclude off/hidden outputs.
- `src/main/outputs/electronWindow.ts` and tests: expose offscreen virtual
  bounds.
- `src/main/outputs/screens.ts`, `settingsScreens.ts`, `defaultScreens.ts`:
  retain saved Audience/Stage kind in main's internal output metadata.
- `src/renderer/src/output/monitorNumber.ts`, CSS and tests, `main.ts`: draw the
  validated Identify card without interactive elements.
- `src/shared/schema/identification.ts` and tests: additive bounded URL payload.

## Checks run

Pending final rebase checks and exact-head CI; see request line.

## Checked in the app

Pending final build and repeated offscreen verification on the rebased branch.

## Team member's reply
