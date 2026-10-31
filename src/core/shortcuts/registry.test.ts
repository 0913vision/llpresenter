import {describe, expect, it} from 'vitest';
import {parseShortcuts} from '../schema/shortcuts';
import {commandBindings, shortcutConflicts} from './bindings';
import {shortcutCommands} from './registry';
import {
  editsText,
  matchesBinding,
  PhysicalModifiers,
  sourceSlideCode,
  type PhysicalKeyPress,
} from './matching';
import {shortcutNames} from './keys';

function press(overrides: Partial<PhysicalKeyPress> = {}): PhysicalKeyPress {
  return {
    code: 'KeyC',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    isComposing: false,
    repeat: false,
    getModifierState: () => false,
    ...overrides,
  };
}

describe('shortcut registry', () => {
  it('keeps unique IDs and schema-valid current defaults without conflicts', () => {
    expect(new Set(shortcutCommands.map(command => command.id)).size).toBe(
      shortcutCommands.length,
    );
    const parsed = parseShortcuts(
      JSON.stringify({
        format: 'llsettings.shortcuts',
        schemaVersion: 1,
        bindings: Object.fromEntries(
          shortcutCommands.map(command => [command.id, command.defaults]),
        ),
      }),
      'shortcuts.json',
    );
    expect(parsed.ok && parsed.value.dropped).toEqual([]);
    expect(shortcutConflicts({})).toEqual([]);
    expect(commandBindings('tools.messages', {})).toEqual([]);
  });

  it('overrides or removes defaults while preserving unrelated unknown IDs', () => {
    const bindings = {
      'workspace.prep': [{code: 'F8', mods: []}],
      'show.next': [],
      'future.command': [{code: 'F11', mods: []}],
    } as const;
    expect(commandBindings('workspace.prep', bindings)).toEqual(
      bindings['workspace.prep'],
    );
    expect(commandBindings('show.next', bindings)).toEqual([]);
    expect(commandBindings('workspace.show', bindings)).toEqual([
      {code: 'KeyS', mods: ['ctrl']},
    ]);
    expect(commandBindings('future.command', bindings)).toEqual(
      bindings['future.command'],
    );
  });

  it('finds overlapping contexts and all zoom aliases, but permits disjoint owners', () => {
    expect(
      shortcutConflicts({
        'workspace.prep': [{code: 'NumpadAdd', mods: ['ctrl']}],
      }),
    ).toContainEqual({
      first: 'ui.zoomIn',
      second: 'workspace.prep',
      binding: {code: 'NumpadAdd', mods: ['ctrl']},
    });
    expect(
      shortcutConflicts({'show.next': [{code: 'Enter', mods: ['ctrl']}]}),
    ).toEqual([]);
  });

  it('formats physical Windows names without using layout characters', () => {
    expect(
      shortcutNames({code: 'KeyC', mods: ['ctrl', 'alt', 'shift']}),
    ).toEqual(['Ctrl', 'Alt', 'Shift', 'C']);
    expect(shortcutNames({code: 'ArrowRight', mods: []})).toEqual(['→']);
    expect(shortcutNames({code: 'PageDown', mods: []})).toEqual(['Page Down']);
  });

  it('keeps the earlier stored override when two new bindings conflict', () => {
    const key = [{code: 'F8', mods: []}] as const;
    expect(
      shortcutConflicts({'workspace.prep': key, 'workspace.screens': key}),
    ).toEqual([
      {first: 'workspace.prep', second: 'workspace.screens', binding: key[0]},
    ]);
    expect(
      shortcutConflicts({'workspace.screens': key, 'workspace.prep': key}),
    ).toEqual([
      {first: 'workspace.screens', second: 'workspace.prep', binding: key[0]},
    ]);
  });
});

describe('physical matching', () => {
  it('uses only the code and exact modifiers, rejecting Meta and AltGraph', () => {
    const binding = {code: 'KeyC', mods: ['ctrl']} as const;
    expect(matchesBinding(press({ctrlKey: true}), binding)).toBe(true);
    for (const event of [
      press(),
      press({ctrlKey: true, shiftKey: true}),
      press({ctrlKey: true, metaKey: true}),
      press({ctrlKey: true, code: ''}),
      press({ctrlKey: true, getModifierState: name => name === 'AltGraph'}),
    ]) {
      expect(matchesBinding(event, binding)).toBe(false);
    }
  });

  it('keeps Korean right modifiers with the IME and clears held state on blur', () => {
    const modifiers = new PhysicalModifiers();
    modifiers.press('AltRight');
    expect(modifiers.isInputMethod(press({altKey: true}))).toBe(true);
    modifiers.press('AltLeft');
    expect(modifiers.isInputMethod(press({altKey: true}))).toBe(false);
    modifiers.release('AltLeft');
    modifiers.release('AltRight');
    modifiers.press('ControlRight');
    expect(modifiers.isInputMethod(press({ctrlKey: true}))).toBe(true);
    modifiers.reset();
    expect(modifiers.isInputMethod(press({ctrlKey: true}))).toBe(false);
  });

  it('normalizes only unmodified source digits with Num Lock on', () => {
    expect(
      sourceSlideCode(
        press({code: 'Numpad3', getModifierState: name => name === 'NumLock'}),
      ),
    ).toBe('Digit3');
    expect(sourceSlideCode(press({code: 'Numpad3'}))).toBeNull();
    expect(sourceSlideCode(press({isComposing: true}))).toBeNull();
    expect(sourceSlideCode(press({ctrlKey: true}))).toBeNull();
    expect(sourceSlideCode(press())).toBe('KeyC');
  });

  it('leaves field editing combinations native', () => {
    expect(
      editsText(press({ctrlKey: true, shiftKey: true, code: 'KeyV'})),
    ).toBe(true);
    expect(editsText(press({ctrlKey: true, code: 'ArrowLeft'}))).toBe(true);
    expect(editsText(press({ctrlKey: true, code: 'KeyM'}))).toBe(false);
  });
});
