import {withLiveBible} from '@core/bible/liveTranslation';
import {recentPassages} from '@core/bible/bibleRecents';
import {displayReference} from '@core/bible/displayReference';
import {shortcutNames} from '@core/shortcuts/keys';
import type {RecentPassage} from '@core/schema/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {QUICK_BIBLE_TRANSITION} from '@core/bible/quickTransition';
import {useRef, useSyncExternalStore} from 'react';
import {commandBindings} from '@core/shortcuts/bindings';
import {editsText, matchesBinding} from '@core/shortcuts/matching';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {isInputMethodKey} from '@renderer/ui/commandDispatcher';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {useShow} from '@renderer/session/show';
import {bibleSourceFor, isBibleSource} from '@renderer/session/showLibrary';
import {
  beginQuickPassage,
  finishQuickPassage,
} from '@renderer/session/quickReturn';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
} from '@renderer/session/showOutput';
import {useLive} from '@renderer/session/live';
import {BibleReferenceField} from '../bible/BibleReferenceField';
import {openBiblePassage, showBiblePassage} from '../bible/actions';
import {focusSlideGrid} from '../presentation/focusSlideGrid';
import {DraftOverlay} from '../presentation/DraftOverlay';
import {useBibleDisplayDefaults} from '../bible/useBibleDisplayDefaults';
import styles from './BibleQuickField.module.css';

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
  const bindings = useSyncExternalStore(
    commandBindingStore.subscribe,
    commandBindingStore.get,
  );
  useWindowShortcuts([
    {
      id: 'bible.focus',
      // NOTE(0913vision): The key that opens the passage finder closes it
      // again, like Escape.
      run: () => setOverlayOpen(open => !open),
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
  const recents = recentPassages(document?.value.recents ?? []).slice(0, 5);
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
    const options = expanded || samePassage ? prepared : display;
    beginQuickPassage();
    showBiblePassage(expanded ? prepared.passage : passage, {
      ...options,
      review: false,
      transition: QUICK_BIBLE_TRANSITION,
    });
    setOverlayOpen(false);
    finishQuickPassage();
    focusSlideGrid();
  };
  const pick = async (recent: RecentPassage): Promise<void> => {
    if (display === null) return;
    onIntent?.();
    setSession(value => value + 1);
    const request = beginOutputRequest();
    const version = useLive.getState().commandVersion;
    try {
      const reply = await api.bible.lookup({
        input: recent.ref,
        translation: recent.translation,
      });
      if (
        mounted.current &&
        reply.result.ok &&
        isOutputRequestCurrent(request, version)
      ) {
        show(reply.result.value, false);
      }
    } catch (error) {
      console.error('Could not read recent Bible passage', error);
    }
  };
  useWindowShortcuts(
    Array.from({length: 5}, (_, index) => ({
      id: `bible.recent${index + 1}`,
      when: () => recents[index] !== undefined && display !== null,
      run: () => {
        const recent = recents[index];
        return recent === undefined ? undefined : pick(recent);
      },
    })),
  );
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
          if (!event.repeat) setOverlayOpen(false);
        }
      }}
    >
      <BibleReferenceField
        overlayLabels={overlayOpen}
        onEscape={overlayOpen ? () => setOverlayOpen(false) : undefined}
        submitAnyField
        key={`${selectionVersion}:${session}`}
        api={api.bible}
        translation={
          display === null
            ? undefined
            : (translations.find(item => item.default) ?? translations[0])?.id
        }
        recents={[]}
        onIntent={() => {
          beginOutputRequest();
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
            openBiblePassage(passage, {
              ...display,
              review: false,
              transition: QUICK_BIBLE_TRANSITION,
            });
          }
        }}
        onShow={passage => show(passage)}
      />
      <div className={styles.recents} aria-label="최근 성경 구절">
        {Array.from({length: 5}, (_, index) => {
          const recent = recents[index];
          const binding = commandBindings(
            `bible.recent${index + 1}`,
            bindings,
          )[0];
          return (
            <div className={styles.recentSlot} key={index}>
              {recent ? (
                <button
                  type="button"
                  className={styles.recent}
                  onClick={() => {
                    pick(recent).catch((error: unknown) =>
                      console.error(error),
                    );
                  }}
                >
                  <span>{index + 1}</span>
                  <span className={styles.ref}>
                    {displayReference(recent.ref)}
                  </span>
                  {binding ? (
                    <span className={styles.keys}>
                      {shortcutNames(binding).join('+')}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
  return overlayOpen ? (
    <DraftOverlay kind="bible" onClose={() => setOverlayOpen(false)}>
      {field}
    </DraftOverlay>
  ) : (
    field
  );
}
