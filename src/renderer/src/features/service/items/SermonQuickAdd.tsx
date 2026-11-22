import {useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {SLIDE_LIMITS} from '@core/schema/slide';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {TextArea} from '@renderer/ui/TextArea';
import type {PassageDefaults} from './passageItems';
import {useBibleDefaults} from './useBibleDefaults';
import styles from './SermonQuickAdd.module.css';

/** Asks for the title of a sermon and its passage. */
export function SermonQuickAdd({
  onInsert,
  onClose,
}: {
  readonly onInsert: (
    title: string,
    passage: BibleLookupPassage,
    defaults: PassageDefaults,
  ) => void;
  readonly onClose: () => void;
}): JSX.Element | null {
  const defaults = useBibleDefaults();
  const [title, setTitle] = useState('');
  if (window.llp === undefined) return null;
  return (
    <BiblePassageDialog
      api={window.llp.bible}
      translation={defaults?.translation}
      disabled={title.trim() === '' || defaults === null}
      onClose={onClose}
      onChoose={passage => {
        if (defaults !== null && title.trim() !== '') {
          onInsert(title.trim(), passage, defaults);
        }
      }}
    >
      <div className={styles.fields}>
        <TextArea
          aria-label="제목"
          placeholder="제목"
          value={title}
          rows={2}
          maxLength={SLIDE_LIMITS.text}
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
