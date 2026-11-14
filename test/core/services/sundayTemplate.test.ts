import {expect, it} from 'vitest';
import {
  parseTemplate,
  serializeTemplate,
  isItemOfKind,
  type ServiceItem,
} from '@core/schema/service';
import {newSundayCreed, sundayTemplate} from '@core/services/sundayTemplate';
import {createServiceItemId} from '@core/schema/ids';
import {LITURGY_SLIDES} from '@core/services/liturgySlides';
import {SUNDAY_SECTIONS, SECTION_THEMES} from '@core/themes/sundaySections';
import {PREPARATION_THEME_ID} from '@core/themes/sundayStandby';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';

it('ships the church order with fixed editable cards and empty places for local content', () => {
  const template = sundayTemplate();
  expect(template).toMatchObject({
    format: 'llservice',
    schemaVersion: 1,
    name: '주일 2부 예배',
    time: '11:30',
  });
  expect(template).not.toHaveProperty('date');
  const groups: Array<{name: string; items: ServiceItem[]}> = [];
  for (const item of template.order) {
    if (isItemOfKind(item, 'header')) {
      groups.push({name: item.header, items: []});
    } else groups.at(-1)?.items.push(item);
  }
  expect(
    groups.map(group => [
      group.name,
      group.items.map(item =>
        isItemOfKind(item, 'slides') ? item.slides.name : 'unexpected',
      ),
    ]),
  ).toEqual([
    ['예배 전', ['예배 준비']],
    ['묵상기도', ['묵상기도']],
    ['사도신경', ['사도신경']],
    ['회개와간구의기도', ['회개와간구의기도']],
    ['찬양', ['찬양']],
    ['합심기도', ['합심기도']],
    ['말씀', []],
    ['봉헌', ['봉헌']],
    ['봉헌기도', ['봉헌기도']],
    ['광고', ['광고']],
    ['축도', ['축도']],
  ]);
  const fixed = template.order.filter(item => isItemOfKind(item, 'slides'));
  expect(fixed).toHaveLength(10);
  expect(template.order).toHaveLength(21);
  const preparation = fixed.find(item => item.theme === PREPARATION_THEME_ID);
  expect(preparation).toMatchObject({
    slides: {form: 'blank', name: '예배 준비', slides: [{text: ''}]},
  });
  const creed = fixed.find(item => item.theme === CREED_PRAYER_THEME_ID);
  expect(
    creed?.slides.slides.map(slide => ('text' in slide ? slide.text : null)),
  ).toEqual(LITURGY_SLIDES.creed.new);
  expect(creed?.sectionCard).toEqual({
    name: SUNDAY_SECTIONS[1]?.name,
    english: "Apostle's Creed",
    theme: SUNDAY_SECTIONS.find(s => s.name === SUNDAY_SECTIONS[1]?.name)
      ?.theme,
  });
  const notice = fixed.find(item => item.slides.form === 'ad');
  expect(notice).toMatchObject({
    slides: {
      name: '광고',
      slides: [{name: '광고 제목', text: '내용 1\n내용 2'}],
    },
  });
  expect(notice?.slides.advance).toBeUndefined();
  expect(notice?.slides.loop ?? false).toBe(false);
  expect(notice?.sectionCard).toEqual({
    name: SUNDAY_SECTIONS[11]?.name,
    english: 'Notice',
    theme: SUNDAY_SECTIONS.find(s => s.name === SUNDAY_SECTIONS[11]?.name)
      ?.theme,
  });
  expect(notice?.slides.slides).toHaveLength(1);
  const cards = fixed.filter(item =>
    SECTION_THEMES.some(theme => theme.id === item.theme),
  );
  expect(cards).toHaveLength(7);
  for (const card of cards) {
    const section = SUNDAY_SECTIONS.find(
      section => section.name === card.slides.name,
    );
    expect(section).toBeDefined();
    expect(card.background).toBeUndefined();
    expect(card.theme).toBe(section?.theme);
    expect(card.slides.slides).toEqual([]);
    expect(card.sectionCard).toEqual({
      name: section?.name,
      english: section?.english,
      theme: section?.theme,
    });
    expect(card.slides.advance).toBeUndefined();
    expect(card.slides.loop).toBeUndefined();
  }
  expect(
    template.order.every(
      item => isItemOfKind(item, 'header') || isItemOfKind(item, 'slides'),
    ),
  ).toBe(true);
  const encoded = serializeTemplate(template, 'sunday.llservice');
  if (!encoded.ok) throw Error(encoded.error.message);
  const decoded = parseTemplate(encoded.value, 'sunday.llservice');
  expect(decoded.ok && decoded.value.data).toEqual(template);
});

it('assigns independent item and slide IDs to each template build', () => {
  const first = sundayTemplate();
  const second = sundayTemplate();
  const ids = [first, second].flatMap(template => [
    template.id,
    ...template.order.flatMap(item => [
      item.id,
      ...(isItemOfKind(item, 'slides')
        ? item.slides.slides.map(slide => slide.id)
        : []),
    ]),
  ]);
  expect(new Set(ids).size).toBe(ids.length);
});

it.each(['new', 'old'] as const)(
  'creates the Sunday creed with its card and %s translation',
  translation => {
    const id = createServiceItemId('00000000-0000-4000-8000-000000000987');
    const item = newSundayCreed(id, translation);
    if (!isItemOfKind(item, 'slides')) throw Error('Expected creed slides');
    expect(item.id).toBe(id);
    expect(item.theme).toBe(CREED_PRAYER_THEME_ID);
    expect(item.sectionCard).toEqual({
      name: SUNDAY_SECTIONS[1]?.name,
      english: "Apostle's Creed",
      theme: SUNDAY_SECTIONS[1]?.theme,
    });
    expect(
      item.slides.slides.map(slide => ('text' in slide ? slide.text : null)),
    ).toEqual(LITURGY_SLIDES.creed[translation]);
    if (translation === 'new') {
      const template = sundayTemplate().order.find(
        entry =>
          isItemOfKind(entry, 'slides') &&
          entry.theme === CREED_PRAYER_THEME_ID,
      );
      if (!template || !isItemOfKind(template, 'slides')) {
        throw Error('Expected template creed');
      }
      expect(template.sectionCard).toEqual(item.sectionCard);
      expect(
        template.slides.slides.map(slide =>
          'text' in slide ? slide.text : null,
        ),
      ).toEqual(LITURGY_SLIDES.creed.new);
    }
  },
);
