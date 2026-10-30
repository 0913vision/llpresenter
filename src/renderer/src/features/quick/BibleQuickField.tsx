import {useEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {useShow} from '@renderer/session/show';
import {bibleSourceFor, isBibleSource} from '@renderer/session/showLibrary';
import {beginOutputRequest} from '@renderer/session/showOutput';
import {BibleReferenceField} from '../bible/BibleReferenceField';
import {openBiblePassage, showBiblePassage} from '../bible/actions';
import {useBibleVerseNumbers} from '../bible/useBibleVerseNumbers';

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
  const verseNumbers = useBibleVerseNumbers(api.preferences);
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
      if (
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
  const translations = document?.value.translations ?? [];
  return (
    <BibleReferenceField
      key={`${selectionVersion}:${session}`}
      api={api.bible}
      translation={
        verseNumbers === null
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
        if (source?.id === view.openItemId && source.enteredRef !== undefined) {
          if (
            equivalent?.ref === source.enteredRef &&
            (source.enteredTranslation ?? source.passage.translation) ===
              equivalent.translation &&
            verseNumbers !== null
          ) {
            openBiblePassage(equivalent, {verseNumbers});
          } else {
            useShow.setState({bibleSource: {...source, enteredRef: undefined}});
          }
        }
      }}
      onPreview={passage => {
        if (verseNumbers !== null) {
          openBiblePassage(passage, {verseNumbers});
        }
      }}
      onShow={passage => {
        const view = useShow.getState();
        const prepared = bibleSourceFor(view, view.openItemId);
        const expanded =
          prepared?.enteredRef === passage.ref &&
          (prepared.enteredTranslation ?? prepared.passage.translation) ===
            passage.translation;
        showBiblePassage(expanded ? prepared.passage : passage);
      }}
    />
  );
}
