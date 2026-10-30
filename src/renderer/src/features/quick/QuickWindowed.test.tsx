import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {QuickPanel} from './QuickPanel';
import {quickFixture, quickId} from './quickTesting';

afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('bounds a long quick list and reaches its last row by keyboard', async () => {
  const fixture = quickFixture();
  const parsed = parseSettingsDocument({
    name: 'quick',
    revision: 2,
    access: 'editable',
    value: {
      format: 'llsettings.quick',
      schemaVersion: 1,
      items: Array.from({length: 500}, (_, index) => ({
        id: quickId(index + 1),
        name: `Item ${index + 1}`,
        kind: 'macro',
        ref: quickId(900),
      })),
    },
  });
  if (!parsed.ok || parsed.value.name !== 'quick') {
    throw new Error('Invalid quick fixture');
  }
  fixture.pushQuick(parsed.value);
  window.llp = fixture.api;
  let resize: () => void = () => undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 300, 30),
  );
  const {unmount} = render(
    <QuickPanel selectionVersion={0} onProblem={vi.fn()} />,
  );
  const list = await screen.findByRole('group', {name: '퀵 실행 항목'});
  const viewport = list.parentElement;
  if (!viewport) throw new Error('Missing viewport');
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    value: 150,
  });
  Object.defineProperty(viewport, 'scrollTo', {
    configurable: true,
    value: ({top}: {top: number}) => {
      viewport.scrollTop = top;
    },
  });
  act(resize);
  await waitFor(() =>
    expect(within(list).getAllByRole('button').length).toBeLessThanOrEqual(15),
  );
  const first = within(list).getByRole('button', {name: 'Item 1'});
  fireEvent.contextMenu(first);
  fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
  const name = screen.getByRole<HTMLInputElement>('textbox', {name: '이름'});
  fireEvent.change(name, {target: {value: 'Draft'}});
  viewport.scrollTop = 14900;
  fireEvent.scroll(viewport);
  expect(
    screen.getByRole<HTMLInputElement>('textbox', {name: '이름'}).value,
  ).toBe('Draft');
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  viewport.scrollTop = 0;
  fireEvent.scroll(viewport);
  const firstAgain = within(list).getByRole('button', {name: 'Item 1'});
  firstAgain.focus();
  viewport.scrollTop = 14900;
  fireEvent.scroll(viewport);
  expect(document.activeElement).toBe(firstAgain);
  viewport.scrollTop = 0;
  fireEvent.scroll(viewport);
  for (let index = 2; index <= 12; index++) {
    fireEvent.keyDown(document.activeElement ?? firstAgain, {key: 'Tab'});
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(`Item ${index}`),
    );
  }
  fireEvent.keyDown(document.activeElement ?? firstAgain, {key: 'End'});
  await waitFor(() =>
    expect(document.activeElement?.textContent).toContain('Item 500'),
  );
  expect(within(list).getAllByRole('button').length).toBeLessThanOrEqual(15);
  expect(fixture.send).not.toHaveBeenCalled();
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(observe.mock.calls.length);
});
