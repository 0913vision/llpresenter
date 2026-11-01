// NOTE(0913vision): The hooks below apply to each test file that imports this
// module.
import {afterEach, beforeEach, vi} from 'vitest';
import {setColumnDragActive} from '@renderer/platform/drag';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import * as showState from '@renderer/session/show';
import * as bibleKeys from '@renderer/features/bible/verseShortcuts';
import {
  handleShowKey,
  handleShowKeyUp,
} from '@renderer/features/presentation/shortcuts';

export function keyEvent(params: {
  readonly type: 'keydown' | 'keyup';
  readonly code: string;
  readonly options?: KeyboardEventInit;
  readonly target?: Element;
}): KeyboardEvent {
  const {type, code, options = {}, target = document.body} = params;
  const event = new KeyboardEvent(type, {
    code,
    key: 'Unidentified',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  Object.defineProperty(event, 'target', {value: target});
  return event;
}

export function press(
  code: string,
  options: KeyboardEventInit = {},
  target: Element = document.body,
): KeyboardEvent {
  const event = keyEvent({type: 'keydown', code, options, target});
  handleShowKey(event);
  return event;
}

export function release(
  code: string,
  target: Element = document.body,
): KeyboardEvent {
  const event = keyEvent({type: 'keyup', code, target});
  handleShowKeyUp(event);
  return event;
}

export function appendTo(tag: string, attributes: Record<string, string> = {}) {
  const element = document.body.appendChild(document.createElement(tag));
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}

beforeEach(() => {
  seedSampleService();
  vi.spyOn(showState, 'outputNext').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputPrevious').mockImplementation(() => undefined);
  vi.spyOn(showState, 'outputHotKey').mockImplementation(() => true);
  vi.spyOn(showState, 'openNextItem').mockImplementation(() => undefined);
  vi.spyOn(showState, 'openPreviousItem').mockImplementation(() => undefined);
  vi.spyOn(showState, 'revealLiveItem').mockImplementation(() => undefined);
  vi.spyOn(bibleKeys, 'outputAdjacentBibleVerse').mockResolvedValue(undefined);
});

afterEach(() => {
  setColumnDragActive(false);
  release('Space');
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
