import {useEffect, useImperativeHandle, type JSX} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SettingsRequest} from '@contracts/ipc/window';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {ControlSession} from '@renderer/app/controlSession';
import {SettingsWindow} from '@renderer/app/SettingsWindow';
import type {PreferencesWindow} from '@renderer/app/PreferencesWindow';
import type {ScreensWindow} from '@renderer/app/ScreensWindow';

const mock = vi.hoisted(() => ({
  settle: vi.fn<() => Promise<boolean>>(),
  active: new Set<string>(),
  blur: vi.fn(),
}));
vi.mock('@renderer/app/PreferencesWindow', () => ({
  PreferencesWindow: (
    props: Parameters<typeof PreferencesWindow>[0],
  ): JSX.Element => {
    useImperativeHandle(props.viewRef, () => ({settle: mock.settle}), []);
    useEffect(() => {
      mock.active.add('preferences');
      return () => {
        mock.active.delete('preferences');
      };
    }, []);
    return (
      <main aria-label="preferences">
        <input aria-label="draft" defaultValue="" />
        <button onClick={() => props.request && props.onReady?.(props.request)}>
          preferences ready
        </button>
        <span>{props.request?.page}</span>
      </main>
    );
  },
}));
vi.mock('@renderer/app/ScreensWindow', () => ({
  ScreensWindow: (props: Parameters<typeof ScreensWindow>[0]): JSX.Element => {
    useEffect(() => {
      mock.active.add('screens');
      return () => {
        mock.active.delete('screens');
      };
    }, []);
    return (
      <main aria-label="screens">
        <input aria-label="screen draft" onBlur={mock.blur} />
        <button onClick={props.onReady}>screens ready</button>
      </main>
    );
  },
}));

const general: SettingsRequest = {
  view: 'preferences',
  page: 'general',
  requestId: 1,
  preparing: true,
};
const screens: SettingsRequest = {
  view: 'screens',
  page: 'general',
  requestId: 2,
  preparing: false,
};
const shortcuts: SettingsRequest = {
  view: 'preferences',
  page: 'shortcuts',
  requestId: 3,
  preparing: false,
};

beforeEach(() => {
  mock.active.clear();
  mock.blur.mockClear();
  mock.settle.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  delete window.llp;
});

function mount(initial: Promise<SettingsRequest> = Promise.resolve(general)) {
  let push: (request: SettingsRequest) => void = () => undefined;
  const begin = vi.fn(async () => true);
  const ready = vi.fn();
  const reject = vi.fn();
  const session = new ControlSession(undefined);
  const resume = vi.spyOn(session, 'resume');
  window.llp = mockLlpApi({
    window: {
      settingsRequest: () => initial,
      beginSettingsRequest: begin,
      settingsReady: ready,
      rejectSettingsRequest: reject,
      onSettingsRequest: listener => {
        push = listener;
        return () => undefined;
      },
    },
  });
  render(<SettingsWindow session={session} closeFlush={undefined} />);
  return {
    push: (value: SettingsRequest) => act(() => push(value)),
    begin,
    ready,
    reject,
    resume,
  };
}

describe('the shared settings renderer', () => {
  it('resumes only on reopen, including a hidden request superseded before committing', async () => {
    const {push, resume} = mount();
    await screen.findByRole('main', {name: 'preferences'});
    push(screens);
    await screen.findByRole('main', {name: 'screens'});
    expect(resume).toHaveBeenCalledOnce();
    push(shortcuts);
    await screen.findByRole('main', {name: 'preferences'});
    expect(resume).toHaveBeenCalledOnce();
    push({...general, requestId: 4});
    push({...screens, requestId: 5});
    await screen.findByRole('main', {name: 'screens'});
    expect(resume).toHaveBeenCalledTimes(2);
  });
  it('preserves the inactive view DOM, suspends its effects and identifies readiness', async () => {
    const {push, ready, resume} = mount();
    await screen.findByRole('main', {name: 'preferences'});
    expect(resume).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', {name: 'draft'}), {
      target: {value: 'kept'},
    });
    fireEvent.click(screen.getByRole('button', {name: 'preferences ready'}));
    expect(ready).toHaveBeenLastCalledWith(general);
    push(screens);
    await screen.findByRole('main', {name: 'screens'});
    expect(resume).toHaveBeenCalledOnce();
    await waitFor(() => expect(mock.active).toEqual(new Set(['screens'])));
    fireEvent.click(screen.getByRole('button', {name: 'screens ready'}));
    expect(ready).toHaveBeenLastCalledWith(screens);
    screen.getByRole('textbox', {name: 'screen draft'}).focus();
    push(shortcuts);
    await screen.findByRole('main', {name: 'preferences'});
    await waitFor(() => expect(mock.active).toEqual(new Set(['preferences'])));
    expect(mock.blur).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', {name: 'draft'})).toHaveProperty(
      'value',
      'kept',
    );
    fireEvent.click(screen.getByRole('button', {name: 'preferences ready'}));
    expect(ready).toHaveBeenLastCalledWith(shortcuts);
  });

  it('ignores a slow startup query after a pushed request', async () => {
    let release: (value: SettingsRequest) => void = () => undefined;
    const initial = new Promise<SettingsRequest>(resolve => {
      release = resolve;
    });
    const {push, begin} = mount(initial);
    push(shortcuts);
    await screen.findByText('shortcuts');
    await act(async () => release(general));
    expect(begin).toHaveBeenCalledExactlyOnceWith(shortcuts);
  });

  it('keeps preferences visible during draft settlement and discards superseded requests', async () => {
    const {push, begin, reject} = mount();
    await screen.findByRole('main', {name: 'preferences'});
    let release: (value: boolean) => void = () => undefined;
    mock.settle.mockReturnValueOnce(
      new Promise(resolve => {
        release = resolve;
      }),
    );
    push(screens);
    expect(screen.getByRole('main', {name: 'preferences'})).toBeTruthy();
    expect(begin).toHaveBeenCalledExactlyOnceWith(general);
    push(shortcuts);
    await act(async () => release(false));
    await screen.findByText('shortcuts');
    expect(begin).not.toHaveBeenCalledWith(screens);
    expect(reject).not.toHaveBeenCalled();
    mock.settle.mockResolvedValueOnce(false);
    push({...screens, requestId: 4});
    await waitFor(() =>
      expect(reject).toHaveBeenCalledWith({...screens, requestId: 4}),
    );
    expect(screen.getByRole('main', {name: 'preferences'})).toBeTruthy();
  });
});
