# Live slice registry

The main process discovers the modules in `slices/*.ts` with an eager Vite glob
in `slices.ts`. Test files and the separate fixture folder are excluded. A new
slice is a new module; no command list or central reducer switch changes.

Export a `defineSlice({commands, initial, reduce})` value. `commands` names the
shared command types owned by the module. `reduce` receives only those variants
of `LiveCommand`, the current `LiveHistory`, and the command time. Extending the
shared union does not widen existing slice reducer inputs. A command cannot be
owned by two slices; duplicate ownership fails registry construction.

`initial` supplies this slice's default state fields. Individual `layers` fields
merge with the other defaults. An explicit starting state supplied to LiveStore
is preserved. Reduce immutably and return the same history for a no-op. The
existing `history.ts` helpers preserve versioning and clear undo semantics.

See `slices/content.ts`, `slices/clear.ts`, and `slices/outputs.ts`. They retain
the existing command behavior. Add a shared command contract through data before
implementing its slice.

IPC validation remains in `ipc.ts`. All application dispatch goes through
`dispatchLogged`, which logs an unsupported type as `unhandled live command` and
rejects it before dispatch. The pure registry and direct store dispatch also
leave an unsupported command's history, state, version, and undo intact.

`registryExtension.test.ts` substitutes only the discovery entry point with a
fixed fixture glob. The new `fixtures/slices/probe.ts` file initializes and runs
through the real store without any per-module registration. Registry tests also
exercise runtime future command types, without widening shared contracts.
