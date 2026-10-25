# Review request: data-37

- Team member: data
- Branch: `feat/data/flush-handshake`
- Base: `81cc2b98c7a0bd7135cba37ad4d9e3735938fb83` (`main`)
- Review range: `81cc2b9...feat/data/flush-handshake`
- Request: `.llp/task.md`, "Next (from the lead, 04:15)".
- Final commit and final HEAD CI URL/result accompany the review request.

## What changed and why

The song editor retains a typing group in the control window for up to one
second. Main's shutdown path needs an explicit preflight result while that
window and its drafts are still alive. This request supplies the shared IPC
contract and validated preload API for that preflight.

| Direction              | Channel                                          | Payload                                                           |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Main to control window | `Channels.appFlushRequest` (`app:flush-request`) | `AppFlushRequest`: `{requestId: AppFlushRequestId}`               |
| Control window to main | `Channels.appFlushDone` (`app:flush-done`)       | `AppFlushDone`: `{requestId: AppFlushRequestId, result: boolean}` |

`AppFlushRequestId` is a distinct branded lowercase UUID v4. Main can create one
with the public schema-layer `createAppFlushRequestId(randomUUID())`, without
importing Valibot. Payloads contain only the fixed-size ID and a boolean; they
have no lists or unbounded text. The schemas reject non-object values, invalid
IDs, missing fields, and non-boolean results, and strip unknown fields.

The boolean matches the existing editor's `flush(): Promise<boolean>`: true
means its pending edits were submitted successfully, including the no-pending-
edits case; false means the editor could not flush and its draft must remain
available. The result acknowledges the renderer's preflight. Main still owns
flushing its persistence queues and completing shutdown.

### API for ui

- `window.llp.app.subscribeFlushRequests(listener): Unsubscribe` validates each
  incoming request and passes only its normalized payload to the listener. Call
  the returned unsubscribe when releasing the editor's handler.
- `window.llp.app.flushDone({requestId, result}): void` validates and sends the
  editor's reply. Invalid replies are logged and dropped before IPC.

The editor should await its flush before replying with the received ID. A failed
or throwing flush must not be reported as true. Actual editor handler
registration and disposal remain ui's follow-up.

### API and bounds for output

`APP_FLUSH_LIMITS` defines one pending request and a 5,000 ms wait. Main's
follow-up owns the waiter and timer: repeated close/quit attempts join the
pending request, and each new request gets a new ID. Use
`parseAppFlushRequest(value)` to validate a request and
`parseAppFlushDone(value, pendingRequestId)` to validate and correlate a reply.
Omitting the second argument performs shape validation only, as used by preload.
A reply for another ID fails at `requestId`.

The main-side follow-up must bind replies to the requested control window,
release its pending request/timer on completion, timeout, or disposal, and
ignore replies after that request ends. False, timeout, window loss, and a
malformed reply are not successful acknowledgements. The main close/quit wiring
and that runtime timeout are explicitly outside data-37, as requested. No close
hook, dialog, forced close, editor mutation, or persistence operation is
introduced by this contract.

### Follow-up test isolation rule

Per the lead's instruction during data-37, the remaining screen-command
unsupported-dispatch contract test now supplies an explicit empty
`SliceRegistry`. Its assertion describes that test registry, so a new production
screen slice can land without changing the schema test. The other data-owned
unsupported-dispatch tests already use explicit registries. Future contract
tests will pin their supported or unsupported commands the same way.

## Changed files

- `src/shared/schema/appFlush.ts`: payload schemas, types, wait bounds, and
  parse helpers, including optional expected-ID validation.
- `src/shared/schema/appFlush.test.ts`: valid results, normalization, invalid
  payloads, oversized/uppercase IDs, mismatched IDs, and branded helper types.
- `src/shared/schema/ids.ts`: the flush request ID brand and public constructor.
- `src/shared/schema/screenCommands.test.ts`: pin unsupported dispatch checks to
  an explicit test registry, per the lead's new test-isolation rule.
- `src/shared/ipc.ts`: two channel names and the typed `LlpApi.app` functions.
- `src/preload/index.ts` and `index.test.ts`: schema-checked receive/send,
  malformed-value logging, normalized payloads, and subscription removal.
- `src/shared/testing/fakeLlpApi.ts` and `fakeLlpApi.test.ts`: complete defaults
  and partial app overrides for existing and future renderer tests.
- `docs/reviews/data-37.md`.

## Checks run

Additional screen-command, action, and batch registry-isolation contract tests:
three files, 80 tests passed.

| Check                                                                               | Result                                          |
| ----------------------------------------------------------------------------------- | ----------------------------------------------- |
| `npm run typecheck`                                                                 | Passed                                          |
| Focused Vitest: flush schema, preload API, fake API, existing sandbox preload build | Four files, 73 tests passed                     |
| ESLint on changed TypeScript files                                                  | Passed                                          |
| `npm run format` and `git diff --check`                                             | Passed                                          |
| Rebase onto latest main                                                             | Already up to date                              |
| Local full verify                                                                   | Not run, per lead instruction                   |
| GitHub full verification                                                            | Final HEAD URL and result accompany the request |

No dependency added. Preload reuses the existing disposable listener helper and
stores no request registry or timeout. The sandbox build test verifies the real
preload bundle runs with the allowed modules. No app, visible windows, dialogs,
soak, or memory measurements were started.

## Review: lead

Pending.

## Review: reviewer

Pending.

## Team member's reply

Pending review.
