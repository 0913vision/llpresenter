import {settingsDocument} from '@fixtures/core/settingsDocument';
import type {JSX} from 'react';
import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {MAIN_ID, CAPTIONS_ID} from '@fixtures/core/screenDocuments';
import {
  ScreenSummariesProvider,
  useScreenSummaries,
} from '@renderer/platform/ScreenSummaries';
import {summarizeScreens} from '@renderer/platform/screens';
import {projector} from '@fixtures/renderer/features/screens/monitors';

function Labels(): JSX.Element {
  const screens = useScreenSummaries();
  return (
    <ul aria-label="화면 요약">
      {screens.map(summary => (
        <li key={summary.id}>{summary.toolbarLabel}</li>
      ))}
    </ul>
  );
}

function labels(): readonly string[] {
  return screen.queryAllByRole('listitem').map(item => item.textContent);
}

afterEach(() => {
  cleanup();
  delete window.llp;
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

it('follows pushes, ignores a stale initial read, and releases its feed', async () => {
  let resolveRead: (value: SettingsDocument) => void = () => undefined;
  const pending = new Promise<SettingsDocument>(resolve => {
    resolveRead = resolve;
  });
  const listeners = new Set<(value: SettingsDocument) => void>();
  window.llp = mockLlpApi({
    settings: {
      get: () => pending,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  const view = render(
    <ScreenSummariesProvider onProblem={vi.fn()}>
      <Labels />
    </ScreenSummariesProvider>,
  );
  expect(labels()).toEqual([]);
  const push = (value: SettingsDocument): void => {
    act(() => {
      for (const listener of listeners) listener(value);
    });
  };

  push(document(2));
  expect(labels()).toEqual(['사용자 화면', '사용자 캡처']);
  await act(async () => {
    resolveRead(document(1, '오래된 이름', 'fullscreen'));
    await pending;
  });
  expect(labels()).toEqual(['사용자 화면', '사용자 캡처']);
  push(document(3, '바뀐 화면', 'capture'));
  expect(labels()).toEqual(['바뀐 화면', '사용자 캡처']);
  view.unmount();

  expect(listeners.size).toBe(0);
});

it('reports a failed read without inventing default screens', async () => {
  const onProblem = vi.fn();
  const log = vi.fn();
  window.llp = mockLlpApi({
    settings: {
      get: async () => {
        throw new Error('read failed');
      },
    },
    log: {write: log},
  });
  render(
    <ScreenSummariesProvider onProblem={onProblem}>
      <Labels />
    </ScreenSummariesProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });

  expect(log).toHaveBeenCalledOnce();
  expect(onProblem).toHaveBeenCalledOnce();
  expect(labels()).toEqual([]);
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
  const matched = summarizeScreens(value.value.screens, [
    {...projector, number: 1, name: 'Current', screenIds: [MAIN_ID]},
  ]);
  expect(matched[0]?.target).toBe('모니터 1 Current');
  expect(summaries[0]?.target).toBe('모니터 7 Projector');
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
