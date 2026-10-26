Review range: `f5d8eb2b...feat/spec/service-sources`

# Review request: `spec-49`

- Team member: `spec` (Claude session that took over from Codex)
- Branch: `feat/spec/service-sources`, rebased onto `main` after spec-48 merged
- Base commit: `f5d8eb2b`
- Review round: 2
- Task: M3-P4, part 2 of 3 for 새 예배 (P4a): the source lists, the chosen
  source's document, the date and time choices, and the left list
- Code owner: prep for `src/renderer/src/prep/services/` (no prep member; lead
  exception for P4)

## What changed and why

Spec 05 "New service" puts the sources on the left of the dialog: 빈 예배, the
틀 group (name and "항목 9개"), and the 지난 예배 group (name, a date such as
"10월 25일 일요일", and the count). "Importing from another service" uses the
same list without 빈 예배. The bottom bar has 이름, 날짜, and 시간.

- **Lists.** `useSourceLists` reads the 틀 list, the service list, and the
  library's song titles when the dialog opens, and follows the two lists while
  it is open, so a 틀 saved from the dialog shows up. A list main pushes before
  the read answers is newer and stays. A failed read is logged and can be
  retried (round 2).
- **Chosen source.** `useSourceDocument` reads the 틀 or past service the
  operator picks and gives its name, its time (a 틀's `time`, or the time part
  of the service's date), and its items. 빈 예배 has no name and no items. A
  source that was deleted or couldn't be read is `missing`. Each choice is
  numbered, so a read for an earlier choice never shows under a later one.
- **Left list.** `SourceList` is ui's inset `ListBox` with 빈 예배 (when asked
  for), a 틀 group, and a 지난 예배 group, newest service first, each with the
  two-line rows the gallery's 새 예배 example shows. A group with no rows is
  left out. An entry without `itemCount` shows no count.
- **Dates.** `serviceDates.ts` writes a local date as `YYYY-MM-DD`, shows it as
  "10월 25일 일요일", and shows a time as "오전 11:00". The date choices are
  today and the next 13 days, plus the chosen date if it is outside them; the
  time choices are the day in 30-minute steps, plus the chosen time if it falls
  between steps.

## Round 2 response

1. **Independent reads.** The 틀 list, the service list, and the song titles are
   read and followed each on its own (`useListRead`), so a failed read keeps the
   others' results. `ready` turns on when every read has answered, and `failed`
   tells that one failed; `retry` reads only the failed ones again, and a list
   stays failed, not loading, until its new read answers, so the dialog keeps
   its rows. `SourceList` takes an `onRetry` and then shows "목록을 다 읽지
   못했습니다" with 다시 시도 under the list; spec-50 passes it while a read has
   failed. A test fails the song titles once, keeps the 틀 and services, retries
   only the titles, and gets them; another clicks 다시 시도.
2. **Read numbers.** `useSourceDocument` gives each new choice the next read
   number, during render, and shows a document only for the current number. For
   A, B, then A again, A's old document doesn't show while A is read again. A
   test with deferred reads loads A, picks B and A, sees nothing, and then sees
   A's new answer (missing, in the test).

## Decisions I made (for the lead to confirm)

1. **Lead decision (P4 Q2):** the date control is a select with today and the
   next 13 days, not the calendar spec 05 draws, until the design system has a
   calendar popover. A `TODO(0913vision)` in `serviceDates.ts` points at it.
2. 지난 예배 lists every service, the current one and any dated later included,
   newest first. Spec 05 doesn't limit it, and copying last week's service is
   the common case.

## Changes outside my paths

None.

## Validation

| Command or test                                                                 | Result                 |
| ------------------------------------------------------------------------------- | ---------------------- |
| `npm run typecheck`                                                             | Pass                   |
| `npx --no-install vitest run --no-fsModuleCache src/renderer/src/prep/services` | Pass, 33 tests         |
| `npx --no-install eslint --max-warnings 0 src/renderer/src/prep/services`       | Pass                   |
| `npx --no-install prettier --check src/renderer/src/prep/services`              | Pass                   |
| GitHub CI (`npm run verify`)                                                    | In the request message |

Tests: dates with weekdays, times at midnight, morning, noon, and evening, the
two weeks of dates with a chosen date outside them, and the time steps with a
time between them; the list rows in order with their dates and counts, the
selected row, the reported source of a picked row, and leaving out 빈 예배 and
an empty group, and the retry line; the lists read, followed after a push, a
pushed list kept over a late read, the listeners removed, and one failed read
logged, kept apart, and retried alone; a 틀's name, time, and items, a past
service's time from its date, 빈 예배, no source, a deleted source, an earlier
read that answers after a later choice, and A, B, then A again.

No Electron process, visible window, soak, or memory measurement was started.

## Verdicts (recorded by the lead at merge)

- Round 1 (Codex, codex2): Request changes: one rejected read discarded every
  successful list, and reselecting a source showed its stale document.
- Round 2 (3fd2a966): reviewer (Codex, codex2) Approve, no findings. Lead
  Approve. The date control is a Select until the design system has a calendar
  (lead decision, Q2). Rebased by the lead onto local `main` without conflicts;
  typecheck passes.
