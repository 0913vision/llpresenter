import type {JSX} from 'react';
import {SLIDES_LIMITS} from '@core/schema/service';
import {BIBLE_LOOKUP_LIMITS} from '@core/schema/bibleLookup';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {ShowTile} from '@core/schema/showService';
import type {BibleSlide} from '@core/schema/biblePassage';
import {
  changeBibleSlides,
  isPassageItem,
  keptSlides,
  passageOf,
  withPassage,
  type PassageItem,
} from '@core/services/passageEdits';
import {ItemTextField} from './ItemTextField';
import type {ServiceItemStore} from './serviceItemStore';
import styles from './ItemTextField.module.css';

/** The text and the reference of one slide of a passage, where they are kept. */
export function BibleSlideFields({
  items,
  serviceId,
  item,
  lookup,
  tile,
  readOnly,
}: {
  readonly items: ServiceItemStore;
  readonly serviceId: string;
  readonly item: PassageItem;
  readonly lookup: BibleLookupPassage | undefined;
  readonly tile: ShowTile;
  readonly readOnly: boolean;
}): JSX.Element | null {
  const id = tile.sourceSlideId;
  const slide = Object.values(passageOf(item).slides ?? {})
    .flat()
    .find(entry => entry.id === id);
  if (id === undefined || slide === undefined || lookup === undefined) {
    return <p>{tile.lines.join('\n')}</p>;
  }
  const save = (change: (slide: BibleSlide) => BibleSlide): Promise<boolean> =>
    items.submitItemEdit({
      target: {serviceId, itemId: item.id},
      failure: '슬라이드 글 저장 실패',
      change: fresh => {
        if (!isPassageItem(fresh)) return null;
        const passage = passageOf(fresh);
        return withPassage(fresh, {
          ...passage,
          slides: changeBibleSlides(
            keptSlides(passage, lookup),
            new Set([id]),
            change,
          ),
        });
      },
    });
  return (
    <div className={styles.fields}>
      <ItemTextField
        key={`${id}:text`}
        label="본문"
        value={slide.text}
        items={items}
        readOnly={readOnly}
        maxLength={BIBLE_LOOKUP_LIMITS.verseText}
        save={text => save(entry => ({...entry, text}))}
      />
      {tile.reference === undefined ? null : (
        <ItemTextField
          key={`${id}:reference`}
          label="본문 주소"
          singleLine
          value={slide.reference ?? ''}
          placeholder={lookup.displayRef}
          items={items}
          readOnly={readOnly}
          maxLength={SLIDES_LIMITS.reference}
          save={text =>
            save(({reference: _reference, ...entry}) =>
              text.trim() === '' ? entry : {...entry, reference: text},
            )
          }
        />
      )}
    </div>
  );
}
