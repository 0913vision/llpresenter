import {withLiveBible} from '@core/bible/liveTranslation';
import {useEffect, useRef, useState, type JSX} from 'react';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {RecentPassage} from '@core/schema/bible';
import type {TranslationId} from '@core/schema/ids';
import {Dialog} from '@renderer/ui/Dialog';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {BibleReferenceForm} from './BibleReferenceForm';
import {RecentPassages} from './RecentPassages';

/** Shares validated passage entry between service insertion and verse slide insertion. */
export function BiblePassageDialog({
  api,
  translation,
  limit,
  onChoose,
  onClose,
}: {
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly limit?: number;
  readonly onChoose: (passage: BibleLookupPassage) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [passage, setPassage] = useState<BibleLookupPassage | null>(null);
  const [resolving, setResolving] = useState(false);
  const [recent, setRecent] = useState<{
    value: RecentPassage;
    generation: number;
  } | null>(null);
  const document = useSettingsDocument('bible', '성경', undefined);
  const generation = useRef(0);
  const pending = useRef<number | null>(null);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const fits = (value: BibleLookupPassage): boolean =>
    limit === undefined || value.verses.length <= limit;
  const choose = (value: BibleLookupPassage | null): void => {
    if (value !== null && fits(value)) onChoose(value);
  };
  const pick = (value: RecentPassage): void => {
    const request = ++generation.current;
    pending.current = request;
    setRecent({value, generation: request});
    setPassage(null);
    setResolving(true);
    api
      .lookup({input: value.ref, translation: value.translation})
      .then(reply => {
        if (generation.current !== request) return;
        pending.current = null;
        setResolving(false);
        if (reply.result.ok) {
          setPassage(reply.result.value);
          choose(reply.result.value);
        }
      })
      .catch((error: unknown) => {
        if (generation.current === request) {
          pending.current = null;
          setResolving(false);
          console.error('Could not read recent Bible passage', error);
        }
      });
  };
  return (
    <Dialog
      title="성경 구절"
      size="s"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: resolving || passage === null || !fits(passage),
        title:
          passage !== null && !fits(passage)
            ? '슬라이드가 너무 많아 추가할 수 없습니다'
            : undefined,
        onSelect: () => choose(passage),
      }}
    >
      <BibleReferenceForm
        key={recent === null ? 'initial' : recent.generation}
        api={api}
        initialRef={recent?.value.ref}
        translation={recent?.value.translation ?? translation}
        onIntent={() => {
          generation.current += 1;
          pending.current = null;
          setResolving(false);
        }}
        onReady={value => {
          if (pending.current === null) setPassage(value);
        }}
        onPreview={() => undefined}
        onSubmit={choose}
        onEscape={onClose}
        autoFocus
      />
      <RecentPassages
        scope="dialog"
        recents={document?.value.recents ?? []}
        translations={withLiveBible(document?.value.translations ?? [])}
        translation={recent?.value.translation ?? translation}
        onPick={pick}
      />
    </Dialog>
  );
}
