# Song block editor

P2a's editor is separate from the library and the preparation frame. The shell
owns mounting, selection, notifications, and window shutdown:

```tsx
const editor = new SongEditorStore(api, onProblem);
editor.open(selection.document);
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
connection. No timers, output commands, or global keyboard listeners are
registered by this feature.

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
Each song has one write in flight and one coalesced newest draft. A main-side
push before the reply does not reset local input or history. Undo restores
slides and arrangements, using the current canonical root metadata on save. A
newer external revision during a write, refusal, or transport error keeps the
local draft and blocks further edits. The warning offers explicit reload; reload
discards the local draft/history and reads the current document. An applied
`write-failed` result keeps the edits and advances the revision, while reporting
the persistence failure. Main owns retries and recovery files.

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
