import {useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {SLIDES_LIMITS} from '@core/schema/service';
import {BibleReferenceForm} from '@renderer/features/bible/BibleReferenceForm';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import {useBibleDefaults} from './useBibleDefaults';
import type {PassageDefaults} from './quickAddBible';
import styles from './SermonQuickAdd.module.css';

export function SermonQuickAdd({
  onInsert,
  onClose,
}: {
  readonly onInsert: (
    title: string,
    ref: string,
    defaults: PassageDefaults,
  ) => void;
  readonly onClose: () => void;
}): JSX.Element | null {
  const defaults = useBibleDefaults();
  const [title, setTitle] = useState('');
  const [passage, setPassage] = useState<BibleLookupPassage | null>(null);
  const choose = (value: BibleLookupPassage | null): void => {
    if (value === null || defaults === null || title.trim() === '') return;
    onInsert(title.trim(), value.ref, {
      ...defaults,
      translation: value.translation,
    });
  };
  if (window.llp === undefined) return null;
  return (
    <Dialog
      title={'\uc124\uad50'}
      size="s"
      onCancel={onClose}
      primary={{
        label: '\ucd94\uac00',
        disabled: title.trim() === '' || passage === null,
        onSelect: () => choose(passage),
      }}
    >
      <div className={styles.fields}>
        <TextField
          aria-label={'\uc81c\ubaa9'}
          placeholder={'\uc81c\ubaa9'}
          value={title}
          onChange={setTitle}
          maxLength={SLIDES_LIMITS.name}
          block
          autoFocus
        />
        <BibleReferenceForm
          api={window.llp.bible}
          translation={defaults?.translation}
          onReady={setPassage}
          onPreview={() => undefined}
          onSubmit={choose}
          onEscape={onClose}
        />
      </div>
    </Dialog>
  );
}
