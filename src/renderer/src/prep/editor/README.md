# Song editor

The editor is separate from the library and the preparation frame. The host owns
mounting, selection, notifications, and window shutdown:

```tsx
const editor = new SongEditorStore(api, onProblem);
editor.open(selection.document, {focusTitle: selection.focusTitle});
// NOTE(0913vision): Render in a panel with a bounded height.
<SongEditor store={editor} />;
// NOTE(0913vision): On selection clearing, call editor.open(null).
// NOTE(0913vision): Answer main's close flush with editor.flush().
```

Create one store per control window, outside React render. `open` accepts a
checked `SongDocument` from the library. Opening a cached older revision keeps
its pending input and undo history. Panel unmounts do not dispose the store. The
store subscribes to song, library-list, and label changes. It removes deleted
songs, keeps at most one session per opened existing library song, and caps each
history at 100 steps. Before shutdown, await `flush()` while the editor is still
mounted. It stops every edit first and shows the editor as busy, so nothing
typed during or after it is lost. A false result means a draft was refused and
editing restarts; keep the window/store alive so the warning's reload action and
draft remain available. After true, editing stays stopped. After a true result,
unmount and await `dispose`. It removes all subscriptions, completes accepted
writes, and releases sessions. The host must await it before closing the IPC
connection. Each session owns at most one deferred-save timer. No output
commands or global keyboard listeners are registered by this feature.

The control window's `CloseFlush` (`src/renderer/src/control/closeFlush.ts`)
answers main's `app:flush-request` with this `flush()` before the window closes
or the app quits, and shows the 저장 중 dialog while it runs.

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

Arrangements and the preview/list follow in later P2b requests;
preparation-frame mounting belongs to the host.

`SongSession.setBackground(id | undefined)` uses the same queue and retains the
accepted background through lyric undo. `undefined` removes the field. The
virtualized `MediaPicker` offers images/videos plus none with 28px menu rows, an
IME-safe search field, logical keyboard navigation, and at most twelve mounted
options. Search uses trim/NFC/lowercase contains matching, always retains none
first, and resets the virtual window when the query changes. A nonblank query
points to the first match; blank/no-match queries point to none. Arrows move the
pointed result while focus stays in search, with the active descendant only on
the combobox. Home/End and Space stay native in search. Up from none wraps to
the last eligible item, including with a large virtual list. `Select` can show a
paused video lead and releases its source on change/unmount.

`SongBackground` connects the header to the checked media get/subscription API.
Newer pushes supersede delayed reads and read failures. Unmount releases the
subscription and ignores its late replies. A failed initial read exposes retry
on the trigger; loading, read-only song access, and global label operations
disable it with a reason. Locking closes an open picker and leaves it closed on
unlock. Media catalog read-only access still allows choosing a song background.
Missing references remain intact until the user chooses a replacement or none. A
catalog revision rebuilds the open picker window with the raw query owned by
`SongBackground`. Filtering and the first-match Enter target use the new catalog
without dropping the search. A fresh opening clears the query. Media read
failures log their cause before exposing retry. The title and tags wrap at
narrow widths; the header stays 34px when one row fits.

## Arrangement model

`SongSession.arrangement` is the viewed name, with `undefined` for 기본.
`arrangementSlides` exposes the selected order, retaining repeated references
and empty orders. `selectArrangement(name)` finishes pending typing without
moving the lyric cursor or persisting the view selection. Cached sessions keep
their own selection; a removed/undone selected name falls back to 기본.

`createArrangement()` copies the selected order, chooses the first unused
`구성 N` name, selects it, and saves through the same one-write queue. Creation
is one undo step; pending lyric typing saves with it. Undo to an originally
absent arrangements field removes that field on the wire. Existing split/merge
remapping applies to created orders. Read-only songs allow viewing and refuse
creation. `editedOrder` retains an empty stored order for editing/copying. The
shared `playbackOrder` follows spec 02 and 진행: a missing or empty selected
order displays the default file order.

`ArrangementRow` uses the shared segmented control through five choices,
including 기본, then Select. Right-click, ContextMenu, and Shift F10 manage a
segment without selecting it. 기본 is protected. Add copies the current order
and opens a selected name field; blank, reserved, and duplicate names cannot
save. Read-only songs still permit view selection. Menu/dialog focus returns to
the opener, or the selected control when rename/delete removed the opener.

Rename and delete flush cached drafts, serialize with global label operations,
and invoke main's existing `song.arrangement.rename/delete` commands. Main
rewrites service/template references. Own pushes reconcile the checked song and
map current/undo/redo snapshots so later lyric undo cannot restore the old name
or deleted order. Refusal keeps the draft; uncertain transport failure blocks
editing with explicit reload. Applied write failures report persistence trouble.

## Preview and slide panels

`SongPreviewPanel` draws the selected local block and default background through
the output renderer in preview mode. The screen selector resolves the current
Look's lyric style, visibility, and solid/media background for 본 화면, 무대,
and 방송 자막. Broadcast preview uses its configured green, black, or checker
background. Newer looks/screens pushes supersede delayed reads. Settings and
renderer resources are released at unmount. It subscribes to no live layers and
sends no output commands. The existing renderer has no stage-layout engine yet;
this panel uses its current lyric-layer support for the stage screen too.

`SongSlidePanel` displays `playbackOrder`, retaining repeated occurrences as
separate selected positions. A click selects the source block and scrolls it
into view while keyboard focus stays in the grid. It does not paint the song
background into thumbnails. The caption uses the source block's file position
and total, including when the cursor is outside a chosen order.

`VirtualSlides` mounts visible rows plus a small overscan. Arrows, Home, and End
navigate the full logical order and focus/reveal the target window. Shared
`ThumbnailGrid` position props supply full-list ARIA positions and count.
ResizeObserver reads layout and token gaps; the existing 50% to 200% thumbnail
control determines fixed widths and wrapping. Switching songs resets the virtual
viewport. The host mounts these panels in the existing right column, with a
content-height preview and the list filling the remainder.

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
The rename dialog reuses the design system's modal/focus behavior. Definition
deletion uses its confirmation dialog. Read-only label settings leave existing
label selection available and explain blocked writes in tooltips. Color swatch
and rename tooltips disclose their library-wide scope. The rename dialog
identifies the current label in the subtitle. Deletion confirmation metadata
states that every song retains its label, and its action tooltip distinguishes
shared-list removal from changing song references (P18).

Color, creation, and deletion use revision-checked settings updates. Rename
flushes every cached song's pending edits, then calls main's
`settings.edit({type: 'labels.rename', name: 'labels', from, to, baseRevision})`.
Main rewrites all affected library songs, including songs never opened here. Own
rename pushes advance each cached session without resetting its history;
current, undo, and redo snapshots all map the renamed label. A concurrent
external slide change instead installs its checked document. Global label
operations temporarily make lyrics read-only, without replacing the picker
button that owns the popup's anchor and focus.

Each source slide owns its hot key; label definitions do not. The selected
slide's recorder accepts physical `KeyA` to `KeyZ` or `Digit0` to `Digit9`
without modifiers, normalizing numpad digits only with Num Lock. Backspace or
Delete clears the key. Assigning a key already used by another source slide in
the song is blocked with a reason. Repeated arrangement entries share the same
source slide and its key; edits use the song's history and persistence path.

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
