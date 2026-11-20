import {withLiveBible} from '@core/bible/liveTranslation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type JSX,
  type ReactNode,
} from 'react';
import type {BibleLookupApi} from '@contracts/ipc/bible';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {RecentPassage} from '@core/schema/bible';
import type {TranslationId} from '@core/schema/ids';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {PassageDialog} from './PassageDialog';

/** Resolves selected recent passages before handing them to the add flow. */
export function BiblePassageDialog({
  api,
  translation,
  limit,
  onChoose,
  onClose,
  initialRef,
  children,
  disabled = false,
  action = '\uCD94\uAC00',
  onReferenceEdit,
}: {
  readonly api: BibleLookupApi;
  readonly translation: TranslationId | undefined;
  readonly limit?: number | undefined;
  readonly onChoose: (passage: BibleLookupPassage) => void;
  readonly onClose: () => void;
  readonly initialRef?: string | undefined;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly action?: string;
  readonly onReferenceEdit?: (() => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('bible', '\uC131\uACBD', undefined);
  const generation = useRef(0);
  const current = useRef({onChoose, disabled, limit});
  useLayoutEffect(() => {
    current.current = {onChoose, disabled, limit};
  }, [onChoose, disabled, limit]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const choose = (value: BibleLookupPassage): void => {
    if (
      !current.current.disabled &&
      (current.current.limit === undefined ||
        value.verses.length <= current.current.limit)
    ) {
      current.current.onChoose(value);
    }
  };
  const pick = (value: RecentPassage): void => {
    onReferenceEdit?.();
    const request = ++generation.current;
    api
      .lookup({input: value.ref, translation: value.translation})
      .then(reply => {
        if (generation.current === request && reply.result.ok) {
          choose(reply.result.value);
        }
      })
      .catch((error: unknown) => {
        if (generation.current === request) {
          console.error('Could not read recent Bible passage', error);
        }
      });
  };
  return (
    <PassageDialog
      api={api}
      translation={translation}
      translations={withLiveBible(document?.value.translations ?? [])}
      recents={document?.value.recents ?? []}
      action={action}
      initialRef={initialRef}
      disabled={disabled}
      onClose={onClose}
      onSubmit={choose}
      onPick={pick}
      onIntent={() => {
        generation.current += 1;
        onReferenceEdit?.();
      }}
    >
      {children}
    </PassageDialog>
  );
}
