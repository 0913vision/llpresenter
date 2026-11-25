import {expect, it} from 'vitest';
import {BUILT_IN_THEMES} from '@core/theme/builtIn';

it('runs the sermon title on one line on 방송, however it is broken for 청중 (user, Nov 26)', () => {
  const theme = BUILT_IN_THEMES.find(found => found.purpose === 'sermonTitle');
  const broadcast = theme?.screens.broadcast;
  const title =
    broadcast?.mode === 'own'
      ? broadcast.elements.find(
          element =>
            element.kind === 'text' && element.content.includes('{제목}'),
        )
      : undefined;
  expect(title?.kind === 'text' ? title.joinRows : undefined).toBe(1);
  const audience = theme?.screens.audience;
  const audienceTitle =
    audience?.mode === 'own'
      ? audience.elements.find(
          element =>
            element.kind === 'text' && element.content.includes('{제목}'),
        )
      : undefined;
  expect(
    audienceTitle?.kind === 'text' ? audienceTitle.joinRows : 'none',
  ).toBeUndefined();
});
