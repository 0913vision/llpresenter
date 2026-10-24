# Review request: `output-6`

- Team member: `output`
- Branch: `fix/output/log-flush`
- Base commit (`main`): `4aa7901` (round 2)
- Last commit: the commit that adds this file
- Related brief: `docs/briefs/output.md` (bugs from qa, M1-4 and M1-5, minor;
  the lead gave me `src/main/log.ts`)

## Changes outside my paths

`src/main/log.ts` and its test, which the lead assigned to me for this request.
`src/main/quit.ts` is new.

## What changed and why

Two bugs in the log path, one commit each.

**M1-5, the log queue (`6a4957f`).** The queue had no cap and wrote one
`appendFile` per line through a chain of promises, so 10,000 malformed commands
grew the main heap from 4.1 to 17.3 MB, took 30 to 70 seconds to drain, and
slowed `live.get` meanwhile. The logger is now a small class
(`RotatingFileLogger`) behind the same `Logger` interface:

- Lines wait in a queue capped at 1,000 lines (`maxPendingLines`). Lines beyond
  the cap are counted, not kept, and a
  `WARN <N> log lines dropped because too many were waiting` line follows the
  batch.
- A line identical to the one before it in the queue (same level, message, and
  detail) is merged into it, and the written line ends with
  `(repeated <N> times)`, with the time of the first one.
- One drain writes the whole queue as one batch, split only at the rotation
  size, so a burst costs a few `appendFile` calls. The batch is taken after the
  drain's first await, so lines logged in one go land in the same batch.
- `flush()` waits until nothing is queued or being written, including lines
  logged during a write. A failed write goes to `console.error` instead of
  vanishing, and later lines still go out.
- The console echo in development prints only new lines, not merged or dropped
  ones. `FileLogger.pendingLines` exposes the queue length for tests.

**M1-4, lines lost at quit (`35f7afd`).** `window-all-closed` called
`app.quit()` at once, so the `log.flush().then(app.quit)` in the control
window's `closed` handler never finished. `flushLogBeforeQuit`
(`src/main/quit.ts`) now holds Electron's `will-quit` until `flushWithin`
reports every queued line on the disk, or until 2 seconds pass
(`QUIT_FLUSH_LIMIT_MS`), so a stuck disk can't block quitting. Then it quits for
real. The control window's `closed` handler only calls `app.quit()`.

## Changed files

- `src/main/log.ts`, `src/main/log.test.ts`
- `src/main/quit.ts` (new), `src/main/quit.test.ts` (new)
- `src/main/index.ts`
- `docs/reviews/output-6.md` (new)

## Checks run

Round 2, on `66bb4db`, on `main` at `4aa7901`: `npm run verify` passed, 5 steps
in 390.1 s (58 test files, 585 tests, the machine was busy). Round 1 (the table
below) was on `d7de886` on `main` at `3afbb50`.

| Command or test  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` | Passed, 5 steps in 83.2 s: typecheck, lint, format check, 42 test files and 371 tests with coverage, build                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| New tests        | `log.test.ts`: repeated lines merge with a count; a 10,000-line burst stays under the cap and the written lines plus the dropped count add up to 10,000; a 10,000-line burst goes out in at most 3 writes while a `setImmediate` round trip stays under 250 ms; lines logged during a write still go out; `flushWithin` reports a finished flush and gives up on a stuck one after the limit without leaving a timer. `quit.test.ts`: 50 lines queued right before quitting all reach the disk before the app quits; a stuck disk lets the app quit after 2 seconds |

## Quality checklist ("Quality bar" in `docs/TECH.md`)

- [x] `npm run verify` passes
- [x] `npm run format:check` passes
- [x] Every new behavior and every bug fix has unit tests
- [x] Values from outside the process are validated with a schema (none new)
- [x] No `any`, no type assertions that bypass checks, and no `!`
- [x] Every registered subscription, timer, IPC listener, video and audio
      element, and object URL is released (the flush limit timer is cleared)
- [x] Caches and lists have size caps (the log queue)
- [x] An exception in the output path doesn't stop the output (log writes never
      throw)
- [x] Only what's needed re-renders (control window): not touched
- [x] The clean code rules in `CLAUDE.md` hold
- [x] Comments follow `CLAUDE.md`
- [x] The code uses the modern language features that `CLAUDE.md` lists
- [x] The change is small and focused, and "What changed and why" describes it
      clearly
- [x] Measured performance values: a 10,000-line burst drains in at most 3
      writes in the test (it took 10,000 writes before)

## Decisions I made (for the lead to confirm)

1. **Merge and drop, both.** Repeats merge into one line with a count, and a
   flood of different lines is cut at 1,000 waiting lines with a dropped count.
   The first lines of a flood are kept, because they usually show its cause.
2. **Only consecutive repeats merge**, so the order of different lines in the
   file stays true.
3. **2 seconds for the quit flush.** A normal flush takes a few milliseconds; 2
   seconds is long enough for a slow disk and short enough not to look like a
   hang.

## Shared contract change requests

None.

## Where to look

- `src/main/log.ts`, `enqueueUnlessMerged`, `scheduleDrain`, and
  `writeNextBatch`.
- `src/main/quit.ts`: the `will-quit` hold and the second `app.quit()`.

---

Reviewers follow Google's engineering practices: approve a change once it
improves the overall health of the code, even if it isn't perfect. Request
changes when a clean code rule or a comment rule is broken, or when tests are
missing.

## Review: lead

- Verdict: Approve / Request changes
- Findings:

  1.

## Review: reviewer

- Verdict: Approve / Request changes
- Findings:

  1.

## Team member's reply

1.

Round 1 findings (codex4):

1. **A batch that can't be written (`log.ts`)**: fixed in `f6ee22c`. The drain
   now takes the batch before it touches the disk, so a failed `mkdir` or
   `appendFile` consumes that batch: its lines are dropped, `console.error` says
   how many, the drain ends, and `flush()` settles. The next line tries the disk
   again, so the log recovers when the folder becomes writable. The burst still
   lands in one batch because the drain yields once before taking it. Test: a
   log folder under a file (can't be created) takes two lines, both flushes
   settle, and each failed batch is reported once.
2. **Merging across a dropped line (`log.ts`)**: fixed in `f6ee22c`. A repeat
   merges only while nothing has been dropped since the last waiting line. Test:
   with a cap of 1, A, B, A gives "A" and "2 log lines dropped".
3. **The in-flight test (`log.test.ts`)**: rewritten. The first `appendFile` is
   paused for real, the second line is logged after that write started, and only
   the first `flush()` is awaited; the file then has "first" and "second" in
   that order.
4. **Quit edge cases (`quit.ts`)**: a rejected flush already quit through the
   rejection handler, and `flushWithin` clears its timer in `finally`; a new
   test proves both. A second quit request during the flush could start a second
   flush with a new deadline; fixed in `66bb4db`: the handler now holds a state
   (running, flushing, flushed), and a request while flushing only prevents the
   default. Test: a second quit 500 ms before the limit doesn't move it, and no
   timer is left.
