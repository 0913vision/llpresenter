# Song editor

The editor is separate from the library and the preparation frame. The host owns
mounting, selection, notifications, and window shutdown:

```tsx
const editor = new SongEditorStore(api, onProblem);
editor.open(selection.document, {focusTitle: selection.focusTitle});
// NOTE(0913vision): Render in a panel with a bounded height.
<SongEditor store={editor} />;
// NOTE(0913vision): On selection clearing, call editor.open(null).
// NOTE(0913vision): Check await editor.flush() before unmounting at window close.
// NOTE(0913vision): Keep the window open on false, otherwise unmount and dispose.
```

Create one store per control window, outside React render. `open` accepts a
checked `SongDocument` from the library. Opening a cached older revision keeps
its pending input and undo history. Panel unmounts do not dispose the store. The
store subscribes to song, library-list, and label changes. It removes deleted
songs, keeps at most one session per opened existing library song, and caps each
history at 100 steps. Before shutdown, await `flush()` while the editor is still
mounted. A false result means a draft was refused; keep the window/store alive
so the warning's reload action and draft remain available. After a true result,
unmount and await `dispose`. It removes all subscriptions, completes accepted
writes, and releases sessions. The host must await it before closing the IPC
connection. Each session owns at most one deferred-save timer. No output
commands or global keyboard listeners are registered by this feature.

## Header

Forward `LibrarySelection.focusTitle` in `open` options after creating a song.
The header consumes it once, focuses and selects the title, and does not refocus
on a panel remount. Reopening the same song with a fresh request focuses again.
The 34px header uses the title field and library/service-use tags. Library list
pushes provide exact-title validation and service names for the usage tooltip; a
newer push supersedes an older initial list read.

Title edits share the song's one timer/write queue with lyrics. Titles use trim
plus NFC before duplicate comparison and saving, including existing library
titles in the comparison. Raw input remains intact while typing; acknowledgments
compare the captured raw draft so they cannot delete newly typed spaces. Blank
or normalized duplicate titles show the error ring/reason and are not sent.
Invalid drafts revert on blur; valid drafts save at idle, blur, or Enter. Main's
raced duplicate refusal marks the field while valid lyrics can still save under
the canonical title. Own replies retain newer title input, including a return to
the prior canonical title. Lyric undo preserves the accepted title metadata.

Default background, arrangements, and the preview/list follow in later P2b
requests; preparation-frame mounting belongs to the host.

`SongSession.setBackground(id | undefined)` uses the same queue and retains the
accepted background through lyric undo. `undefined` removes the field. The
virtualized `MediaPicker` offers images/videos plus none with 28px menu rows, an
IME-safe search field, logical keyboard navigation, and at most twelve mounted
options. Search uses trim/NFC/lowercase contains matching, always retains none
first, and resets the virtual window when the query changes. A nonblank query
points to the first match; blank/no-match queries point to none. Arrows move the
pointed result while focus stays in search, with the active descendant only on
the combobox. Home/End and Space stay native in search. `Select` can show a
paused video lead and releases its source on change/unmount. Header/media
subscription wiring follows in ui-26; `EditorApi` now includes the checked
`media` API already present on `window.llp`.

## Editing and saving

Each textarea is a single slide. Enter, blank-line splitting, Backspace merging,
plain-text paste, Ctrl Enter, Ctrl Shift N, Ctrl Z, Ctrl Y, and Ctrl Shift Z
dispatch to the approved block model. Structural edits remap every named
arrangement under the split/merge decision in `docs/decisions.md`. Up/down cross
logical line boundaries at the same column; lyrics do not soft-wrap. Selection
with Shift and unrelated modifier shortcuts remain native. IME composition owns
its Enter and other command keys. Handled commands stop propagation; the host
must preserve the focused editor's keyboard precedence.

Saving uses `content.edit` with `song.update` and the last accepted revision.
Typing and ordinary Enter wait for the typing-group boundary: a block/song
change, blur, or 1 second without input. Structural edits and undo/redo save
immediately. Each song has one write in flight and one coalesced newest draft;
the previous write's reply does not prematurely save a new typing group.
Explicit `flush()` and shutdown drain accepted edits without waiting for the
timer. Flush, reset, deletion, refusal, and disposal clear the timer. A
main-side push before the reply does not reset local input or history. Undo
restores slides and arrangements, using the current canonical root metadata on
save. A newer external revision during deferred typing or a write, refusal, or
transport error keeps the local draft and blocks further edits. The warning
offers explicit reload; reload discards the local draft/history and reads the
current document. An applied `write-failed` result keeps the edits and advances
the revision, while reporting the persistence failure. Main owns retries and
recovery files.

## Labels

The editor resolves colors from the subscribed app-wide labels document.
Missing/deleted definitions render with `none`; songs keep their label text. The
popup has name choices, a color row that stays open, and an inline new-name
field. ContextMenu or Shift F10 opens the same management menu as right-click.
Rename and jump-key dialogs reuse the design system's modal/focus behavior.
Definition deletion uses its confirmation dialog. Read-only label settings leave
existing label selection available and explain blocked writes in tooltips.

Color, creation, jump keys, and deletion use revision-checked settings updates.
Rename flushes every cached song's pending edits, then calls main's
`settings.edit({type: 'labels.rename', name: 'labels', from, to, baseRevision})`.
Main rewrites all affected library songs, including songs never opened here. Own
rename pushes advance each cached session without resetting its history;
current, undo, and redo snapshots all map the renamed label. A concurrent
external slide change instead installs its checked document. Global label
operations temporarily make lyrics read-only, without replacing the picker
button that owns the popup's anchor and focus.

Jump keys record physical `KeyA` to `KeyZ` or `Digit0` to `Digit9`, without
modifiers. Numpad digits normalize only with Num Lock, as spec 10 requires for
label jumps. Backspace/Delete clear the key. The recording marker keeps host
shortcuts out. Duplicate keys remain allowed and warn on both rows; the runtime
matcher owns the first-in-list rule.

## Appearance and validation

The Reflow draft supplies the block layout: number, 120px label slot, 16px gaps,
14px insets, and a 2px accent bar. Design system tokens take precedence: lyrics
use body 14/20, numbers caption 12/16, and tags 22px. The 320px menu
accommodates the design system's nine 24px color buttons plus the name. Long
tags and color-row names truncate within their columns. Unchanged lyric blocks
are memoized.

`blockEditing.test.ts`, `songEditorStore.test.ts`, `SongEditor.test.tsx`, and
`LabelMenu.test.tsx` cover the model, save races, lifecycle, keyboard/focus, and
label operations. `editorFixture.ts` supplies invented sample text and simulates
main's revision checks and push-before-reply ordering. It is also usable by an
isolated offscreen preview; production mounting does not import it.
