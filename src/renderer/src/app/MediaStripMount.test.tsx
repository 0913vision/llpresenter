import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {UiState} from '@core/schema/uiState';
import {editorFixture} from '@renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/platform/live';
import {applyService} from '@renderer/state/show';
import {App} from './App';
import {ControlSession} from './controlSession';
import {
  mediaDocument,
  mediaItem,
  mediaId,
  playlistId,
} from '@renderer/features/media/mediaTesting';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];
function setup(width = 1920, height = 1080, uiState: UiState = {}) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
  const {api} = editorFixture();
  const send = vi.spyOn(api.live, 'send');
  const save = vi.spyOn(api.ui, 'setMediaStrip');
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  return {
    api,
    send,
    save,
    mount: () =>
      render(
        <App
          session={session}
          columnWidthStore={createMemoryColumnWidthStore()}
          uiState={uiState}
        />,
      ),
  };
}

beforeEach(() => {
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});

it.each(['menu', 'shortcut'] as const)(
  'toggles the shared bin in 준비 through the %s entry point',
  async entry => {
    const {mount, save, send} = setup(1920, 1080, {mediaStrip: false});
    mount();
    await userEvent.click(screen.getByRole('tab', {name: '준비'}));
    const toggle = async (): Promise<void> => {
      if (entry === 'menu') {
        await userEvent.click(screen.getByRole('menuitem', {name: '보기'}));
        await userEvent.click(screen.getByRole('menuitem', {name: /^미디어/u}));
      } else {
        fireEvent.keyDown(window, {
          code: 'KeyV',
          key: 'V',
          ctrlKey: true,
          shiftKey: true,
        });
      }
    };
    await toggle();
    expect(
      await screen.findByRole('region', {name: '미디어 보관함'}),
    ).toBeDefined();
    expect(
      screen.getByRole('tab', {name: '준비'}).getAttribute('aria-selected'),
    ).toBe('true');
    expect(save).toHaveBeenLastCalledWith({visible: true});
    await toggle();
    expect(screen.queryByRole('region', {name: '미디어 보관함'})).toBeNull();
    expect(save).toHaveBeenLastCalledWith({visible: false});
    expect(send).not.toHaveBeenCalled();
  },
);
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it.each([
  {width: 1920, height: 900, open: true},
  {width: 2560, height: 1080, open: true},
  {width: 1920, height: 899, open: false},
  {width: 1366, height: 1080, open: false},
])(
  'starts the strip at $width x $height with open=$open',
  async ({width, height, open}) => {
    const {mount, send} = setup(width, height);
    mount();
    expect(
      screen.getByRole('button', {name: '미디어'}).getAttribute('aria-pressed'),
    ).toBe(String(open));
    if (open) {
      expect(await screen.findByRole('region', {name: '미디어'})).toBeDefined();
    } else {
      expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
    }
    expect(send).not.toHaveBeenCalled();
  },
);

it.each([
  {width: 2560, height: 1080, visible: false},
  {width: 1366, height: 768, visible: true},
])(
  'restores visible=$visible at $width x $height and saves only an explicit toggle',
  async ({width, height, visible}) => {
    const {mount, save} = setup(width, height, {mediaStrip: visible});
    mount();
    const button = screen.getByRole('button', {name: '미디어'});
    expect(button.getAttribute('aria-pressed')).toBe(String(visible));
    if (visible) {
      expect(await screen.findByRole('region', {name: '미디어'})).toBeDefined();
    } else {
      expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
    }
    expect(save).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(save).toHaveBeenCalledExactlyOnceWith({visible: !visible});
    vi.stubGlobal('innerHeight', height + 1);
    fireEvent.resize(window);
    expect(button.getAttribute('aria-pressed')).toBe(String(!visible));
    expect(save).toHaveBeenCalledTimes(1);
  },
);

it.each([
  {height: 750, factor: 1.2, open: true},
  {height: 749, factor: 1.2, open: false},
  {height: 450, factor: 2, open: true},
])(
  'uses DIP height at CSS $height and factor $factor',
  async ({height, factor, open}) => {
    const {api, mount, save, send} = setup(1920, height);
    vi.spyOn(api.ui, 'getZoomFactor').mockReturnValue(factor);
    vi.stubGlobal('devicePixelRatio', 3);
    mount();
    expect(
      screen.getByRole('button', {name: '미디어'}).getAttribute('aria-pressed'),
    ).toBe(String(open));
    if (open) {
      expect(await screen.findByRole('region', {name: '미디어'})).toBeDefined();
    } else {
      expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
    }
    expect(save).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  },
);

