import {withLiveBible} from '@core/bible/liveTranslation';
import {useRef} from 'react';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {useShow} from '@renderer/session/show';
import {bibleSourceFor, isBibleSource} from '@renderer/session/showLibrary';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {BibleReferenceField} from '../bible/BibleReferenceField';
import {openBiblePassage, showBiblePassage} from '../bible/actions';
import {useBibleDisplayDefaults} from '../bible/useBibleDisplayDefaults';

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
  useWindowShortcuts([
    {
      id: 'bible.focus',
      run: () => root.current?.querySelector('input')?.focus(),
    },
  ]);
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
  const translations = withLiveBible(document?.value.translations ?? []);
  return (
    <div ref={root}>
      <BibleReferenceField
        key={`${selectionVersion}:${session}`}
        api={api.bible}
        translation={
          display === null
            ? undefined
            : (translations.find(item => item.default) ?? translations[0])?.id
        }
        recents={document?.value.recents ?? []}
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
              openBiblePassage(equivalent, {...display, review: false});
            } else {
              useShow.setState({
                bibleSource: {...source, enteredRef: undefined},
              });
            }
          }
        }}
        onPreview={passage => {
          if (display !== null) {
            openBiblePassage(passage, {...display, review: false});
          }
        }}
        onShow={passage => {
          if (display === null) return;
          const view = useShow.getState();
          const prepared = bibleSourceFor(view, view.openItemId);
          const expanded =
            prepared?.enteredRef === passage.ref &&
            (prepared.enteredTranslation ?? prepared.passage.translation) ===
              passage.translation;
          const samePassage =
            prepared?.passage.ref === passage.ref &&
            prepared.passage.translation === passage.translation;
          const options = expanded || samePassage ? prepared : display;
          showBiblePassage(expanded ? prepared.passage : passage, {
            ...options,
            review: false,
          });
        }}
      />
    </div>
  );
}
