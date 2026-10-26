# Review request: `bible-3`

- Team member: bible
- Branch: `feat/bible/mount-reference-form`
- Stack: bible-2, `feat/bible/reference-form`.
- Base and reviewed head: recorded in the member report after rebase.
- Related brief: `docs/briefs/tools.md`; October 26 four-field input decision.

## What changed and why

진행 퀵 실행 and 준비 항목 추가 성경 구절 now mount the same four-field Bible
form. 진행 previews the current valid reference and Enter outputs it. 준비 opens
the existing small dialog component, reads the opening's defaults, and inserts a
passage with Enter or 추가. Invalid or pending references cannot insert;
cancelling forgets pending replies and reopening reads fresh defaults. No output
command comes from the 준비 dialog.

Recent passages retain their original reference, including whole chapters and
cross-chapter ranges. Choosing one clears the manual fields and previews the
stored passage before Enter outputs it. Editing any field starts a fresh manual
reference. Translation changes cannot reuse a stale passage. The dialog's 추가
button follows the form's current ready passage, including equivalent normalized
input, rather than retaining the last successful lookup after invalid edits.

The former single-field tests move to the shared form's interaction tests;
wrapper tests retain recent-range, translation, dismissal, and focus coverage.
Show workspace and quick-panel tests exercise selection cancellation and output
with the new fields. Prep integration covers shared completion, invalid fields,
clamped insertion through both actions, fresh defaults, and legacy slot fill.
Spec 04 now agrees with spec 02 and the October 26 decision, addressing the
bible-1 review nit.

## Changes outside my paths

- `src/renderer/src/prep/service/QuickAdd.tsx` and its tests connect the shared
  form to the existing item insertion and insertion-position rules.
- `BibleQuickAdd.tsx` supplies the existing small dialog; `useBibleLookup.ts`
  becomes `useBibleDefaults.ts`, removing the duplicate passage reader because
  the shared form owns lookups.
- `docs/spec/04-show.md` replaces obsolete single-field and eight-book rules.
- `docs/reviews/bible-3/` contains screenshots and measured counters using only
  the repository's original invented QA sentences, explicitly not Scripture.

## Checks run

- `npm run typecheck`: passed.
- Scoped Vitest: 72 tests across six renderer files passed.
- Scoped ESLint and formatting: final results in the member report.
- `npm run build`: passed; the actual built app was exercised below.
- Exact-head GitHub `npm run verify`: run URL and result in the member report.
- No full local verify, dependency changes, Bible text, or crawl output.

## Checked in the app

Built with `LLP_DEV_PORT=5193`, launched with `LLP_TEST_WINDOWS=offscreen` and
the isolated Bible member app-data folder. Every launch script and the built
main entry passed `node --check` before Electron started. The sample was copied
from the repository and locally converted to the chapter container. The driver
uses real CDP mouse, keyboard, and text input, without mocking IPC or changing
React state. The app exited normally after the checks.

- Ambiguous 책 has no initial highlight. Tab stays; two ArrowDown presses and
  Tab choose 베드로전서 and advance to 장. Hover alone cannot authorize Tab.
  Exact 요, English John, and IME-off dy complete to 요한복음. After
  asynchronous default loading in 준비, John was typed directly without clicking
  the input.
- A valid 3, 16, 18 reference previews without changing live state. Enter sends
  the passage. Invalid chapter 22 blocks Tab with the field reason. End 99
  blocks Tab, looks up through verse 36, and normalizes to 36 on Enter. Changing
  the start clears the end.
- Switched from a service song to the Bible preview and back for 20 cycles.
  Checked the four fields at 1280 by 720 and the normal 1600 by 900 viewport.
- In 준비, opened and closed the form twice, then repeated start/end changes for
  20 cycles. Reversed end 15 blocks Tab, Enter, and 추가. End 99 inserts
  요한복음 3:16-36, adding exactly one service item while live output remains
  unchanged. Opened and closed twice again after insertion to check cleanup.

Measured after forced GC, with 20 warmup cycles before each measured loop;
[raw counters](bible-3/check.json) record the baseline, 10-cycle and 20-cycle
samples:

| Flow                             | Elements        | Listeners       | Used JS heap, bytes               |
| -------------------------------- | --------------- | --------------- | --------------------------------- |
| Show selection cycles            | 493 / 493 / 493 | 839 / 839 / 839 | 6,601,768 / 6,699,840 / 6,747,228 |
| Prep field changes               | 210 / 210 / 210 | 623 / 623 / 623 | 5,607,828 / 5,642,052 / 5,680,860 |
| Settled Prep after closing twice | 193 / 193       | 758 / 758       | 5,663,680 / 5,697,812             |

Show heap changes 2.2%, Prep 1.3%. The initial Show loop before the extra warmup
grew 6.7%; those startup samples are retained separately in the raw counters.
Prep's total DOM-node counter grows from 404 to 444 during repeated native text
editing, while elements and listeners remain constant; after dialog unmount and
cleanup it falls to 326 and remains 326 across both subsequent closes. These are
short repeated-flow observations, not a long-duration soak or a physical monitor
check.

![Show fields and preview at normal width](bible-3/show-four-fields.png)

![Show fields at narrow width](bible-3/show-narrow.png)

![Ambiguous book without automatic selection](bible-3/show-ambiguous.png)

![Invalid chapter field and tooltip](bible-3/show-invalid-chapter.png)

![Prep four-field dialog](bible-3/prep-four-fields.png)

![Prep reversed end](bible-3/prep-invalid-end.png)

![Prep oversized end ready for clamped insertion](bible-3/prep-valid-clamped.png)

![Inserted Prep passage](bible-3/prep-inserted.png)

### Unavailable-book regression after bible-2 round 2

Restacked this branch on the corrected bible-2, rebuilt, and drove both mounted
forms in the offscreen app. The invented installed translation has John and no
Psalms. For 20 measured cycles after 20 warmup cycles in each form, 요 advances
to 장, while 시, after its unavailable result arrives, remains in 책 on Tab with
the original input and the 역본에 없는 책 tooltip. The Show popup and Prep
dialog each close twice. Live output and the service item count do not change.
Pending-lookup completion is covered by the deferred-reply unit test.

[Regression counters](bible-3/unavailable-check.json): Show elements remain 473
and listeners 553 across all samples, with heap 5,478,332 to 5,588,736 (+2.0%).
Prep elements remain 216 and listeners 766, with heap 5,611,484 to 5,664,636
(+0.9%). The app exited normally after the check.

![Show retains focus for an unavailable book](bible-3/show-unavailable-book.png)

![Prep retains focus for an unavailable book](bible-3/prep-unavailable-book.png)

## Quality and review focus

The shared component owns both lookup readers and releases them on unmount. Only
the newest input and translation can preview or submit. Book suggestions are
bounded by 66 and recents by ten. Error reasons use existing tooltip and field
components, with short Korean labels and token-based layout. The new dialog uses
existing design-system sizing, focus trapping, and cleanup.

No new feature work outside the frozen four-field decision. The existing
stored-reference grammar and main-process endpoint validation remain unchanged.

## Verdicts

Recorded by the lead at merge.