it('remeasures DIP after zoom and resize without saving a new choice', async () => {
  const {api, mount, save} = setup(1920, 750);
  const factor = vi.spyOn(api.ui, 'getZoomFactor').mockReturnValue(1.2);
  mount();
  await screen.findByRole('region', {name: '미디어'});
  factor.mockReturnValue(1.5);
  vi.stubGlobal('innerHeight', 600);
  fireEvent.resize(window);
  expect(screen.getByRole('region', {name: '미디어'})).toBeDefined();
  vi.stubGlobal('innerHeight', 599);
  fireEvent.resize(window);
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it('unmounts the real panel and both media feeds when toggled off', async () => {
  const {api, send, mount} = setup();
  const stopMedia = vi.fn();
  const stopCopies = vi.fn();
  const subscribe = vi.spyOn(api.media, 'subscribe').mockReturnValue(stopMedia);
  vi.spyOn(api.media, 'subscribeImports').mockReturnValue(stopCopies);
  mount();
  await screen.findByRole('region', {name: '미디어'});
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  expect(stopMedia).toHaveBeenCalledOnce();
  expect(stopCopies).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  await screen.findByRole('region', {name: '미디어'});
  expect(subscribe).toHaveBeenCalledTimes(2);
  expect(send).not.toHaveBeenCalled();
});

it('keeps the local choice and logs a failed send without changing output', async () => {
  const {api, mount, send, save} = setup();
  const log = vi.spyOn(api.log, 'write');
  save.mockImplementation(() => {
    throw new Error('Invented visibility send failure');
  });
  mount();
  await screen.findByRole('region', {name: '미디어'});
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  expect(log).toHaveBeenCalledWith({
    level: 'error',
    message: 'Could not save media strip visibility',
    detail: 'Invented visibility send failure',
  });
  expect(send).not.toHaveBeenCalled();
});

it('applies resize defaults until the operator makes an explicit choice', async () => {
  const {mount} = setup();
  mount();
  await screen.findByRole('region', {name: '미디어'});
  vi.stubGlobal('innerHeight', 899);
  fireEvent.resize(window);
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  vi.stubGlobal('innerWidth', 1366);
  vi.stubGlobal('innerHeight', 1080);
  fireEvent.resize(window);
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  await screen.findByRole('region', {name: '미디어'});
  vi.stubGlobal('innerHeight', 768);
  fireEvent.resize(window);
  expect(screen.getByRole('region', {name: '미디어'})).toBeDefined();
});

it('shares the same bottom bin and visibility across 진행 and 준비', async () => {
  const {mount, send} = setup(1366, 768);
  mount();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  await screen.findByRole('region', {name: '미디어'});
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  const bin = screen.getByRole('region', {name: '미디어 보관함'});
  expect(screen.getByRole('region', {name: '미디어'})).toBeDefined();
  expect(screen.getByRole('region', {name: '라이브러리'})).toBeDefined();
  const toggle = screen.getByRole('button', {name: '미디어'});
  expect(toggle.getAttribute('aria-disabled')).toBeNull();
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  await screen.findByRole('region', {name: '미디어'});
  expect(screen.getByRole('region', {name: '미디어 보관함'})).toBe(bin);
  expect(send).not.toHaveBeenCalled();
});

it('keeps the bin playlist and selected properties across workspace and visibility changes', async () => {
  const {api, mount, send} = setup(1920, 1080, {
    mediaStrip: false,
    prepMedia: true,
  });
  const saveLegacy = vi.spyOn(api.ui, 'setPrepMedia');
  const subscribe = vi.spyOn(api.media, 'subscribe');
  vi.spyOn(api.media, 'get').mockResolvedValue(
    mediaDocument(
      [
        mediaItem(1, {name: 'First image', kind: 'image', file: 'first.png'}),
        mediaItem(2, {name: 'Second image', kind: 'image', file: 'second.png'}),
      ],
      1,
      {
        playlists: [
          {id: playlistId(1), name: 'Target', items: [mediaId(1), mediaId(2)]},
        ],
      },
    ),
  );
  mount();
  expect(screen.queryByRole('region', {name: '미디어 보관함'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  const bin = await screen.findByRole('region', {name: '미디어 보관함'});
  const playlists = within(bin).getByRole('listbox', {name: '미디어 목록'});
  await userEvent.click(
    await within(playlists).findByRole('option', {name: /Target/}),
  );
  await userEvent.click(within(bin).getByRole('option', {name: 'First image'}));
  const sent = send.mock.calls.length;
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  expect(screen.getByRole('region', {name: '미디어 보관함'})).toBe(bin);
  expect(
    within(bin).getByRole('option', {name: 'First image', selected: true}),
  ).toBeDefined();
  await userEvent.click(
    within(bin).getByRole('option', {name: 'Second image'}),
  );
  expect(send).toHaveBeenCalledTimes(sent);
  expect(subscribe).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  expect(screen.queryByRole('region', {name: '미디어 보관함'})).toBeNull();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  expect(
    await screen.findByRole('option', {name: 'Second image', selected: true}),
  ).toBeDefined();
  const properties = screen.getByRole('region', {name: '속성'});
  expect(within(properties).getByText('Second image')).toBeDefined();
  expect(properties.querySelectorAll('img')).toHaveLength(1);
  expect(saveLegacy).not.toHaveBeenCalled();
});

it('sends a mounted panel problem to the app stack without adding a second host', async () => {
  const {api, mount} = setup();
  vi.spyOn(api.media, 'get').mockRejectedValueOnce(
    new Error('Invented media read failure'),
  );
  mount();
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
  expect(screen.getByText('미디어를 불러오지 못함')).toBeDefined();
  await userEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
  expect(screen.queryByRole('alert')).toBeNull();
});
