import type {JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import type {PassageDefaults} from './passageItems';
import {useBibleDefaults} from './useBibleDefaults';

/** Asks for a passage, with the settings of a new one. */
export function BibleQuickAdd({
  onInsert,
  onClose,
}: {
  readonly onInsert: (
    passage: BibleLookupPassage,
    defaults: PassageDefaults,
  ) => void;
  readonly onClose: () => void;
}): JSX.Element | null {
  const defaults = useBibleDefaults();
  return window.llp === undefined ? null : (
    <BiblePassageDialog
      api={window.llp.bible}
      translation={defaults?.translation}
      onChoose={passage => {
        if (defaults === null) return;
        onInsert(passage, defaults);
        onClose();
      }}
      onClose={onClose}
    />
  );
}
