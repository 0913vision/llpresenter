import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import type {UiState} from '@shared/schema/uiState';
import {editorFixture} from '@renderer/prep/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useLive} from '@renderer/state/live';
import {applyService} from '@renderer/state/show';
import {App} from './App';
import {ControlSession} from './controlSession';

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

it('keeps the window choice across workspace switches, apart from the media view of 준비', async () => {
  const {mount, send} = setup(1366, 768);
  mount();
  await userEvent.click(screen.getByRole('button', {name: '미디어'}));
  await screen.findByRole('region', {name: '미디어'});
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  const toggle = screen.getByRole('button', {name: '미디어'});
  expect(toggle.getAttribute('aria-disabled')).toBeNull();
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  await screen.findByRole('region', {name: '미디어'});
  expect(send).not.toHaveBeenCalled();
});

it('sends a mounted panel problem to the app stack without adding a second host', async () => {
  const {api, mount} = setup();
  vi.spyOn(api.media, 'get').mockRejectedValueOnce(
    new Error('Invented media read failure'),
  );
  mount();
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1));
  expect(screen.getByText('미디어 불러오기 실패')).toBeDefined();
  await userEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
  expect(screen.queryByRole('alert')).toBeNull();
});
