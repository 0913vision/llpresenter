import {renderHook} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  dispatchShortcut,
  probeCommand,
  useCommandShortcuts,
} from '@renderer/ui/commandDispatcher';
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

describe('probeCommand', () => {
  it('finds the handler of a place and its reason, even while its owner blocks keys', () => {
    const place = document.body.appendChild(document.createElement('button'));
    const handlers = [
      {id: 'edit.duplicate', unavailable: () => '잠김', run: () => undefined},
    ];
    const blocked = renderHook(() => useCommandShortcuts(handlers, () => true));
    expect(probeCommand('edit.duplicate', place)).toEqual({
      found: true,
      reason: '잠김',
    });
    blocked.unmount();
    expect(probeCommand('edit.duplicate', place)).toEqual({found: false});
  });
});
