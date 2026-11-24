import {useState, type JSX} from 'react';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import {SLIDE_LIMITS} from '@core/schema/slide';
import {BiblePassageDialog} from '@renderer/features/bible/BiblePassageDialog';
import {PassageHeaderField} from '@renderer/features/bible/PassageHeaderField';
import type {PassageDefaults} from './passageItems';
import {useBibleDefaults} from './useBibleDefaults';

/**
 * Asks for the title of a sermon and its passage. The title is one line;
 * its line breaks are put in later on its 설교 제목 슬라이드 in 준비.
 */
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
      <PassageHeaderField
        icon="mic"
        label="설교 제목"
        value={title}
        maxLength={SLIDE_LIMITS.text}
        onChange={setTitle}
      />
    </BiblePassageDialog>
  );
}
