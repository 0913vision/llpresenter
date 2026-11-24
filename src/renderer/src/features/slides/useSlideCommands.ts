import {
  NEWER_FILE_REASON,
  NOTHING_TO_REDO,
  NOTHING_TO_UNDO,
} from '@renderer/platform/problemReasons';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';
import {isInTextEntry} from '@renderer/ui/fields/textEntry';
import {
  addReason,
  copyReason,
  copySelected,
  deleteSelected,
  duplicateSelected,
  pasteInto,
  removeReason,
  selectionReason,
} from './deckCommands';
import {selectInDeck} from './deckSelection';
import {clipboardText} from './slideClipboard';
import type {SlideDeck} from './slideDeck';
import {FIXED_KEYS} from '@renderer/ui/keys/fixedKeys';

type History = 'undo' | 'redo';

/** The commands of a list of slides that both its keys and its menu run. */
export interface SlideCommands {
  readonly focusSurface: () => void;
  readonly paste: () => void;
  readonly cut: () => void;
  readonly remove: () => void;
  readonly replay: (kind: History) => void;
  readonly replayReason: (kind: History) => string | undefined;
}

/**
 * The clipboard, delete and history commands of a list of slides, and the
 * keys that run them while the focus is in the list.
 */
export function useSlideCommands({
  deck,
  surface,
  count,
  openLabels,
}: {
  readonly deck: SlideDeck;
  /** The element of the list, once it is there. */
  readonly surface: () => HTMLElement | null;
  /** The chosen slides. */
  readonly count: number;
  readonly openLabels: () => void;
}): SlideCommands {
  const focusSurface = (): void => surface()?.focus({preventScroll: true});
  const paste = (): void => {
    if (addReason(deck) !== undefined) return;
    focusSurface();
    clipboardText().then(
      text => {
        if (
          surface()?.contains(document.activeElement) === true &&
          !isInTextEntry(document.activeElement)
        ) {
          pasteInto(deck, text);
        }
      },
      (error: unknown) => console.error('Could not read the clipboard', error),
    );
  };
  const cut = (): void => {
    if (removeReason(deck) !== undefined) return;
    focusSurface();
    copySelected(deck);
    deleteSelected(deck);
  };
  const remove = (): void => {
    if (removeReason(deck) !== undefined) return;
    const {slides} = deck;
    deleteSelection(
      count,
      () => deck.slides === slides && !deck.readOnly,
      () => {
        focusSurface();
        deleteSelected(deck);
      },
    );
  };
  const replay = (kind: History): void => {
    focusSurface();
    deck.replay(kind);
  };
  const replayReason = (kind: History): string | undefined => {
    if (deck.readOnly) return NEWER_FILE_REASON;
    if (kind === 'undo') return deck.canUndo ? undefined : NOTHING_TO_UNDO;
    return deck.canRedo ? undefined : NOTHING_TO_REDO;
  };
  const owns = (event: KeyboardEvent): boolean =>
    event.target instanceof Node &&
    surface()?.contains(event.target) === true &&
    !isInTextEntry(event.target);
  useWindowShortcuts([
    {
      id: 'editor.labelMenu',
      context: 'song',
      when: owns,
      unavailable: () => selectionReason(deck),
      run: openLabels,
    },
    {
      id: 'edit.copy',
      fixedBindings: [FIXED_KEYS.copy],
      context: 'song',
      when: owns,
      unavailable: () => copyReason(deck),
      run: () => copySelected(deck),
    },
    {
      id: 'edit.cut',
      fixedBindings: [FIXED_KEYS.cut],
      context: 'song',
      when: owns,
      unavailable: () => removeReason(deck),
      run: cut,
    },
    {
      id: 'edit.paste',
      fixedBindings: [FIXED_KEYS.paste],
      context: 'song',
      when: owns,
      unavailable: () => addReason(deck),
      run: paste,
    },
    {
      id: 'edit.selectAll',
      fixedBindings: [FIXED_KEYS.selectAll],
      context: 'song',
      when: owns,
      run: () => selectInDeck(deck, {type: 'all'}),
    },
    {
      id: 'edit.duplicate',
      context: 'song',
      when: owns,
      unavailable: () => selectionReason(deck) ?? addReason(deck, count),
      run: () => duplicateSelected(deck),
    },
    {
      id: 'edit.delete',
      context: 'song',
      when: owns,
      unavailable: () => removeReason(deck),
      run: remove,
    },
    {
      id: 'edit.undo',
      context: 'song',
      when: owns,
      unavailable: () => replayReason('undo'),
      run: () => replay('undo'),
    },
    {
      id: 'edit.redo',
      context: 'song',
      when: owns,
      unavailable: () => replayReason('redo'),
      run: () => replay('redo'),
    },
  ]);
  return {focusSurface, paste, cut, remove, replay, replayReason};
}
