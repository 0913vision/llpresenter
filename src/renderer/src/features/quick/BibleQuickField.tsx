import {withLiveBible} from '@core/bible/liveTranslation';
import type {RecentPassage} from '@core/schema/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {QUICK_BIBLE_TRANSITION} from '@core/bible/quickTransition';
import {useRef, useSyncExternalStore} from 'react';
import {commandBindings} from '@core/shortcuts/bindings';
import {editsText, matchesBinding} from '@core/shortcuts/matching';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {isInputMethodKey} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useEffect, useLayoutEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {BiblePreviewOptions} from '@core/bible/source';
import {useShow} from '@renderer/session/show';
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
import {pictures} from '@renderer/rendering/pictures/pictureService';
import {BibleReferenceField} from '../bible/BibleReferenceField';
import {openBiblePassage, showBiblePassage} from '../bible/actions';
import {focusSlideGrid} from '../presentation/focusSlideGrid';
import {PassageDialog} from '../bible/PassageDialog';
import {useBibleDisplayDefaults} from '../bible/useBibleDisplayDefaults';
import {prepareBiblePictures} from '../bible/prepareBiblePictures';

const PICTURE_WAIT_MS = 2500;

async function picturePreparation(
  passage: BibleLookupPassage,
  options: BiblePreviewOptions,
): Promise<boolean> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      prepareBiblePictures(passage, options),
      new Promise<false>(resolve => {
        deadline = setTimeout(() => resolve(false), PICTURE_WAIT_MS);
      }),
    ]);
  } catch (error) {
    console.error('Could not prepare the Bible passage pictures', error);
    return false;
  } finally {
    clearTimeout(deadline);
  }
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
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
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
  const staged = useRef<{
    passage: BibleLookupPassage;
    options: BiblePreviewOptions;
    ready: Promise<boolean>;
  } | null>(null);
  useEffect(
    () => () => {
      staged.current = null;
    },
    [],
  );
  const withPictures = (
    passage: BibleLookupPassage,
    options: BiblePreviewOptions,
    apply: (ready: boolean) => void,
  ): void => {
    if (pictures.drawInPlace) {
      apply(false);
      return;
    }
    const request = beginOutputRequest();
    const version = useLive.getState().commandVersion;
    const previous = staged.current;
    const ready =
      previous?.passage === passage &&
      previous.options.verseNumbers === options.verseNumbers &&
      previous.options.reference === options.reference &&
      previous.options.translationName === options.translationName
        ? previous.ready
        : picturePreparation(passage, options);
    staged.current = {passage, options, ready};
    ready
      .then(drawn => {
        if (
          staged.current?.ready !== ready ||
          !isOutputRequestCurrent(request, version)
        ) {
          return;
        }
        staged.current = null;
        apply(drawn);
      })
      .catch((error: unknown) => console.error(error));
  };
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
  const [document, setDocument] = useState<Extract<
    SettingsDocument,
    {name: 'bible'}
  > | null>(null);
  const [session, setSession] = useState(0);
  useEffect(() => {
    let active = true;
    const accept = (next: SettingsDocument): void => {
      if (active && next.name === 'bible') {
        setDocument(previous =>
          previous && previous.revision >= next.revision ? previous : next,
        );
      }
    };
    const stop = api.settings.subscribe(accept);
    void api.settings.get({name: 'bible'}).then(accept, (error: unknown) => {
      if (active) console.error('Could not read Bible settings', error);
    });
    const stopSelection = useShow.subscribe((next, previous) => {
      const cancelledPreview =
        next.openItemId === null &&
        next.bibleSource === null &&
        previous.bibleSource?.id === previous.openItemId;
      if (
        !cancelledPreview &&
        next.openItemId !== previous.openItemId &&
        !isBibleSource(next, next.openItemId)
      ) {
        setSession(value => value + 1);
      }
    });
    return () => {
      active = false;
      stop();
      stopSelection();
    };
  }, [api.settings]);
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
    showBiblePassage(target, options);
    setOverlayOpen(false);
    finishQuickPassage();
    const id = useShow.getState().openItemId;
    if (id === committed) {
      focusSlideGrid();
      return;
    }
    focusItem.current = id;
    if (!pictures.drawInPlace) {
      // NOTE(0913vision): Give the incoming grid priority in the picture queue
      // after the live command has been sent.
      setTimeout(() => {
        if (useShow.getState().openItemId === id) {
          prepareBiblePictures(target, options).catch((error: unknown) => {
            console.error(
              'Could not prepare the Bible passage pictures',
              error,
            );
          });
        }
      }, 0);
    }
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
        submitAnyField
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
          const source = view.bibleSource;
          if (
            source?.id === view.openItemId &&
            source.enteredRef !== undefined
          ) {
            if (
              equivalent?.ref === source.enteredRef &&
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
                bibleSource: {...source, enteredRef: undefined},
              });
            }
          }
        }}
        onPreview={passage => {
          if (display !== null) {
            const options = {
              ...display,
              review: false,
              transition: QUICK_BIBLE_TRANSITION,
            };
            withPictures(passage, options, ready => {
              if (!overlayOpen) openBiblePassage(passage, options, {ready});
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
      action={'\uB760\uC6B0\uAE30'}
      onClose={closeFinder}
      onSubmit={passage => show(passage)}
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
