import {afterEach, expect, it} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {prepareLiturgy} from '@renderer/features/service/items/quickAddLiturgy';

afterEach(() => {
  delete window.llp;
});

it('creates the prayer card and records the configured transitions on its slides', async () => {
  const api = mockLlpApi();
  const defaults = await api.preferences.get();
  window.llp = mockLlpApi({
    preferences: {
      ...api.preferences,
      get: async () => ({
        ...defaults,
        show: {
          ...defaults.show,
          slideDefaults: {
            ...defaults.show.slideDefaults,
            section: {kind: 'push', dir: 'up', sec: 2},
            prayer: {kind: 'dissolve', sec: 1.5},
          },
        },
      }),
    },
  });
  const item = await prepareLiturgy('prayer', 'new');
  expect(item.sectionCard).toMatchObject({
    name: '주기도문',
    english: "The Lord's Prayer",
    transition: {kind: 'push', dir: 'up', sec: 2},
  });
  expect(
    item.liturgy.transitions?.every(
      entry =>
        entry.transition.kind === 'dissolve' && entry.transition.sec === 1.5,
    ),
  ).toBe(true);
});
