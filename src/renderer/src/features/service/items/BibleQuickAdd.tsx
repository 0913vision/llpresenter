import {type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {useBibleDefaults} from './useBibleDefaults';
import type {PassageDefaults} from './quickAddBible';

/** Inserts a validated passage with the defaults read for this opening. */
export function BibleQuickAdd({
  onInsert,
  onClose,
}: {
  readonly onInsert: (ref: string, defaults: PassageDefaults) => void;
  readonly onClose: () => void;
}): JSX.Element | null {
  const defaults = useBibleDefaults();
  const insert = (value: BibleLookupPassage | null): void => {
    if (value === null || defaults === null) return;
    onInsert(value.ref, defaults);
    onClose();
  };
  return window.llp === undefined ? null : (
    <BiblePassageDialog
      api={window.llp.bible}
      translation={defaults?.translation}
      onChoose={insert}
      onClose={onClose}
    />
  );
}
