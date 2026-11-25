import {beforeEach, expect, it} from 'vitest';
import {useThemes} from '@renderer/platform/documents/themes';
import {
  isPaletteKey,
  NEW_SECTION_NAME,
  newPaletteItem,
  ORDER_ELEMENTS,
  ownTitleKey,
  PALETTE_TITLES,
  titleKey,
} from '@renderer/features/service/items/newItems';
import {themes, themeScreens} from '@fixtures/core/themeOutput';

const OWN = {
  id: '00000000-0000-4000-8000-000000000701',
  name: '예배의 부름',
  english: 'Call to Worship',
};

beforeEach(() => {
  useThemes.setState({
    themes: {...themes(), titles: [OWN]},
    screens: themeScreens,
  });
});

it('offers the titles of every service first, in their order, and leaves out 사도신경 and 광고', () => {
  const names = PALETTE_TITLES.map(title => title.name);
  expect(names.slice(0, 3)).toEqual(['묵상기도', '회개와간구의기도', '찬양']);
  expect(names).not.toContain('사도신경');
  expect(names).not.toContain('광고');
  expect(new Set(names).size).toBe(names.length);
});

it('knows the keys the palette offers', () => {
  for (const element of ORDER_ELEMENTS) {
    expect(isPaletteKey(element.id)).toBe(true);
  }
  expect(isPaletteKey(titleKey('축도'))).toBe(true);
  expect(isPaletteKey(ownTitleKey(OWN.id))).toBe(true);
  expect(isPaletteKey('song:anything')).toBe(false);
});

it('makes a new item for each element of the palette, each with its own id', () => {
  const kinds = Object.fromEntries(
    ORDER_ELEMENTS.filter(({id}) => id !== 'sermon' && id !== 'bible').map(
      ({id}) => [id, newPaletteItem(id)?.kind],
    ),
  );
  expect(kinds).toEqual({
    standby: 'blank',
    creed: 'liturgy',
    prayer: 'liturgy',
    ad: 'notice',
    blank: 'blank',
    header: 'header',
    'waiting-screen': 'blank',
  });
  expect(newPaletteItem('header')).toMatchObject({name: NEW_SECTION_NAME});
  expect(newPaletteItem('blank')?.id).not.toBe(newPaletteItem('blank')?.id);
});

it('makes a title card of the app or of the operator, and nothing for a key it does not know', () => {
  expect(newPaletteItem(titleKey('축도'))).toMatchObject({name: '축도'});
  expect(newPaletteItem(ownTitleKey(OWN.id))).toMatchObject({
    name: '예배의 부름',
  });
  expect(newPaletteItem(titleKey('없는 제목'))).toBeNull();
  expect(newPaletteItem(ownTitleKey('gone'))).toBeNull();
  expect(newPaletteItem('sermon')).toBeNull();
});
