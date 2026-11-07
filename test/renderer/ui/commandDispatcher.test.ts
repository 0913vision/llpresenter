import {fireEvent, renderHook} from '@testing-library/react';
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
  it('routes fixed clipboard keys through control ownership, text, composition and modal guards', () => {
    const control = document.body.appendChild(document.createElement('div'));
    const field = control.appendChild(document.createElement('input'));
    const outside = document.body.appendChild(document.createElement('button'));
    const ran: string[] = [];
    const owner = renderHook(() =>
      useCommandShortcuts([
        {
          id: 'edit.copy',
          context: 'service',
          fixedBindings: [{code: 'KeyC', mods: ['ctrl']}],
          when: event =>
            event.target instanceof Node && control.contains(event.target),
          run: () => ran.push('copy'),
        },
      ]),
    );
    const key = {key: 'c', code: 'KeyC', ctrlKey: true};
    fireEvent.keyDown(control, key);
    expect(ran).toEqual(['copy']);
    fireEvent.keyDown(field, key);
    fireEvent.keyDown(outside, key);
    fireEvent.keyDown(control, {...key, isComposing: true});
    fireEvent.keyDown(control, {...key, altKey: true});
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.setAttribute('role', 'dialog');
    fireEvent.keyDown(control, key);
    expect(ran).toEqual(['copy']);
    owner.unmount();
  });

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
