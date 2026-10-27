import {describe, expect, it} from 'vitest';
import {parseScreens, type Screen} from './schema/screens';
import {
  outputStateKeys,
  resolveOutputScreen,
  STARTER_SCREEN_IDS,
} from './screens';

function configuredScreens(screens: readonly object[]): readonly Screen[] {
  const parsed = parseScreens(
    JSON.stringify({format: 'llsettings.screens', schemaVersion: 1, screens}),
    'screens.json',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.data.screens;
}

function starters(): readonly Screen[] {
  return configuredScreens([
    {
      id: STARTER_SCREEN_IDS.main,
      name: '본 화면',
      kind: 'audience',
      method: 'fullscreen',
    },
    {
      id: STARTER_SCREEN_IDS.broadcast,
      name: '방송 자막',
      kind: 'audience',
      method: 'capture',
    },
    {
      id: STARTER_SCREEN_IDS.stage,
      name: '무대 화면',
      kind: 'stage',
      method: 'fullscreen',
    },
  ]);
}

describe('outputStateKeys', () => {
  it.each(['main', 'broadcast', 'stage'] as const)(
    'returns canonical-first state keys for the %s role and its UUID',
    role => {
      const id = STARTER_SCREEN_IDS[role];
      const expected =
        role === 'broadcast' ? [id, role, 'captions'] : [id, role];
      expect(outputStateKeys(role)).toEqual(expected);
      expect(outputStateKeys(id)).toEqual(expected);
    },
  );

  it('maps the legacy captions key to the same broadcast output', () => {
    expect(outputStateKeys('captions')).toEqual([
      STARTER_SCREEN_IDS.broadcast,
      'broadcast',
      'captions',
    ]);
  });

  it.each(['11111111-1111-4111-8111-111111111111', 'unknown', 'Main', ''])(
    'retains the exact custom or unrecognized state key %j',
    id => {
      expect(outputStateKeys(id)).toEqual([id]);
    },
  );
});

describe('resolveOutputScreen', () => {
  it('resolves starter roles and the legacy captions alias to their UUIDs', () => {
    const screens = starters();
    for (const role of ['main', 'broadcast', 'stage'] as const) {
      const screen = screens.find(item => item.id === STARTER_SCREEN_IDS[role]);
      expect(screen).toBeDefined();
      expect(resolveOutputScreen(role, screens)).toBe(screen);
      expect(resolveOutputScreen(STARTER_SCREEN_IDS[role], screens)).toBe(
        screen,
      );
    }
    expect(resolveOutputScreen('captions', screens)?.id).toBe(
      STARTER_SCREEN_IDS.broadcast,
    );
  });

  it('resolves an exact custom UUID without requiring a starter role', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const screens = configuredScreens([
      ...starters(),
      {id, name: 'Custom', kind: 'audience', method: 'capture'},
    ]);
    expect(resolveOutputScreen(id, screens)).toBe(screens.at(-1));
    expect(resolveOutputScreen('main', screens)?.id).toBe(
      STARTER_SCREEN_IDS.main,
    );
  });

  it('keeps the role after renaming and reordering screens', () => {
    const screens = starters()
      .map(screen => ({...screen, name: `Renamed ${screen.id}`}))
      .reverse();
    expect(resolveOutputScreen('main', screens)?.id).toBe(
      STARTER_SCREEN_IDS.main,
    );
    expect(resolveOutputScreen('broadcast', screens)?.id).toBe(
      STARTER_SCREEN_IDS.broadcast,
    );
    expect(resolveOutputScreen('stage', screens)?.id).toBe(
      STARTER_SCREEN_IDS.stage,
    );
  });

  it.each(['fullscreen', 'window', 'capture', 'ndi'] as const)(
    'keeps the original target after its method changes to %s',
    method => {
      const screens = configuredScreens(
        starters().map(screen => ({...screen, method})),
      );
      expect(resolveOutputScreen('main', screens)?.id).toBe(
        STARTER_SCREEN_IDS.main,
      );
      expect(resolveOutputScreen('broadcast', screens)?.id).toBe(
        STARTER_SCREEN_IDS.broadcast,
      );
      expect(resolveOutputScreen('stage', screens)?.id).toBe(
        STARTER_SCREEN_IDS.stage,
      );
    },
  );

  it('does not assign a missing starter role to another screen with a matching name or method', () => {
    const screens = configuredScreens([
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: '본 화면',
        kind: 'audience',
        method: 'fullscreen',
      },
    ]);
    for (const id of [
      'main',
      'broadcast',
      'captions',
      'stage',
      'unknown',
      STARTER_SCREEN_IDS.main,
      '',
    ]) {
      expect(resolveOutputScreen(id, screens)).toBeUndefined();
    }
    expect(resolveOutputScreen('main', [])).toBeUndefined();
  });
});
