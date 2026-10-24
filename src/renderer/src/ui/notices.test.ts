import {describe, expect, it} from 'vitest';
import {addNotice, MAX_NOTICES, removeNotice, type Notice} from './notices';

function notice(key: string, kind: Notice['kind'] = 'info'): Notice {
  return {key, kind, icon: 'monitor', title: key, time: '11:24'};
}

function keys(notices: readonly Notice[]): string[] {
  return notices.map(shown => shown.key);
}

describe('addNotice', () => {
  it('puts the newest card on top', () => {
    const stack = addNotice(addNotice([], notice('a')), notice('b'));
    expect(keys(stack)).toEqual(['b', 'a']);
  });

  it('replaces the card with the same cause instead of stacking another', () => {
    const lost = notice('screen:stage', 'warning');
    const back = {...notice('screen:stage'), title: '무대 모니터 다시 연결됨'};
    const stack = addNotice(addNotice([notice('x'), lost], notice('y')), back);
    expect(keys(stack)).toEqual(['screen:stage', 'y', 'x']);
    expect(stack[0]?.title).toBe('무대 모니터 다시 연결됨');
  });

  it('closes the oldest information card first beyond three cards', () => {
    let stack: readonly Notice[] = [];
    for (const shown of [
      notice('info-old'),
      notice('warn-1', 'warning'),
      notice('info-new'),
      notice('warn-2', 'warning'),
    ]) {
      stack = addNotice(stack, shown);
    }
    expect(stack).toHaveLength(MAX_NOTICES);
    expect(keys(stack)).toEqual(['warn-2', 'info-new', 'warn-1']);
  });

  it('closes the oldest card when every card is a warning', () => {
    let stack: readonly Notice[] = [];
    for (const key of ['w1', 'w2', 'w3', 'w4']) {
      stack = addNotice(stack, notice(key, 'warning'));
    }
    expect(keys(stack)).toEqual(['w4', 'w3', 'w2']);
  });
});

describe('removeNotice', () => {
  it('takes only the card with that cause off', () => {
    const stack = addNotice(addNotice([], notice('a')), notice('b'));
    expect(keys(removeNotice(stack, 'a'))).toEqual(['b']);
  });
});
