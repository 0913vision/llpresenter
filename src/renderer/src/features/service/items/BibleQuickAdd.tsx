import {useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {Dialog} from '@renderer/ui/Dialog';
import {BibleReferenceForm} from '@renderer/features/bible/BibleReferenceForm';
import {useBibleDefaults} from './useBibleDefaults';
import type {PassageDefaults} from './quickAddBible';

/** Inserts a validated passage with the defaults read for this opening. */
export function BibleQuickAdd({
  onInsert,
  onClose,
}: {
  readonly onInsert: (ref: string, defaults: PassageDefaults) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const defaults = useBibleDefaults();
  const [passage, setPassage] = useState<BibleLookupPassage | null>(null);
  const insert = (value: BibleLookupPassage | null): void => {
    if (value === null || defaults === null) return;
    onInsert(value.ref, defaults);
    onClose();
  };
  return (
    <Dialog
      title="성경 구절"
      size="s"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: passage === null,
        onSelect: () => insert(passage),
      }}
    >
      {window.llp === undefined ? null : (
        <BibleReferenceForm
          api={window.llp.bible}
          translation={defaults?.translation}
          onReady={setPassage}
          onPreview={() => undefined}
          onSubmit={insert}
          autoFocus
        />
      )}
    </Dialog>
  );
}
