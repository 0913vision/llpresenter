import {afterEach, describe, expect, it} from 'vitest';
import {dispatchShortcut} from '@renderer/ui/commandDispatcher';
import {onShortcutCommit} from '@renderer/ui/commitDraft';

afterEach(() => {
  document.body.replaceChildren();
});

describe('dispatchShortcut', () => {
  it('asks the focused editor to commit its draft before it runs a command', () => {
    const field = document.body.appendChild(document.createElement('input'));
    const order: string[] = [];
    const stop = onShortcutCommit(field, () => order.push('commit'));
    const event = new KeyboardEvent('keydown', {
      code: 'F2',
      key: 'F2',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', {value: field});

    dispatchShortcut(
      event,
      [{id: 'clear.slide', run: () => order.push('run')}],
      'capture',
    );

    expect(order).toEqual(['commit', 'run']);
    stop();
  });
});
