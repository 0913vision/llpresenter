import {expect, it} from 'vitest';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';
import {SONG_THEME_IDS} from '@core/theme/builtIn/ids';

const songThemes = [
  ...Object.values(SONG_THEME_IDS.dark),
  ...Object.values(SONG_THEME_IDS.light),
];

it('puts the lyrics of every built-in song theme on a 90 percent black band on 방송 (user, Nov 27)', () => {
  for (const id of songThemes) {
    const theme = BUILT_IN_THEMES.find(found => found.id === id);
    const broadcast = theme?.screens.broadcast;
    const band =
      broadcast?.mode === 'own'
        ? broadcast.elements.find(element => element.kind === 'shape')
        : undefined;
    expect(band?.kind === 'shape' ? band.fill : null, `${theme?.name}`).toEqual(
      {color: '#000000', opacity: 90},
    );
  }
});
