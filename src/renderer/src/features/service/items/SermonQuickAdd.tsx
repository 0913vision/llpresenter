import {useRef, useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {SLIDES_LIMITS, type ServiceItemOf} from '@core/schema/service';
import {BibleReferenceForm} from '@renderer/features/bible/BibleReferenceForm';
import {Dialog} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import {useBibleDefaults} from './useBibleDefaults';
import type {PassageDefaults} from './quickAddBible';
import styles from './SermonQuickAdd.module.css';

export function SermonQuickAdd({
  onInsert,
  onClose,
  initial,
}: {
  readonly initial?: ServiceItemOf<'sermon'> | undefined;
  readonly onInsert: (
    title: string,
    ref: string,
    defaults: PassageDefaults,
  ) => void;
  readonly onClose: () => void;
}): JSX.Element | null {
  const defaults = useBibleDefaults();
  const [title, setTitle] = useState(initial?.sermon.title ?? '');
  const referenceEdited = useRef(false);
  const [passage, setPassage] = useState<BibleLookupPassage | null>(null);
  const choose = (value: BibleLookupPassage | null): void => {
    if (value === null || defaults === null || title.trim() === '') return;
    const unchanged = initial !== undefined && !referenceEdited.current;
    onInsert(title.trim(), unchanged ? initial.sermon.passage.ref : value.ref, {
      ...defaults,
      translation: unchanged
        ? initial.sermon.passage.translation
        : value.translation,
    });
  };
  if (window.llp === undefined) return null;
  return (
    <Dialog
      title={'\uc124\uad50'}
      closeOnOutside={initial !== undefined}
      size="s"
      onCancel={onClose}
      primary={{
        label: initial === undefined ? '\ucd94\uac00' : '\ubcc0\uacbd',
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
          initialRef={initial?.sermon.passage.ref}
          translation={
            initial?.sermon.passage.translation ?? defaults?.translation
          }
          onReady={setPassage}
          onEdit={() => {
            referenceEdited.current = true;
          }}
          onPreview={() => undefined}
          onSubmit={choose}
          onEscape={onClose}
        />
      </div>
    </Dialog>
  );
}
