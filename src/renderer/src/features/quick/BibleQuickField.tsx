import {withLiveBible, QUICK_BIBLE_TRANSITION} from '@core/bible';
import type {RecentPassage} from '@core/schema/bible/bible';
import type {BibleLookupPassage} from '@core/schema/bible/bibleLookup';
import {useEffect, useLayoutEffect, useRef, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {useApiSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import type {BibleDisplay} from '@renderer/session/show/bibleSource';
import {useLive} from '@renderer/session/live';
import {
  beginQuickPassage,
  finishQuickPassage,
} from '@renderer/session/show/quickReturn';
import {selectTile} from '@renderer/session/show/show';
import {
  bibleSourceFor,
  isBibleSource,
} from '@renderer/session/show/showLibrary';
import {useCommittedShownItem} from '@renderer/session/show/shownItem';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/show/showOutput';
import {useAlive} from '@renderer/ui/useAlive';
import {
  openBiblePassage,
  preparePassage,
  showBiblePassage,
} from '../bible/passageActions';
import {BibleReferenceField} from '../bible/reference/BibleReferenceField';
import {PassageDialog} from '../bible/finder/PassageDialog';
import {useBibleDisplayDefaults} from './useBibleDisplayDefaults';
import {focusSlideGrid} from '../presentation/focusSlideGrid';
import {firstVerseOf, followQuickEdit, quickDisplay} from './quickPassage';
import {usePassageFinder} from './usePassageFinder';
import {useShow} from '@renderer/session/show/showStore';

/**
 * Puts the keyboard on the slide grid once the item a passage opened is the
 * one the grid shows.
 */
function useGridFocusAfterShow(recheck: boolean) {
  const committed = useCommittedShownItem();
  const waiting = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (waiting.current !== null && waiting.current === committed) {
      waiting.current = null;
      focusSlideGrid();
    }
  }, [committed, recheck]);
  return {
    after: (itemId: string | null): void => {
      if (itemId === committed) {
        focusSlideGrid();
        return;
      }
      waiting.current = itemId;
    },
    cancel: (): void => {
      waiting.current = null;
    },
  };
}

/**
 * Starts the quick field over, empty, when the operator opens another item
 * than a passage; leaving a passage preview open keeps what was typed.
 */
function useFieldSession() {
  const [session, setSession] = useState(0);
  useEffect(
    () =>
      useShow.subscribe((next, previous) => {
        const cancelledPreview =
          next.openItemId === null &&
          isBibleSource(previous, previous.openItemId);
        if (
          !cancelledPreview &&
          next.openItemId !== previous.openItemId &&
          !isBibleSource(next, next.openItemId)
        ) {
          setSession(value => value + 1);
        }
      }),
    [],
  );
  return {session, restart: () => setSession(value => value + 1)};
}

/**
 * Cuts a passage typed whole into slides while the window is idle, as soon as
 * its lookup is back, so Enter only has to put it out.
 */
function usePrepareAhead(display: BibleDisplay | null) {
  const pending = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pending.current !== null) cancelIdleCallback(pending.current);
    },
    [],
  );
  return (passage: BibleLookupPassage): void => {
    if (pending.current !== null) cancelIdleCallback(pending.current);
    pending.current = null;
    if (display === null) return;
    const options = {...display, transition: QUICK_BIBLE_TRANSITION};
    pending.current = requestIdleCallback(
      () => {
        pending.current = null;
        preparePassage(passage, options);
      },
      {timeout: 250},
    );
  };
}

/** The quick-panel mount; previewing never writes output or recent history. */
export function BibleQuickField({
  api,
  selectionVersion = 0,
  onIntent,
}: {
  readonly api: LlpApi;
  readonly selectionVersion?: number;
  readonly onIntent?: (() => void) | undefined;
}): JSX.Element {
  const mounted = useAlive();
  const display = useBibleDisplayDefaults(api.preferences);
  const document = useApiSettingsDocument({
    api,
    name: 'bible',
    title: '성경',
    onProblem: undefined,
  });
  const translations = document
    ? withLiveBible(document.value.translations)
    : [];
  const currentTranslation =
    display === null
      ? undefined
      : (translations.find(item => item.default) ?? translations[0])?.id;
  const [finderOpen, setFinderOpen] = useState(false);
  const gridFocus = useGridFocusAfterShow(finderOpen);
  const finder = usePassageFinder({
    open: finderOpen,
    setOpen: setFinderOpen,
    onClose: gridFocus.cancel,
  });
  const field = useFieldSession();
  const prepareAhead = usePrepareAhead(display);

  /** The operator starts something new: earlier output requests give way. */
  const intent = (): void => {
    beginOutputRequest();
    gridFocus.cancel();
    onIntent?.();
  };

  /**
   * Puts a passage out. A passage that the open preview already shows is put
   * out as it is cut there, starting at the verse the operator asked for.
   */
  const show = (passage: BibleLookupPassage, reusePreview = true): void => {
    if (display === null) return;
    const view = useShow.getState();
    const prepared = bibleSourceFor(view, view.openItemId);
    const expanded =
      reusePreview &&
      prepared?.enteredRef === passage.ref &&
      (prepared.enteredTranslation ?? prepared.passage.translation) ===
        passage.translation;
    const samePassage =
      prepared?.passage.ref === passage.ref &&
      prepared.passage.translation === passage.translation;
    beginQuickPassage();
    // NOTE(0913vision): An entered passage starts at its first verse, also
    // when it is the live one typed again.
    if (prepared !== null) selectTile(firstVerseOf(prepared, passage));
    showBiblePassage(
      expanded ? prepared.passage : passage,
      quickDisplay(expanded || samePassage ? prepared : display),
    );
    setFinderOpen(false);
    finishQuickPassage();
    gridFocus.after(useShow.getState().openItemId);
  };

  /** Puts a recent passage out, unless something newer came first. */
  const pick = async (recent: RecentPassage): Promise<void> => {
    if (display === null) return;
    onIntent?.();
    field.restart();
    const request = beginOutputRequest();
    const version = useLive.getState().commandVersion;
    const fromFinder = finderOpen;
    const finderAtStart = finder.generation();
    try {
      const reply = await api.bible.lookup({
        input: recent.ref,
        translation: recent.translation,
      });
      const stillWanted =
        mounted.current &&
        (!fromFinder || finder.generation() === finderAtStart) &&
        isOutputRequestCurrent(request, version);
      if (stillWanted && reply.result.ok) show(reply.result.value, false);
    } catch (error) {
      console.error('Could not read recent Bible passage', error);
    }
  };

  if (finderOpen) {
    return (
      <PassageDialog
        api={api.bible}
        translation={currentTranslation}
        translations={translations}
        recents={document?.value.recents ?? []}
        action="띄우기"
        onClose={finder.close}
        onSubmit={passage => show(passage)}
        onAhead={prepareAhead}
        onPick={recent => {
          pick(recent).catch((error: unknown) => console.error(error));
        }}
        onIntent={intent}
        onKeyDownCapture={finder.focusOnOwnKey}
      />
    );
  }
  return (
    <BibleReferenceField
      key={`${selectionVersion}:${field.session}`}
      api={api.bible}
      translation={currentTranslation}
      recents={[]}
      onIntent={intent}
      onEdit={equivalent => followQuickEdit(equivalent, display)}
      onPreview={passage => {
        if (display !== null) openBiblePassage(passage, quickDisplay(display));
      }}
      onShow={passage => show(passage)}
    />
  );
}
