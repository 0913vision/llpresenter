import {describe, expect, it} from 'vitest';
import {isItemOfKind} from '@core/schema/service';
import {newLiturgyItem} from '@core/services/liturgy';
import {newSectionItem} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {ids, otherItems, templateOrder} from '@fixtures/core/serviceList';
import {slidesItem} from '@fixtures/core/slides';
import {itemEditorAdapter} from '@renderer/platform/itemEditorAdapter';

describe('item editor capabilities', () => {
  const song = templateOrder.find(item => isItemOfKind(item, 'song'));
  const bible = templateOrder.find(item => isItemOfKind(item, 'bible'));
  const media = otherItems.find(item => isItemOfKind(item, 'media'));
  const section = SUNDAY_SECTIONS[0];
  if (!song || !bible || !isItemOfKind(bible, 'bible') || !media || !section) {
    throw Error('Missing editor fixtures');
  }
  const sermon = {
    id: ids.word,
    sermon: {title: 'Sermon', passage: bible.bible},
  };
  const liturgy = newLiturgyItem(ids.word, {
    kind: 'creed',
    translation: 'new',
  });
  it.each([
    ['song', song, true, false, false, true, false, false],
    ['blank', slidesItem('blank'), true, true, true, true, false, true],
    ['ad', slidesItem('ad'), true, true, false, true, false, true],
    ['bible', bible, false, false, false, true, true, false],
    ['sermon', sermon, false, false, false, false, false, false],
    ['liturgy', liturgy, false, false, false, false, false, false],
    ['media', media, false, false, false, false, false, false],
    [
      'title',
      newSectionItem(ids.word, section),
      true,
      true,
      true,
      true,
      false,
      true,
    ],
  ] as const)('%s exposes its supported commands', (...args) => {
    const [
      ,
      item,
      addSlide,
      addPicture,
      addVerse,
      addTitle,
      splitVerses,
      timedAdvance,
    ] = args;
    expect(itemEditorAdapter(item)).toMatchObject({
      addSlide,
      addPicture,
      addVerse,
      addTitle,
      splitVerses,
      timedAdvance,
    });
  });
});
