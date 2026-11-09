import {useRef} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {
  ShowSlideEntry,
  useShowPanelNavigation,
} from '@renderer/features/presentation/showPanelNavigation';
import {SlideGrid} from '@renderer/features/presentation/SlideGrid';
import {
  applyService,
  openItem,
  selectTile,
  tilesOf,
} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/live/state';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';

function Surface({
  hidden = false,
  active = true,
}: {
  readonly hidden?: boolean;
  readonly active?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const navigation = useShowPanelNavigation(root, active);
  return (
    <ShowSlideEntry value={navigation.slideEntry}>
      <button>Toolbar</button>
      <main
        ref={root}
        data-workspace-layout={active ? 'show' : 'prep'}
        onKeyDown={navigation.onKeyDown}
      >
        <div>
          <section data-panel="예배 순서">
            <button>Service picker</button>
            <div role="listbox" aria-label="예배 순서">
              <button role="option" aria-selected={false} tabIndex={-1}>
                Other row
              </button>
              <button role="option" aria-selected tabIndex={0}>
                Current row
              </button>
            </div>
          </section>
          <section data-panel="퀵 실행" hidden={hidden}>
            <input
              aria-label="책"
              onKeyDown={event => {
                if (
                  event.key === 'Tab' &&
                  event.currentTarget.value === 'invalid'
                ) {
                  event.preventDefault();
                }
              }}
            />
            <button disabled>Unavailable</button>
          </section>
        </div>
        <section data-panel="슬라이드">
          <button>Slide header</button>
          <div>
            <SlideGrid columns={4} scalePercent={100} />
          </div>
          <span role="group" aria-label="슬라이드 크기">
            <input type="range" aria-label="Size" />
            <input aria-label="Percentage" />
          </span>
        </section>
        <div>
          <section data-panel="미리보기">
            <button>Preview</button>
          </section>
          <section data-panel="지우기">
            <button>Clear</button>
          </section>
          <section
            data-panel="진행 도구"
            style={hidden ? {display: 'none'} : undefined}
          >
            <button>Tools</button>
          </section>
        </div>
        <section aria-label="미디어 보관함">
          <button>Media</button>
        </section>
      </main>
      <button>After workspace</button>
    </ShowSlideEntry>
  );
}

beforeEach(() => {
  window.llp = mockLlpApi();
  commandBindingStore.set({});
  useLive.setState({state: null});
  applyService({
    revision: 100,
    id: 'service',
    name: 'Service',
    readOnly: false,
    rows: [{id: 'song', kind: 'song', title: 'Song'}],
    tiles: {
      song: Array.from({length: 80}, (_, index) => ({
        label: null,
        labelColor: 'none',
        lines: [`Slide ${index + 1}`],
      })),
    },
    jumpKeys: {},
  });
  openItem('song');
  selectTile(2);
});
afterEach(() => {
  cleanup();
  commandBindingStore.set({});
  useLive.setState({state: null});
  delete window.llp;
});

function byName(name: string): HTMLElement {
  return screen.getByRole('button', {name});
}
function chosenSlide(): HTMLElement {
  return screen.getByRole('listbox', {name: '슬라이드'});
}

it.each([false, true])(
  'visits all existing panels forward and backward, hidden=%s',
  async hidden => {
    const user = userEvent.setup();
    render(<Surface hidden={hidden} />);
    const order = [
      byName('Toolbar'),
      byName('Service picker'),
      screen.getByRole('option', {name: 'Current row'}),
      chosenSlide(),
      screen.getByLabelText('Size'),
      screen.getByLabelText('Percentage'),
      byName('Slide header'),
      ...(hidden ? [] : [screen.getByLabelText('책')]),
      byName('Preview'),
      byName('Clear'),
      ...(hidden ? [] : [byName('Tools')]),
      byName('Media'),
      byName('After workspace'),
    ];
    order[0]?.focus();
    for (const target of order.slice(1)) {
      await user.tab();
      expect(document.activeElement).toBe(target);
    }
    for (const target of order.slice(0, -1).reverse()) {
      await user.tab({shift: true});
      expect(document.activeElement).toBe(target);
    }
  },
);

it('returns from the grid to the same service row without output and respects input validation', async () => {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const user = userEvent.setup();
  render(<Surface />);
  const row = screen.getByRole('option', {name: 'Current row'});
  row.focus();
  await user.tab();
  expect(document.activeElement).toBe(chosenSlide());
  await user.tab({shift: true});
  expect(document.activeElement).toBe(row);
  const field = screen.getByLabelText('책');
  fireEvent.change(field, {target: {value: 'invalid'}});
  field.focus();
  await user.tab();
  expect(document.activeElement).toBe(field);
  expect(send).not.toHaveBeenCalled();
});

it('reveals an unmounted live slide on entry, without changing output', async () => {
  const send = vi.fn();
  window.llp = mockLlpApi({live: {send}});
  const user = userEvent.setup();
  render(<Surface />);
  const state = emptyLiveState();
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {itemId: 'song', position: 65, label: null, lines: ['Live']},
        },
      },
    }),
  );
  screen.getByRole('option', {name: 'Current row'}).focus();
  await user.tab();
  expect(document.activeElement).toBe(chosenSlide());
  expect(send).not.toHaveBeenCalled();
});

