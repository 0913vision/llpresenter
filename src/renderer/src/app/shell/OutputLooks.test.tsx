import {act, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {stageLayoutsDocument} from '@core/testing/screenDocuments';
import {useLive} from '@renderer/session/live';
import {MenuBar} from './MenuBar';
import {renderWithScreenSummaries as render} from '../../platform/testing/screenSummaries';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';

function looksDocument(revision = 1, current = first) {
  const parsed = parseSettingsDocument({
    name: 'looks',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.looks',
      schemaVersion: 1,
      current,
      looks: [
        {id: first, name: '평상시', screens: {}},
        {id: second, name: '설교', screens: {}},
      ],
      lyricStyles: [],
    },
  });
  if (!parsed.ok || parsed.value.name !== 'looks') {
    throw new Error('Invalid Look fixture');
  }
  return parsed.value;
}

function setup() {
  const send = vi.fn();
  const stop = vi.fn();
  const onProblem = vi.fn();
  const listeners = new Set<(document: SettingsDocument) => void>();
  const api = mockLlpApi({
    live: {send},
    settings: {
      get: request =>
        Promise.resolve(
          request.name === 'stage-layouts'
            ? stageLayoutsDocument()
            : looksDocument(),
        ),
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
          stop();
        };
      },
    },
  });
  window.llp = api;
  const view = render(<MenuBar title="" onProblem={onProblem} />);
  return {
    api,
    send,
    stop,
    onProblem,
    view,
    push: (document: SettingsDocument) => {
      for (const listener of listeners) listener(document);
    },
  };
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useLive.setState({state: {...emptyLiveState(), outputs: {main: true}}});
});

afterEach(() => {
  useLive.setState({state: null});
  delete window.llp;
});

async function openLooks(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('menuitem', {name: /^Look(: .*)?$/}),
  );
  await screen.findByRole('menu', {name: /^Look(: .*)?$/});
}

async function openOutput(): Promise<void> {
  await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
}

async function openMenu(): Promise<void> {
  await openOutput();
  await openLooks();
}

