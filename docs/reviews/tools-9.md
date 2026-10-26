# Review request: `tools-9`

- Team member: tools
- Branch: `feat/tools/bible-complete`
- Base: local `main` at `1986804e`, including approved tools-8 round 2.
- Brief: tools; user priority in decisions, October 26, Bible autocomplete
  first.
- Final head and exact-head CI are in the report.

## What changed and why

Both 진행's Bible reference field and 준비 항목 추가 성경 구절 complete the book
with Tab while keeping one input. A sole candidate completes immediately; with
several, the highlighted book wins, or the first one if none is pointed. Both
fields initially highlight the first book. Exact names and abbreviations retain
priority. Completion adds a space, keeps any chapter/verse suffix, and places
the caret before that suffix. Shift Tab, IME keys and Tab in the chapter/verse
part keep normal handling.

The existing book matcher and metadata move unchanged to shared modules. This
lets completion and candidate navigation work synchronously while a passage
lookup is pending; there is one matcher and one completion policy. The main
process uses the same relocated matcher. Candidates remain capped at eight and
expansions beyond the 256-character input limit are dropped. No Bible text or
generated translation files are included; the copible repository was not opened.

Chapter and verse errors mark the input with the error ring and tooltip. The
reason is hidden descriptive text for assistive technology, with no visible
sentence beside the field. Invalid input cannot output from 진행 or insert in
준비. Incomplete book candidates in 준비 complete the field and keep the menu
open; they do not insert a passage. Repeated Enter cannot output again.

## Changes outside my paths

- `shared/bibleBooks` and `bibleMatching` relocate owned main Bible modules;
  `bibleCompletion` and tests provide the shared policy. Main imports are
  updated.
- `prep/service/QuickAdd`, `quickAddBible` and tests connect the common rule.
- `ui/MenuParts`, `Menu`, styles and `useInputCompletion` add optional
  completion, error reason and input cap support. Existing menu users retain
  their behavior. The input hook commits caret placement after the controlled
  value updates.
- `docs/spec/04-show.md` records the user decision. No IPC/schema, dependency,
  storage format or output renderer changes.

## Checks and quality

Checks, range and exact-head CI are in the report. Tests cover exact/partial and
English/IME-off matching, sole and highlighted choices, immediate Tab before a
reply, suffix/caret preservation, invalid positions and modifiers, size caps,
chapter/verse errors in both fields, and insertion/output refusal. Existing
translation, recent-selection, lookup and menu regressions remain covered.

No new queue, cache, subscription or timer. The completion hook holds one input
selection and releases it on unmount. The new TSDoc is on the exported
completion function; all new `/**` comments were audited. No full local verify
or app launch.

## Next units

Remaining T1a tabs, then the retained timer tab. Audio requires O7 and lead
confirmation. Chunked translation files and passage splitting are separate work.

## Review: lead

- Verdict:
- Findings:

## Review: reviewer

- Verdict:
- Findings:

## Team member's reply
