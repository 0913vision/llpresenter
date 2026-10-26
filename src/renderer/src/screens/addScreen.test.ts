import {describe, expect, it} from 'vitest';
import {parseScreenId} from '@shared/schema/ids';
import {parseScreens, type Screen} from '@shared/schema/screens';
import {MAX_TARGET_SCREENS} from '@shared/schema/overlayState';
import {addScreen} from './addScreen';

function screenId(index: number) {
  const result = parseScreenId(
    `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  );
  if (!result.ok) throw new Error('Invalid fixture id');
  return result.value;
}

const INPUT = {
  id: screenId(201),
  kind: 'audience',
  method: 'fullscreen',
} as const;

describe('addScreen', () => {
  it.each(['fullscreen', 'window', 'capture'] as const)(
    'creates an unassigned %s screen with always-on-top off',
    method => {
      const screens = addScreen([], {...INPUT, method});
      expect(screens[0]).toEqual({
        ...INPUT,
        method,
        name: '새 청중 화면',
        alwaysOnTop: false,
        ...(method === 'capture'
          ? {resolution: {width: 1920, height: 1080}}
          : {}),
      });
      expect(
        parseScreens(
          JSON.stringify({
            format: 'llsettings.screens',
            schemaVersion: 1,
            screens,
          }),
          'screens.json',
        ).ok,
      ).toBe(true);
    },
  );

  it('uses the Stage kind without assigning a stage layout or enabling output', () => {
    expect(addScreen([], {...INPUT, kind: 'stage'})[0]).toEqual({
      ...INPUT,
      kind: 'stage',
      name: '새 무대 화면',
      alwaysOnTop: false,
    });
  });

  it('generates unique names against the latest list, including padded names', () => {
    const first = addScreen([], INPUT);
    const padded = first.map(screen => ({...screen, name: ` ${screen.name} `}));
    const second = addScreen(padded, {...INPUT, id: screenId(202)});
    const third = addScreen(second, {...INPUT, id: screenId(203)});
    expect(third.map(screen => screen.name)).toEqual([
      ' 새 청중 화면 ',
      '새 청중 화면 (2)',
      '새 청중 화면 (3)',
    ]);
    expect(third[0]).toBe(padded[0]);
  });

  it('rejects duplicate ids and the runtime screen limit without mutating the input', () => {
    const first = addScreen([], INPUT);
    expect(() => addScreen(first, INPUT)).toThrow('화면 추가 실패');
    const full: Screen[] = Array.from(
      {length: MAX_TARGET_SCREENS},
      (_, index) => ({
        ...INPUT,
        id: screenId(index + 1),
        name: `Screen ${index}`,
      }),
    );
    expect(() => addScreen(full, INPUT)).toThrow(
      '화면은 200개까지 추가할 수 있음',
    );
    expect(full).toHaveLength(MAX_TARGET_SCREENS);
  });
});
