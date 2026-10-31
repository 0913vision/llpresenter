import {useEffect} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {
  settingsDocument,
  looksDocument,
  MAIN_ID,
  CAPTIONS_ID,
} from '@core/testing/screenDocuments';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {usePreview} from '@renderer/session/preview';
import {ScreenSummariesProvider} from './ScreenSummaries';
import {MenuBar} from '../app/shell/MenuBar';
import {Toolbar} from '../app/shell/Toolbar';
import {StatusBar} from '../app/shell/StatusBar';
import {summarizeScreens} from './screens';

const lifecycle = vi.hoisted(() => ({mounted: vi.fn(), disposed: vi.fn()}));
vi.mock('@renderer/features/presentation/ScreenPreview', () => ({
  ScreenPreview: ({screenId}: {screenId: string}) => {
    useEffect(() => {
      lifecycle.mounted(screenId);
      return () => {
        lifecycle.disposed(screenId);
      };
    }, [screenId]);
    return <div />;
  },
}));

afterEach(() => {
  cleanup();
  delete window.llp;
  lifecycle.mounted.mockClear();
  lifecycle.disposed.mockClear();
  usePreview.setState({largeScreenId: 'main'});
});

function document(revision: number, name = '사용자 화면', method = 'window') {
  return settingsDocument(
    'screens',
    {
      screens: [
        {id: MAIN_ID, name, kind: 'audience', method},
        {
          id: CAPTIONS_ID,
          name: '사용자 캡처',
          kind: 'audience',
          method: 'capture',
        },
      ],
    },
    revision,
  );
}

it('updates every shell surface from a push, ignores a stale initial read, and keeps keyed previews', async () => {
  let resolveRead: (value: SettingsDocument) => void = () => undefined;
  const pending = new Promise<SettingsDocument>(resolve => {
    resolveRead = resolve;
  });
  const listeners = new Set<(value: SettingsDocument) => void>();
  const get = vi.fn(({name}: {name: string}) =>
    name === 'screens' ? pending : Promise.resolve(looksDocument()),
  );
  const send = vi.fn();
  window.llp = fakeLlpApi({
    settings: {
      get,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    live: {send},
  });
  const view = render(
    <ScreenSummariesProvider onProblem={vi.fn()}>
      <MenuBar
        title=""
        warnings={[{screenId: 'main', screenName: '본 화면'}]}
      />
      <Toolbar workspace="show" sizeClass="normal" onWorkspace={vi.fn()} />
      <PreviewPanel compact={false} />
      <StatusBar />
    </ScreenSummariesProvider>,
  );
  expect(get).toHaveBeenCalledExactlyOnceWith({name: 'screens'});
  expect(
    within(screen.getByRole('group', {name: '화면 출력'})).queryAllByRole(
      'button',
    ),
  ).toHaveLength(0);
  const push = (value: SettingsDocument): void => {
    act(() => {
      for (const listener of listeners) listener(value);
    });
  };
  push(document(2));
  const toggles = screen.getByRole('group', {name: '화면 출력'});
  expect(
    within(toggles)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['사용자 화면', '사용자 캡처']);
  expect(documentText()).not.toMatch(/모니터 2|모니터 3|NDI/);
  expect(lifecycle.mounted).toHaveBeenCalledTimes(2);
  await act(async () => {
    resolveRead(document(1, '오래된 이름', 'fullscreen'));
    await pending;
  });
  expect(documentText()).not.toContain('오래된 이름');
  await userEvent.click(
    within(toggles).getByRole('button', {name: '사용자 화면'}),
  );
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'output.set',
    screenId: MAIN_ID,
    on: true,
  });
  await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
  expect(
    screen.queryByRole('menuitemcheckbox', {name: '사용자 화면'}),
  ).toBeNull();
  push(document(3, '바뀐 화면', 'capture'));
  expect(
    screen.queryByRole('menuitemcheckbox', {name: '사용자 화면'}),
  ).toBeNull();
  expect(
    screen.getAllByRole('menuitemcheckbox').map(item => item.textContent),
  ).toEqual(['방송 자막 켜기']);
  expect(
    screen.getByRole('menuitem', {name: '바뀐 화면 경고 보기'}),
  ).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('');
  expect(lifecycle.mounted).toHaveBeenCalledTimes(2);
  expect(lifecycle.disposed).not.toHaveBeenCalled();
  send.mockClear();
  await userEvent.click(
    screen.getByRole('menuitemcheckbox', {name: '방송 자막 켜기'}),
  );
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'live.batch',
    commands: [MAIN_ID, CAPTIONS_ID].map(screenId => ({
      type: 'output.set',
      screenId,
      on: true,
    })),
  });
  view.unmount();
  expect(listeners.size).toBe(0);
  expect(lifecycle.disposed).toHaveBeenCalledTimes(2);
});

function documentText(): string {
  return globalThis.document.body.textContent;
}

