import {withLiveBible, QUICK_BIBLE_TRANSITION} from '@core/bible';
import type {RecentPassage} from '@core/schema/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {
  useRef,
  useSyncExternalStore,
  useEffect,
  useLayoutEffect,
  useState,
  type JSX,
} from 'react';
import {commandBindings, editsText, matchesBinding} from '@core/shortcuts';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {isInputMethodKey} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import type {LlpApi} from '@contracts/ipc/api';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import type {BibleSource} from '@renderer/session/bibleSource';
import {selectTile, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {useCommittedShownItem} from '@renderer/session/shownItem';
import {bibleSourceFor, isBibleSource} from '@renderer/session/showLibrary';
import {
  beginQuickPassage,
  finishQuickPassage,
} from '@renderer/session/quickReturn';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/showOutput';
import {BibleReferenceField} from '../bible/BibleReferenceField';
import {
  openBiblePassage,
  preparePassage,
  showBiblePassage,
} from '../bible/actions';
import {focusSlideGrid} from '../presentation/focusSlideGrid';
import {PassageDialog} from '../bible/PassageDialog';
import {useBibleDisplayDefaults} from '../bible/useBibleDisplayDefaults';
import {useAlive} from '@renderer/ui/useAlive';

/** The tile of a source that the entered passage starts with. */
function firstVerseOf(
  {tiles}: BibleSource,
  {verses}: BibleLookupPassage,
): number {
  const [first] = verses;
  return Math.max(
    0,
    tiles.findIndex(
      ({slide}) =>
        slide.verse?.chapter === first?.chapter &&
        slide.verse?.verse === first?.verse,
    ),
  );
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
  const root = useRef<HTMLDivElement>(null);
  const mounted = useAlive();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const finderGeneration = useRef(0);
  const focusItem = useRef<string | null>(null);
  const committed = useCommittedShownItem();
  useLayoutEffect(() => {
    if (focusItem.current !== null && focusItem.current === committed) {
      focusItem.current = null;
      focusSlideGrid();
    }
  }, [committed, overlayOpen]);
  const closeFinder = (): void => {
    finderGeneration.current += 1;
    beginOutputRequest();
    focusItem.current = null;
    setOverlayOpen(false);
  };
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  useWindowShortcuts([
    {
      id: 'bible.focus',
      // NOTE(0913vision): The key that opens the passage finder closes it
      // again, like Escape.
      run: () => {
        if (overlayOpen) closeFinder();
        else setOverlayOpen(true);
      },
    },
  ]);
  useEffect(() => {
    if (overlayOpen) root.current?.querySelector('input')?.focus();
  }, [overlayOpen]);
  const display = useBibleDisplayDefaults(api.preferences);
  const document = useApiSettingsDocument({
    api,
    name: 'bible',
    title: '성경',
    onProblem: undefined,
  });
  const [session, setSession] = useState(0);
  useEffect(() => {
    const stopSelection = useShow.subscribe((next, previous) => {
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
    });
    return stopSelection;
  }, []);
  const translations = document
    ? withLiveBible(document.value.translations)
    : [];
  const currentTranslation =
    display === null
      ? undefined
      : (translations.find(item => item.default) ?? translations[0])?.id;
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
    const target = expanded ? prepared.passage : passage;
    const options = {
      ...(expanded || samePassage ? prepared : display),
      review: false,
      transition: QUICK_BIBLE_TRANSITION,
    };
    beginQuickPassage();
    // NOTE(0913vision): The grid selects the live verse in a passage that has
    // it too; a passage that is not live starts at its first verse.
    if (
      prepared !== null &&
      prepared.id !== useLive.getState().state?.layers.slide?.itemId
    ) {
      selectTile(firstVerseOf(prepared, passage));
    }
    showBiblePassage(target, options);
    setOverlayOpen(false);
    finishQuickPassage();
    const id = useShow.getState().openItemId;
    if (id === committed) {
      focusSlideGrid();
      return;
    }
    focusItem.current = id;
  };
  // NOTE(0913vision): A passage typed whole is looked up as it is typed;
  // cutting it into slides then too, when the window is idle, leaves only
  // the output for Enter.
  const ahead = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (ahead.current !== null) cancelIdleCallback(ahead.current);
    },
    [],
  );
  const prepareAhead = (passage: BibleLookupPassage): void => {
    if (ahead.current !== null) cancelIdleCallback(ahead.current);
    ahead.current = null;
    if (display === null) return;
    const options = {...display, transition: QUICK_BIBLE_TRANSITION};
    ahead.current = requestIdleCallback(
      () => {
        ahead.current = null;
        preparePassage(passage, options);
      },
      {timeout: 250},
    );
  };
  const pick = async (recent: RecentPassage): Promise<void> => {
    if (display === null) return;
    onIntent?.();
    setSession(value => value + 1);
    const request = beginOutputRequest();
    const version = useLive.getState().commandVersion;
    const finderRequest = overlayOpen;
    const finderAtStart = finderGeneration.current;
    try {
      const reply = await api.bible.lookup({
        input: recent.ref,
        translation: recent.translation,
      });
      if (
        mounted.current &&
        (!finderRequest || finderGeneration.current === finderAtStart) &&
        reply.result.ok &&
        isOutputRequestCurrent(request, version)
      ) {
        show(reply.result.value, false);
      }
    } catch (error) {
      console.error('Could not read recent Bible passage', error);
    }
  };
  const field = (
    <div
      ref={root}
      onKeyDownCapture={event => {
        // NOTE(0913vision): The finder is a dialog that keeps its keys, so
        // the key that opened it closes it from inside, also while typing.
        if (
          overlayOpen &&
          !isInputMethodKey(event.nativeEvent) &&
          !editsText(event.nativeEvent) &&
          commandBindings('bible.focus', bindings).some(binding =>
            matchesBinding(event.nativeEvent, binding),
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) closeFinder();
        }
      }}
    >
      <BibleReferenceField
        overlayLabels={overlayOpen}
        onEscape={overlayOpen ? closeFinder : undefined}
        key={`${selectionVersion}:${session}`}
        api={api.bible}
        translation={currentTranslation}
        recents={[]}
        onIntent={() => {
          beginOutputRequest();
          focusItem.current = null;
          onIntent?.();
        }}
        onEdit={equivalent => {
          const view = useShow.getState();
          const source = bibleSourceFor(view, view.openItemId);
          if (source?.enteredRef !== undefined) {
            if (
              equivalent !== null &&
              equivalent.ref === source.enteredRef &&
              (source.enteredTranslation ?? source.passage.translation) ===
                equivalent.translation &&
              display !== null
            ) {
              openBiblePassage(equivalent, {
                ...display,
                review: false,
                transition: QUICK_BIBLE_TRANSITION,
              });
            } else {
              useShow.setState({
                bibleSources: view.bibleSources.map(entry =>
                  entry === source ? {...source, enteredRef: undefined} : entry,
                ),
              });
            }
          }
        }}
        onPreview={passage => {
          if (display !== null && !overlayOpen) {
            openBiblePassage(passage, {
              ...display,
              review: false,
              transition: QUICK_BIBLE_TRANSITION,
            });
          }
        }}
        onShow={passage => show(passage)}
      />
    </div>
  );
  return overlayOpen ? (
    <PassageDialog
      api={api.bible}
      translation={currentTranslation}
      translations={translations}
      recents={document?.value.recents ?? []}
      action="띄우기"
      onClose={closeFinder}
      onSubmit={passage => show(passage)}
      onAhead={prepareAhead}
      onPick={recent => {
        pick(recent).catch((error: unknown) => console.error(error));
      }}
      onIntent={() => {
        beginOutputRequest();
        focusItem.current = null;
        onIntent?.();
      }}
      onKeyDownCapture={event => {
        if (
          !isInputMethodKey(event.nativeEvent) &&
          !editsText(event.nativeEvent) &&
          commandBindings('bible.focus', bindings).some(binding =>
            matchesBinding(event.nativeEvent, binding),
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat) closeFinder();
        }
      }}
    />
  ) : (
    field
  );
}
