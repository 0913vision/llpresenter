import {describe, expect, it} from 'vitest';
import {
  alwaysOnTopOf,
  changeScreen,
  nameProblem,
  onDisconnectOf,
} from '@core/screens/screenEdits';
import {CAPTIONS_ID, MAIN_ID, screensDocument} from './testing/documents';

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value.screens;
}

describe('changeScreen', () => {
  it('merges each offset axis into the latest screen value', () => {
    const horizontal = changeScreen(screens(), MAIN_ID, {offset: {x: 20}});
    const vertical = changeScreen(horizontal, MAIN_ID, {offset: {y: 30}});
    expect(vertical[0]?.offset).toEqual({x: 20, y: 30});
  });

  it('changes only the named screen', () => {
    const before = screens();

    const changed = changeScreen(before, CAPTIONS_ID, {name: '자막'});

    expect(changed.map(screen => screen.name)).toEqual([
      '본 화면',
      '자막',
      '무대 화면',
    ]);
    expect(changed[0]).toBe(before[0]);
    expect(changed[2]).toBe(before[2]);
  });

  it('keeps the fields the change leaves out', () => {
    const [main] = changeScreen(screens(), MAIN_ID, {alwaysOnTop: false});

    expect(main).toMatchObject({
      name: '본 화면',
      method: 'fullscreen',
      alwaysOnTop: false,
    });
    expect(main?.display?.number).toBe(2);
  });

  it('keeps every screen when no screen has the id', () => {
    expect(changeScreen(screens(), 'missing', {name: 'x'})).toEqual(screens());
  });
});

describe('nameProblem', () => {
  it("accepts a new name and the screen's own name", () => {
    expect(nameProblem('새 화면', screens(), MAIN_ID)).toBeUndefined();
    expect(nameProblem('본 화면', screens(), MAIN_ID)).toBeUndefined();
  });

  it.each(['', '   '])('rejects the empty name %j', name => {
    expect(nameProblem(name, screens(), MAIN_ID)).toBe('empty');
  });

  it("rejects another screen's name, ignoring spaces around it", () => {
    expect(nameProblem('무대 화면', screens(), MAIN_ID)).toBe('taken');
    expect(nameProblem(' 무대 화면 ', screens(), MAIN_ID)).toBe('taken');
  });
});

describe('screen defaults', () => {
  it.each(['fullscreen', 'window', 'capture', 'ndi'] as const)(
    'defaults %s off while preserving explicit values',
    method => {
      const [screen] = screens();
      if (screen === undefined) throw new Error('Missing screen');
      expect(alwaysOnTopOf({...screen, method})).toBe(false);
      expect(alwaysOnTopOf({...screen, method, alwaysOnTop: true})).toBe(true);
      expect(alwaysOnTopOf({...screen, method, alwaysOnTop: false})).toBe(
        false,
      );
    },
  );
  it('leaves all methods off always on top until explicitly enabled', () => {
    const [main, captions] = screens();
    if (main === undefined || captions === undefined) {
      throw new Error('Missing');
    }

    expect(alwaysOnTopOf(main)).toBe(false);
    expect(alwaysOnTopOf(captions)).toBe(false);
    expect(alwaysOnTopOf({...captions, alwaysOnTop: true})).toBe(true);
    expect(alwaysOnTopOf({...main, alwaysOnTop: false})).toBe(false);
  });

  it('switches to a window on disconnect unless the screen says off', () => {
    const [main] = screens();
    if (main === undefined) throw new Error('Missing');

    expect(onDisconnectOf(main)).toBe('window');
    expect(onDisconnectOf({...main, onDisconnect: 'off'})).toBe('off');
  });
});
