import {useEffect, useState, type JSX} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {useShow} from '@renderer/state/show';
import {isBibleSource} from '@renderer/state/showLibrary';
import {BibleReferenceField} from '../bible/BibleReferenceField';
import {openBiblePassage, showBiblePassage} from '../bible/actions';

/** The quick-panel mount; previewing never writes output or recent history. */
export function BibleQuickField({api}: {readonly api: LlpApi}): JSX.Element {
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
      key={session}
      api={api.bible}
      translation={
        (translations.find(item => item.default) ?? translations[0])?.id
      }
      recents={document?.value.recents ?? []}
      onPreview={openBiblePassage}
      onShow={showBiblePassage}
    />
  );
}
