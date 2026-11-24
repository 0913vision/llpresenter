import {useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {SLIDE_LIMITS} from '@core/schema/slide';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {Icon} from '@renderer/ui/Icon';
import {TextArea} from '@renderer/ui/TextArea';
import type {PassageDefaults} from './passageItems';
import {useBibleDefaults} from './useBibleDefaults';
import styles from './SermonQuickAdd.module.css';

const ICON_SIZE = 18;

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
      name="설교"
      translation={defaults?.translation}
      disabled={title.trim() === '' || defaults === null}
      onClose={onClose}
      onChoose={passage => {
        if (defaults !== null && title.trim() !== '') {
          onInsert(title.trim(), passage, defaults);
        }
      }}
    >
      <div className={styles.titleRow}>
        <Icon name="mic" size={ICON_SIZE} className={styles.icon} />
        <TextArea
          aria-label="설교 제목"
          placeholder="설교 제목"
          className={styles.title}
          value={title}
          rows={1}
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
