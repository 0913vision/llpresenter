# Live slice registry

The main process discovers the modules in `slices/*.ts` with an eager Vite glob
in `slices.ts`. Test files and the separate fixture folder are excluded. A new
slice is a new module; no command list or central reducer switch changes.

Export a `defineSlice({commands, initial, reduce})` value. `commands` names the
shared command types owned by the module. `reduce` receives only those variants
of `LiveCommand`, the current `LiveHistory`, and a context with the command time
and the registry dispatcher for batch children. Extending the shared union does
not widen existing slice reducer inputs. A command cannot be owned by two
slices; duplicate ownership fails registry construction.

`initial` supplies this slice's default state fields. Individual `layers` fields
merge with the other defaults. An explicit starting state supplied to LiveStore
is preserved. Reduce immutably and return the same history for a no-op. The
existing `history.ts` helpers preserve versioning and clear undo semantics.

See `slices/content.ts`, `slices/clear.ts`, and `slices/outputs.ts`. They retain
the existing command behavior. Add a shared command contract through data before
implementing its slice.

The batch slice uses `context.apply` to reduce each child through the same
registry, without intermediate store notifications. A changed batch advances the
version once. Its clears retain the first clear snapshot while it remains valid;
new content still ends undo as it does for individual commands. Empty or
unchanged batches retain the current state and undo without broadcasting.

`SliceRegistry.run` returns skipped-command diagnostics with the resulting
history. The application dispatch logs every skipped child. A slice reports a
missing target by throwing before changing its immutable input; the next child
continues. The pure `apply` helper rethrows failed reductions for its caller
instead of silently discarding their errors.

After the reduction, the registry checks the final state once against the live
state schema and byte budget. When that check fails, the whole dispatch is
rejected, however deeply its children nest: the history stays as it was, and
none of the observations deferred through `context.defer` run. A slice defers
every effect outside the live state this way, so a rejected dispatch leaves
nothing behind. One `dropped` diagnostic, after those of the skipped children,
names the top-level command and the 매크로 that ran, which the 매크로 runner
notes through `context.ranMacro` (a skipped child's notes are dropped).
`dispatchLogged` logs it as `dropped live dispatch` with their ids, and the
store then reports each 매크로 to the windows as an `app:problem` of kind
`macro-dropped`, for the 매크로 적용 실패 card.

IPC validation remains in `ipc.ts`. All application dispatch goes through
`dispatchLogged`, which logs an unsupported type as `unhandled live command` and
rejects it before dispatch. The pure registry and direct store dispatch also
leave an unsupported command's history, state, version, and undo intact.

`registryExtension.test.ts` substitutes only the discovery entry point with a
fixed fixture glob. The new `fixtures/slices/probe.ts` file initializes and runs
through the real store without any per-module registration. Registry tests also
exercise runtime future command types, without widening shared contracts.