describe('Looks in the 출력 menu', () => {
  it('loads on hover switching and clears old choices before reopening by hover', async () => {
    const {api} = setup();
    const file = screen.getByRole('menuitem', {name: '파일'});
    const output = screen.getByRole('menuitem', {name: '출력'});
    await userEvent.click(file);
    await userEvent.hover(output);
    await openLooks();
    await screen.findByRole('menuitemradio', {name: '평상시'});
    await userEvent.hover(file);
    vi.spyOn(api.settings, 'get').mockImplementationOnce(
      () => new Promise(() => undefined),
    );
    await userEvent.hover(output);
    expect(screen.getByRole('menu', {name: '출력'})).toBeDefined();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });

  it('lists Looks after the output toggles and checks the saved fallback for a live state without an override', async () => {
    setup();
    await openMenu();
    expect(
      (await screen.findByRole('menuitemradio', {name: '평상시'})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitemradio', {name: '설교'})
        .getAttribute('aria-checked'),
    ).toBe('false');
    const menu = screen.getByRole('menu', {name: '출력'});
    expect(
      [...menu.querySelectorAll('[role^="menuitem"]')].map(
        item => item.textContent,
      ),
    ).toEqual([
      '출력 끄기',
      'Look: 평상시',
      'Look 편집…',
      '출력 켜기',
      '무대 화면: 없음',
      '무대 배치 편집…',
      '출력 켜기',
      '방송 설정…',
      '화면 설정…Ctrl Alt 1',
    ]);
    expect(
      [
        ...screen
          .getByRole('menu', {name: /^Look(: .*)?$/})
          .querySelectorAll('[role^="menuitem"]'),
      ].map(item => item.textContent),
    ).toEqual(['평상시', '설교']);
    expect(
      within(screen.getByRole('group', {name: '방송 자막'})).getByRole(
        'menuitem',
        {name: '출력 켜기'},
      ).textContent,
    ).toBe('출력 켜기');
  });

  it('keeps the live Look check over a settings current value and follows live changes', async () => {
    const {push} = setup();
    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          lookId: looksDocument(1, second).value.current,
        },
      }),
    );
    await openMenu();
    const selected = await screen.findByRole('menuitemradio', {name: '설교'});
    expect(selected.getAttribute('aria-checked')).toBe('true');
    act(() => push(looksDocument(2, first)));
    expect(selected.getAttribute('aria-checked')).toBe('true');
    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          version: 1,
          lookId: looksDocument().value.current,
        },
      }),
    );
    expect(selected.getAttribute('aria-checked')).toBe('false');
    expect(
      screen
        .getByRole('menuitemradio', {name: '평상시'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('checks no Look before the initial live snapshot', async () => {
    useLive.setState({state: null});
    setup();
    await openMenu();
    await screen.findByRole('menuitemradio', {name: '평상시'});
    expect(
      screen
        .getAllByRole('menuitemradio')
        .every(item => item.getAttribute('aria-checked') === 'false'),
    ).toBe(true);
  });

  it('checks the saved current Look when a settings push deletes the live Look', async () => {
    const {api, push, send} = setup();
    const edit = vi.spyOn(api.settings, 'edit');
    const live = {
      ...emptyLiveState(),
      lookId: looksDocument(1, second).value.current,
    };
    act(() => useLive.setState({state: live}));
    await openMenu();
    expect(
      (await screen.findByRole('menuitemradio', {name: '설교'})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
    const next = looksDocument(2, first);
    act(() =>
      push({
        ...next,
        value: {
          ...next.value,
          looks: next.value.looks.filter(look => look.id !== second),
        },
      }),
    );
    expect(screen.queryByRole('menuitemradio', {name: '설교'})).toBeNull();
    expect(
      screen
        .getByRole('menuitemradio', {name: '평상시'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(useLive.getState().state).toBe(live);
    expect(send).not.toHaveBeenCalled();
    expect(edit).not.toHaveBeenCalled();
  });

  it('sends look.set once and waits for main to change the live selection', async () => {
    const {api, send} = setup();
    const edit = vi.spyOn(api.settings, 'edit');
    const live = useLive.getState().state;
    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '설교'}),
    );
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'look.set',
      lookId: second,
    });
    expect(edit).not.toHaveBeenCalled();
    expect(useLive.getState().state).toBe(live);
    expect(screen.queryByRole('menu')).toBeNull();
    await openMenu();
    expect(
      (await screen.findByRole('menuitemradio', {name: '평상시'})).getAttribute(
        'aria-checked',
      ),
    ).toBe('true');
  });

  it('keeps newer pushed choices over a slow read and releases the subscription on close', async () => {
    const {api, push, stop} = setup();
    let finish: (document: SettingsDocument) => void = () => undefined;
    vi.spyOn(api.settings, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await openOutput();
    const next = looksDocument(2);
    act(() =>
      push({
        ...next,
        value: {
          ...next.value,
          looks: next.value.looks.filter(look => look.id === second),
        },
      }),
    );
    await openLooks();
    await screen.findByRole('menuitemradio', {name: '설교'});
    await act(async () => finish(looksDocument()));
    expect(screen.queryByRole('menuitemradio', {name: '평상시'})).toBeNull();
    await userEvent.keyboard('{Escape}{Escape}');
    expect(stop).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', {name: '출력'}),
    );
  });

  it('reports a failed list load, keeps output toggles usable, and retries after reopening', async () => {
    const {api, send, onProblem} = setup();
    vi.spyOn(api.settings, 'get').mockRejectedValueOnce(
      new Error('Invented read failure'),
    );
    await openOutput();
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: 'Look 불러오기 실패'}),
      ),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: '출력 끄기'}));
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'live.batch',
      commands: [
        {type: 'output.set', screenId: 'main', on: false},
        {type: 'output.set', screenId: 'broadcast', on: false},
      ],
    });
    await openMenu();
    await screen.findByRole('menuitemradio', {name: '평상시'});
  });

  it('reports a failed Look command without changing the live state', async () => {
    const {send, onProblem} = setup();
    send.mockImplementation(() => {
      throw new Error('Invented transport failure');
    });
    const live = useLive.getState().state;
    await openMenu();
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '설교'}),
    );
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({title: 'Look 변경 실패'}),
    );
    expect(useLive.getState().state).toBe(live);
  });
});
