import {describe, expect, it, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import * as showState from '@renderer/session/show';
import * as bibleKeys from '@renderer/features/bible/verseShortcuts';
import {handleShowKey} from '@renderer/features/presentation/shortcuts';
import {
  keyEvent,
  press,
  release,
  appendTo,
} from '@fixtures/renderer/features/presentation/shortcutsFixtures';

describe('handleShowKey Bible verse keys', () => {
  it.each([
    ['ArrowRight', 'next'],
    ['ArrowLeft', 'previous'],
  ])('adds and outputs the %s endpoint once per press', (code, direction) => {
    expect(press(code, {shiftKey: true}).defaultPrevented).toBe(true);
    expect(press(code, {shiftKey: true, repeat: true}).defaultPrevented).toBe(
      true,
    );
    expect(bibleKeys.outputAdjacentBibleVerse).toHaveBeenCalledExactlyOnceWith(
      direction,
    );
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('leaves text selection, focused controls, dialogs and other modifiers alone', () => {
    for (const target of [
      appendTo('input'),
      appendTo('textarea'),
      appendTo('div', {contenteditable: 'true'}),
      appendTo('div', {role: 'tab'}),
      appendTo('div', {role: 'radio'}),
      appendTo('div', {role: 'dialog'}),
      appendTo('div', {role: 'menu'}),
    ]) {
      expect(
        press('ArrowRight', {shiftKey: true}, target).defaultPrevented,
      ).toBe(false);
    }
    press('ArrowRight', {shiftKey: true, ctrlKey: true});
    press('ArrowLeft', {shiftKey: true, altKey: true});
    press('ArrowRight', {shiftKey: true, metaKey: true});
    press('ArrowRight', {shiftKey: true, isComposing: true});
    setColumnDragActive(true);
    press('ArrowRight', {shiftKey: true});
    expect(bibleKeys.outputAdjacentBibleVerse).not.toHaveBeenCalled();
  });

  it('passes Shift arrows from the slide grid and service list', () => {
    const grid = appendTo('div', {role: 'listbox'});
    press(
      'ArrowRight',
      {shiftKey: true},
      grid.appendChild(document.createElement('button')),
    );
    expect(bibleKeys.outputAdjacentBibleVerse).toHaveBeenCalledExactlyOnceWith(
      'next',
    );
  });
});

describe('handleShowKey next and previous', () => {
  it.each(['ArrowRight', 'Space', 'PageDown'])(
    'outputs the next 장 with %s',
    code => {
      expect(press(code).defaultPrevented).toBe(true);
      expect(showState.outputNext).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['ArrowLeft', 'PageUp'])('outputs the previous 장 with %s', code => {
    expect(press(code).defaultPrevented).toBe(true);
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
  });

  it('matches the physical key and not the character', () => {
    press('ArrowRight', {key: 'ㅊ'});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    press('KeyA', {key: 'ArrowRight'});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    press('ArrowUp');
    press('ArrowDown');
    press('Enter');
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier', () => {
    press('ArrowRight', {ctrlKey: true});
    press('ArrowRight', {shiftKey: true});
    press('PageDown', {altKey: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('runs a held key once and still swallows the repeats', () => {
    press('PageDown');
    const repeated = press('PageDown', {repeat: true});
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(repeated.defaultPrevented).toBe(true);
  });

  it('ignores an event that is already handled', () => {
    const event = keyEvent({type: 'keydown', code: 'ArrowRight'});
    event.preventDefault();
    handleShowKey(event);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('works with the 장 grid and the 예배 순서 list in focus', () => {
    const grid = appendTo('div', {role: 'listbox'});
    const tile = grid.appendChild(document.createElement('button'));
    const list = appendTo('div', {role: 'listbox'});
    const row = list.appendChild(document.createElement('button'));
    press('ArrowRight', {}, tile);
    press('Space', {}, row);
    expect(showState.outputNext).toHaveBeenCalledTimes(2);
  });
});

describe('handleShowKey where a focused control takes the key', () => {
  it.each(['button', 'switch', 'checkbox', 'radio', 'tab'])(
    'leaves Space to a focused %s so that it presses',
    role => {
      const control = appendTo('div', {role, tabindex: '0'});
      const event = press('Space', {}, control);
      expect(showState.outputNext).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it('leaves Space to a button that has focus and cancels nothing on key up', () => {
    const button = appendTo('button');
    const event = press('Space', {}, button);
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(release('Space', button).defaultPrevented).toBe(false);
  });

  it('leaves the left and right arrows to a focused tab or radio only', () => {
    press('ArrowRight', {}, appendTo('div', {role: 'tab'}));
    press('ArrowLeft', {}, appendTo('div', {role: 'radio'}));
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
    press('ArrowRight', {}, appendTo('button'));
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });

  it('still passes Page keys on from a focused button', () => {
    press('PageDown', {}, appendTo('button'));
    press('PageUp', {}, appendTo('button'));
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(showState.outputPrevious).toHaveBeenCalledTimes(1);
  });

  it('still takes Space from a button of the 장 grid and the 예배 순서 list', () => {
    const grid = appendTo('div', {role: 'listbox'});
    const list = appendTo('div', {role: 'listbox'});
    press('Space', {}, grid.appendChild(document.createElement('button')));
    press('Space', {}, list.appendChild(document.createElement('button')));
    expect(showState.outputNext).toHaveBeenCalledTimes(2);
  });
});

describe('handleShowKey item keys', () => {
  it('opens the next item with Ctrl Down and swallows the key', () => {
    const event = press('ArrowDown', {ctrlKey: true});
    expect(showState.openNextItem).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('opens the previous item with Ctrl Up', () => {
    press('ArrowUp', {ctrlKey: true});
    expect(showState.openPreviousItem).toHaveBeenCalledTimes(1);
  });

  it('opens the live item with Ctrl L', () => {
    press('KeyL', {ctrlKey: true});
    expect(showState.revealLiveItem).toHaveBeenCalledTimes(1);
  });

  it('outputs nothing for these keys', () => {
    press('ArrowDown', {ctrlKey: true});
    press('ArrowUp', {ctrlKey: true});
    press('KeyL', {ctrlKey: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('works with the 장 grid and the 예배 순서 list in focus', () => {
    const grid = appendTo('div', {role: 'listbox'});
    const list = appendTo('div', {role: 'listbox'});
    const tile = grid.appendChild(document.createElement('button'));
    const row = list.appendChild(document.createElement('button'));
    press('ArrowDown', {ctrlKey: true}, tile);
    press('ArrowUp', {ctrlKey: true}, row);
    expect(showState.openNextItem).toHaveBeenCalledTimes(1);
    expect(showState.openPreviousItem).toHaveBeenCalledTimes(1);
  });

  it('lets a held key repeat, because it only selects', () => {
    press('ArrowDown', {ctrlKey: true});
    press('ArrowDown', {ctrlKey: true, repeat: true});
    expect(showState.openNextItem).toHaveBeenCalledTimes(2);
  });

  it('ignores other modifiers and the keys without Ctrl', () => {
    press('ArrowDown', {ctrlKey: true, shiftKey: true});
    press('ArrowDown', {ctrlKey: true, altKey: true});
    press('ArrowDown');
    press('KeyL');
    expect(showState.openNextItem).not.toHaveBeenCalled();
    expect(showState.revealLiveItem).not.toHaveBeenCalled();
  });

  it('ignores other keys with Ctrl, which stay free for other commands', () => {
    const event = press('KeyZ', {ctrlKey: true});
    press('ArrowRight', {ctrlKey: true});
    expect(event.defaultPrevented).toBe(false);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('opens the live item from a text field, but leaves Ctrl arrows to the caret', () => {
    const input = appendTo('input');
    const textarea = appendTo('textarea');
    const live = press('KeyL', {ctrlKey: true}, input);
    const down = press('ArrowDown', {ctrlKey: true}, textarea);
    const up = press('ArrowUp', {ctrlKey: true}, input);
    expect(showState.revealLiveItem).toHaveBeenCalledTimes(1);
    expect(live.defaultPrevented).toBe(true);
    expect(showState.openNextItem).not.toHaveBeenCalled();
    expect(showState.openPreviousItem).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(false);
    expect(up.defaultPrevented).toBe(false);
  });

  it('runs all three from the thumbnail slider and from a checkbox', () => {
    const slider = appendTo('input', {type: 'range'});
    const checkbox = appendTo('input', {type: 'checkbox'});
    press('ArrowDown', {ctrlKey: true}, slider);
    press('ArrowUp', {ctrlKey: true}, slider);
    press('KeyL', {ctrlKey: true}, slider);
    press('ArrowDown', {ctrlKey: true}, checkbox);
    expect(showState.openNextItem).toHaveBeenCalledTimes(2);
    expect(showState.openPreviousItem).toHaveBeenCalledTimes(1);
    expect(showState.revealLiveItem).toHaveBeenCalledTimes(1);
  });

  it('runs them from a focused button, which keeps only its own keys', () => {
    const button = appendTo('button');
    press('ArrowDown', {ctrlKey: true}, button);
    expect(showState.openNextItem).toHaveBeenCalledTimes(1);
  });

  it('leaves the keys to a text field, an open menu, an IME composition, and a drag', () => {
    press('ArrowDown', {ctrlKey: true}, appendTo('input'));
    press('KeyL', {ctrlKey: true}, appendTo('div', {role: 'menu'}));
    press('ArrowUp', {ctrlKey: true, isComposing: true});
    setColumnDragActive(true);
    press('ArrowDown', {ctrlKey: true});
    expect(showState.openNextItem).not.toHaveBeenCalled();
    expect(showState.openPreviousItem).not.toHaveBeenCalled();
    expect(showState.revealLiveItem).not.toHaveBeenCalled();
  });
});

describe('handleShowKey where another part owns the key', () => {
  it('leaves keys to a text field', () => {
    const event = press('Space', {}, appendTo('input'));
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves keys to an IME composition', () => {
    press('ArrowRight', {isComposing: true});
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it.each(['menu', 'dialog', 'alertdialog'])(
    'leaves keys to an open %s',
    role => {
      const container = appendTo('div', {role});
      const item = container.appendChild(document.createElement('button'));
      press('Space', {}, item);
      expect(showState.outputNext).not.toHaveBeenCalled();
    },
  );
});

describe('handleShowKey during a column drag', () => {
  it('stays inactive for every live key', () => {
    setColumnDragActive(true);
    for (const code of [
      'Space',
      'ArrowRight',
      'ArrowLeft',
      'PageDown',
      'PageUp',
      'KeyC',
    ]) {
      expect(press(code).defaultPrevented).toBe(false);
    }
    expect(showState.outputNext).not.toHaveBeenCalled();
    expect(showState.outputPrevious).not.toHaveBeenCalled();
  });

  it('works again when the drag has ended', () => {
    setColumnDragActive(true);
    setColumnDragActive(false);
    press('Space');
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });
});

describe('handleShowKey slide keys', () => {
  it('leaves source-slide keys to the mounted shortcut hook', () => {
    vi.spyOn(showState, 'hasSlideHotKey').mockReturnValue(true);
    expect(press('KeyC').defaultPrevented).toBe(false);
    expect(showState.outputHotKey).not.toHaveBeenCalled();
  });
});
describe('handleShowKeyUp', () => {
  it('cancels the key up of a Space that the live handler took', () => {
    press('Space');
    expect(release('Space').defaultPrevented).toBe(true);
  });

  it('cancels only that one key up', () => {
    press('Space');
    release('Space');
    expect(release('Space').defaultPrevented).toBe(false);
  });

  it('leaves the key up of a Space that was not taken', () => {
    press('Space', {}, appendTo('input'));
    expect(release('Space', appendTo('button')).defaultPrevented).toBe(false);
  });

  it('leaves the key up of a Space during a column drag', () => {
    setColumnDragActive(true);
    press('Space');
    expect(release('Space').defaultPrevented).toBe(false);
  });

  it('ignores other keys', () => {
    press('Space');
    expect(release('Enter').defaultPrevented).toBe(false);
    expect(release('Space').defaultPrevented).toBe(true);
  });
});
