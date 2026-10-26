import {describe, expect, it} from 'vitest';
import {showMonitorNumber} from './monitorNumber';

describe('showMonitorNumber', () => {
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
