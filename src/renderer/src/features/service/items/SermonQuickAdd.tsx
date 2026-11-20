import {useRef, useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {SLIDES_LIMITS, type ServiceItemOf} from '@core/schema/service';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {TextArea} from '@renderer/ui/TextArea';
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
  const choose = (value: BibleLookupPassage | null): void => {
    if (value === null || defaults === null || title.trim() === '') return;
    const unchanged = initial !== undefined && !referenceEdited.current;
    onInsert(title.trim(), unchanged ? initial.sermon.passage.ref : value.ref, {
      ...defaults,
      translation: unchanged
        ? initial.sermon.passage.translation
        : value.translation,
      passage: value,
    });
  };
  if (window.llp === undefined) return null;
  return (
    <BiblePassageDialog
      api={window.llp.bible}
      initialRef={initial?.sermon.passage.ref}
      translation={initial?.sermon.passage.translation ?? defaults?.translation}
      action={initial === undefined ? '\uCD94\uAC00' : '\uBCC0\uACBD'}
      disabled={title.trim() === '' || defaults === null}
      onReferenceEdit={() => {
        referenceEdited.current = true;
      }}
      onClose={onClose}
      onChoose={choose}
    >
      <div className={styles.fields}>
        <TextArea
          aria-label={'\uC81C\uBAA9'}
          placeholder={'\uC81C\uBAA9'}
          value={title}
          rows={2}
          maxLength={SLIDES_LIMITS.name}
          autoFocus
          onChange={setTitle}
          onKeyDown={event => {
            if (event.key === 'Enter') event.stopPropagation();
          }}
        />
      </div>
    </BiblePassageDialog>
  );
}
