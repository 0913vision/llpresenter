# Contract request: `spec-18`

- Team member: `spec`
- Branch: `feat/spec/clear-undo-visibility`, from `main`
- Base commit (`main`): `4d66230`
- Task: `.llp/task.md`, hide the clear undo button by default
- State: waiting at the task's shared-contract stop point

## Missing preference

Spec 10, "Settings to expose", "Show", names the stored preference
`preferences.json` -> `show.showClearUndoButton`. The task and spec-13's
recorded user decision establish its default as off.

`src/shared/schema/preferences.ts` currently has no `show` group and no
`showClearUndoButton` field. Its unknown-field preservation does not provide a
validated, typed preference or its default. The task explicitly requires
stopping before adding a missing preference, so no application code changed.

## Exact stored field requested from data

```ts
readonly show?: {
  readonly showClearUndoButton?: boolean;
};
```

Add the group using the existing preferences-schema conventions:

```ts
show: v.exactOptional(
  jsonObject({showClearUndoButton: optionalBoolean}),
),
```

The normalized `Preferences` value must contain:

```ts
show: {showClearUndoButton: false},
```

`withPreferenceDefaults` must merge the nested group:

```ts
show: {...defaultPreferences.show, ...stored.show},
```

An absent preferences file, absent `show`, or absent `showClearUndoButton`
therefore means false. Explicit false hides the control; explicit true shows it.
Keep unknown fields intact and use the existing boolean validation and
preferences-file error handling. This is an additive optional field, with no
change to `clear.undo`, `canUndo`, or the last-clear record.

## Renderer read prerequisite

The main data store already loads normalized preferences in `fileStore.ts`, but
the current preload API exposes no preferences read. `ui.get()` returns the
layout fields of `app.json`; it must not become a second stored copy of this
preference.

A minimal read-only boundary for the data owner to provide would be:

```ts
readonly preferences: {
  get(): Promise<{
    readonly show: {readonly showClearUndoButton: boolean};
  }>;
};
```

Suggested channel: `preferences:get`. Its main handler would wait for the
existing preferences load, return the normalized boolean (false when no usable
settings loaded), and validate the reply in preload. No settings-write API or
settings window is needed for this task. A future settings editor can add live
preference updates through data's contract.

The required schema, defaults, loading/IPC wiring, preload boundary, and their
tests belong to data and are outside the current exception for
`src/renderer/src/show/`. Data can land the prerequisite, or the lead can
explicitly extend the feature exception to those paths.

## Work after the prerequisite

The clear row will show both the separator and undo button only when the
validated setting is true. Missing or not-yet-loaded settings will hide both.
Tests will cover the default, explicit false, explicit true, and unchanged
`clear.undo` behavior when the button is shown. Hiding the button will not clear
or change undo availability or output state.

## Checks so far

- Created the branch from clean `main` at `4d66230`.
- Checked spec 10, spec-13's recorded decision, the preferences schema and
  defaults, main preferences loading, preload API, and clear-row implementation.
- Only this contract request and ignored working notes changed.
- Implementation and full verification have not run because the task requires
  this stop before the missing shared field is added.
