import {describe, expect, it} from 'vitest';
import {createScreenId} from '@core/schema/common/ids';
import type {ThemeFile} from '@core/schema/screens/theme';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {
  canFollow,
  isFirstOfKind,
  ownLayoutFrom,
  ownScreenOf,
  withScreen,
} from '@core/theme/screens';
import {builtIn} from '@fixtures/core/themeOutput';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const MAIN = {id: createScreenId(uuid(1)), kind: 'audience'} as const;
const SECOND = {id: createScreenId(uuid(2)), kind: 'audience'} as const;
const STAGE = {id: createScreenId(uuid(3)), kind: 'stage'} as const;
const BROADCAST = {id: createScreenId(uuid(4)), kind: 'broadcast'} as const;
const SCREENS = [MAIN, STAGE, SECOND, BROADCAST];

function lyrics(): ThemeFile {
  return builtIn(BUILT_IN_THEME_IDS.lyrics);
}

describe('the screens a theme lays out', () => {
  it('lays out the first screen of each kind; the others follow it unless they have their own', () => {
    expect(isFirstOfKind(MAIN, SCREENS)).toBe(true);
    expect(isFirstOfKind(SECOND, SCREENS)).toBe(false);
    const theme = lyrics();
    expect(ownScreenOf(theme, MAIN, SCREENS)).toBe(theme.screens.audience);
    expect(ownScreenOf(theme, SECOND, SCREENS)).toEqual({
      mode: 'same',
      as: 'audience',
    });
  });

  it('gives a second screen a layout of its own, and drops it again when it follows its kind', () => {
    const theme = lyrics();
    const blank = {mode: 'own' as const, elements: []};
    const own = withScreen(theme, SECOND, {layout: blank, screens: SCREENS});
    expect(own.others).toEqual({[SECOND.id]: blank});
    expect(ownScreenOf(own, SECOND, SCREENS)).toEqual(blank);
    expect(theme.others).toBeUndefined();
    const back = withScreen(own, SECOND, {
      layout: {mode: 'same', as: 'audience'},
      screens: SCREENS,
    });
    expect(back).not.toHaveProperty('others');
  });

  it('changes the layout of a kind through its first screen', () => {
    const theme = lyrics();
    const next = withScreen(theme, STAGE, {
      layout: {mode: 'same', as: 'audience'},
      screens: SCREENS,
    });
    expect(next.screens.stage).toEqual({mode: 'same', as: 'audience'});
    expect(next.screens.audience).toBe(theme.screens.audience);
  });
});

describe('canFollow', () => {
  it('lets a first screen follow another kind only when that never comes back to it', () => {
    const theme = withScreen(lyrics(), STAGE, {
      layout: {mode: 'same', as: 'audience'},
      screens: SCREENS,
    });
    expect(canFollow(theme, MAIN, {as: 'audience', screens: SCREENS})).toBe(
      false,
    );
    expect(canFollow(theme, MAIN, {as: 'stage', screens: SCREENS})).toBe(false);
    expect(canFollow(theme, BROADCAST, {as: 'stage', screens: SCREENS})).toBe(
      true,
    );
    expect(canFollow(theme, SECOND, {as: 'audience', screens: SCREENS})).toBe(
      true,
    );
  });
});

describe('ownLayoutFrom', () => {
  it('starts a screen that stops following from what it showed, or from nothing', () => {
    const theme = lyrics();
    expect(ownLayoutFrom(theme, SECOND)).toEqual(theme.screens.audience);
    const loop: ThemeFile = {
      ...theme,
      screens: {
        ...theme.screens,
        audience: {mode: 'same', as: 'stage'},
        stage: {mode: 'same', as: 'audience'},
      },
    };
    expect(ownLayoutFrom(loop, MAIN)).toEqual({mode: 'own', elements: []});
  });
});
