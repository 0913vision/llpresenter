import {describe, expect, it} from 'vitest';
import {showMonitorNumber} from './monitorNumber';

describe('showMonitorNumber', () => {
  it('shows the screen name, physical resolution, refresh and kind as text', () => {
    const root = document.createElement('div');
    const details = {
      name: 'Main <b>screen</b>',
      kind: 'audience',
      method: 'fullscreen',
      width: 3440,
      height: 1440,
      refreshRate: 59.94,
    };
    expect(showMonitorNumber(root, '1', JSON.stringify(details))).toBe(true);
    expect(root.querySelector('h1')?.textContent).toBe(details.name);
    expect(root.querySelector('b')).toBeNull();
    expect(root.textContent).toContain('3440 × 1440, 59.94 Hz');
    expect(root.textContent).toContain('청중, 전체 화면');
    expect(root.querySelectorAll('button,input,[tabindex]')).toHaveLength(0);
  });

  it('shows stage window details and an honest unknown refresh rate', () => {
    const root = document.createElement('div');
    showMonitorNumber(
      root,
      '2',
      JSON.stringify({
        name: 'Stage',
        kind: 'stage',
        method: 'window',
        width: 960,
        height: 540,
        refreshRate: 0,
      }),
    );
    expect(root.textContent).toContain('주사율 미확인');
    expect(root.textContent).toContain('무대, 창');
  });

  it.each(['{', JSON.stringify({name: 'missing fields'}), 'x'.repeat(2001)])(
    'rejects malformed details %j',
    details => {
      const root = document.createElement('div');
      expect(showMonitorNumber(root, '2', details)).toBe(false);
      expect(root.children).toHaveLength(0);
    },
  );
  it('draws the number alone', () => {
    const root = document.createElement('div');
    root.append(document.createElement('span'));
    expect(showMonitorNumber(root, '2')).toBe(true);
    expect(root.textContent).toBe('2');
    expect(root.children).toHaveLength(1);
  });

  it.each(['0', '100', '-1', '2<b>', ''])('draws nothing for %j', value => {
    const root = document.createElement('div');
    expect(showMonitorNumber(root, value)).toBe(false);
    expect(root.children).toHaveLength(0);
  });
});