it.each([{selected: 2}, {selected: 65}])(
  'keeps Tab moving after the live slide is deleted, selection $selected',
  async ({selected}) => {
    const send = vi.fn();
    window.llp = mockLlpApi({live: {send}});
    const user = userEvent.setup();
    const state = emptyLiveState();
    const live = {
      ...state,
      layers: {
        ...state.layers,
        slide: {
          itemId: 'song',
          position: 65,
          label: null,
          lines: ['Still on output'],
        },
      },
    };
    useLive.setState({state: live});
    selectTile(selected);
    render(<Surface />);
    const row = screen.getByRole('option', {name: 'Current row'});
    row.focus();
    act(() =>
      applyService({
        revision: 101,
        id: 'service',
        name: 'Service',
        readOnly: false,
        rows: [{id: 'song', kind: 'song', title: 'Song'}],
        tiles: {song: tilesOf('song').slice(0, 10)},
        jumpKeys: {},
      }),
    );
    await user.tab();
    expect(document.activeElement).toBe(chosenSlide());
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Size'));
    await user.tab({shift: true});
    await user.tab({shift: true});
    expect(document.activeElement).toBe(row);
    expect(useLive.getState().state).toBe(live);
    expect(send).not.toHaveBeenCalled();
  },
);

it('uses assigned panel keys only in show and leaves modal and IME keys alone', () => {
  const view = render(<Surface />);
  act(() =>
    commandBindingStore.set({'panel.slides': [{code: 'F8', mods: []}]}),
  );
  const row = screen.getByRole('option', {name: 'Current row'});
  row.focus();
  fireEvent.keyDown(row, {key: 'F8', code: 'F8', isComposing: true});
  expect(document.activeElement).toBe(row);
  fireEvent.keyDown(row, {key: 'F8', code: 'F8'});
  expect(document.activeElement).toBe(chosenSlide());
  fireEvent.keyUp(document.activeElement ?? row, {key: 'F8', code: 'F8'});
  const modal = document.body.appendChild(document.createElement('div'));
  modal.setAttribute('role', 'dialog');
  row.focus();
  fireEvent.keyDown(row, {key: 'F8', code: 'F8'});
  fireEvent.keyDown(row, {key: 'Tab', code: 'Tab'});
  expect(document.activeElement).toBe(row);
  modal.remove();
  view.rerender(<Surface active={false} />);
  fireEvent.keyDown(row, {key: 'F8', code: 'F8'});
  expect(document.activeElement).toBe(row);
});

it.each([
  ['order', 'Current row'],
  ['slides', '슬라이드'],
  ['quick', '책'],
  ['preview', 'Preview'],
  ['clear', 'Clear'],
  ['tools', 'Tools'],
  ['media', 'Media'],
])('focuses the current destination for an assigned %s command', (id, name) => {
  render(<Surface />);
  act(() =>
    commandBindingStore.set({[`panel.${id}`]: [{code: 'F8', mods: []}]}),
  );
  byName('Toolbar').focus();
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: 'F8',
    code: 'F8',
  });
  const target =
    id === 'quick'
      ? screen.getByLabelText(name)
      : id === 'slides'
        ? screen.getByRole('listbox', {name})
        : id === 'order'
          ? screen.getByRole('option', {name})
          : byName(name);
  expect(document.activeElement).toBe(target);
  fireEvent.keyUp(target, {key: 'F8', code: 'F8'});
});