it.each([16, 50])(
  'keeps all %i screen slots reachable without replacing renderers',
  async count => {
    const choices = Array.from({length: count}, (_, index) => ({
      id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `긴 검증용 화면 ${index + 1}`,
      kind: 'audience',
      method: 'window',
    }));
    const saved = settingsDocument('screens', {screens: choices});
    const send = vi.fn();
    window.llp = fakeLlpApi({
      settings: {get: () => Promise.resolve(saved)},
      live: {send},
    });
    const view = render(
      <ScreenSummariesProvider onProblem={vi.fn()}>
        <PreviewPanel compact />
        <StatusBar />
      </ScreenSummariesProvider>,
    );
    const last = choices.at(-1);
    if (last === undefined) throw new Error('Missing final screen fixture');
    const lastButton = await screen.findByRole('button', {
      name: `${last.name} 크게 보기, 출력이 꺼져 있습니다`,
    });
    const firstButton = screen.getAllByRole('button')[0];
    if (firstButton === undefined) throw new Error('Missing first screen slot');
    const pictures = [...view.container.querySelectorAll('[data-screen]')];
    expect(pictures).toHaveLength(count);
    expect(screen.getByRole('status').textContent).toBe('');
    for (let round = 0; round < 20; round++) {
      fireEvent.click(lastButton);
      expect(lastButton.getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(firstButton);
    }
    expect([...view.container.querySelectorAll('[data-screen]')]).toEqual(
      pictures,
    );
    expect(lifecycle.mounted).toHaveBeenCalledTimes(count);
    expect(lifecycle.disposed).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    view.unmount();
    expect(lifecycle.disposed).toHaveBeenCalledTimes(count);
  },
);

it('removes deleted choices and falls back from a deleted large preview without output commands', async () => {
  let push: (value: SettingsDocument) => void = () => undefined;
  const send = vi.fn();
  window.llp = fakeLlpApi({
    settings: {
      get: async () => document(1),
      subscribe: listener => {
        push = listener;
        return () => undefined;
      },
    },
    live: {send},
  });
  render(
    <ScreenSummariesProvider onProblem={vi.fn()}>
      <PreviewPanel compact={false} />
    </ScreenSummariesProvider>,
  );
  await screen.findByRole('button', {name: /사용자 캡처 크게 보기/});
  await userEvent.click(
    screen.getByRole('button', {name: /사용자 캡처 크게 보기/}),
  );
  act(() =>
    push(
      settingsDocument(
        'screens',
        {
          screens: [
            {
              id: MAIN_ID,
              name: '남은 화면',
              kind: 'audience',
              method: 'window',
            },
          ],
        },
        2,
      ),
    ),
  );
  expect(screen.queryByRole('button', {name: /사용자 캡처/})).toBeNull();
  expect(
    screen
      .getByRole('button', {name: /남은 화면 크게 보기/})
      .getAttribute('aria-pressed'),
  ).toBe('true');
  act(() => push(settingsDocument('screens', {screens: []}, 3)));
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(send).not.toHaveBeenCalled();
});

it('reports a failed read without inventing default screen destinations', async () => {
  const onProblem = vi.fn();
  const log = vi.fn();
  window.llp = fakeLlpApi({
    settings: {
      get: async () => {
        throw new Error('read failed');
      },
    },
    log: {write: log},
  });
  render(
    <ScreenSummariesProvider onProblem={onProblem}>
      <StatusBar />
    </ScreenSummariesProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(log).toHaveBeenCalledOnce();
  expect(onProblem).toHaveBeenCalledOnce();
  expect(screen.getByRole('status').textContent).toBe('');
});

it('projects every saved output method and monitor identity in document order', () => {
  const value = settingsDocument('screens', {
    screens: [
      {
        id: MAIN_ID,
        name: '지정 모니터',
        kind: 'audience',
        method: 'fullscreen',
        display: {
          id: 1,
          name: 'Projector',
          number: 7,
          bounds: {x: 0, y: 0, width: 1920, height: 1080},
          scaleFactor: 1,
        },
      },
      {
        id: CAPTIONS_ID,
        name: '캡처',
        kind: 'audience',
        method: 'capture',
        previewBackground: 'black',
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        name: '미지정',
        kind: 'stage',
        method: 'fullscreen',
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        name: '창',
        kind: 'audience',
        method: 'window',
      },
      {
        id: '00000000-0000-4000-8000-000000000005',
        name: '네트워크',
        kind: 'audience',
        method: 'ndi',
      },
    ],
  });
  if (value.name !== 'screens') throw new Error('Expected screens');
  const summaries = summarizeScreens(value.value.screens);
  expect(
    summaries.map(({target, targetKind, chroma}) => ({
      target,
      targetKind,
      chroma,
    })),
  ).toEqual([
    {target: '모니터 7 Projector', targetKind: 'display', chroma: false},
    {target: '캡처용 창', targetKind: 'capture', chroma: false},
    {target: '모니터 미지정', targetKind: 'display', chroma: false},
    {target: '창', targetKind: 'window', chroma: false},
    {target: 'NDI', targetKind: 'ndi', chroma: true},
  ]);
});
