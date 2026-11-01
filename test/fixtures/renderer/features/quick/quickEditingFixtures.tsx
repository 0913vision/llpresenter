// NOTE(0913vision): The hooks below apply to each test file that imports this
// module.
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import {useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {
  quickDocument,
  quickFixture,
  quickId,
  quickLive,
} from '@fixtures/renderer/features/tools/quickTesting';

export function setup() {
  const base = quickFixture();
  let document = quickDocument();
  const push = (next: typeof document): void => {
    document = next;
    base.pushQuick(next);
  };
  const get = vi.fn<LlpApi['settings']['get']>(request => {
    if (request.name === 'quick') return Promise.resolve(document);
    if (
      request.name === 'props' ||
      request.name === 'timers' ||
      request.name === 'macros'
    ) {
      const contents = {
        props: {
          props: [
            {
              id: quickId(103),
              name: '그래픽 대상',
              content: {kind: 'image', media: quickId(111)},
              targets: [],
            },
          ],
        },
        timers: {
          timers: [{id: quickId(114), name: '타이머 대상', kind: 'clock'}],
        },
        macros: {
          macros: [
            {
              id: quickId(105),
              name: '매크로 대상',
              icon: 'macro',
              color: 'teal',
              actions: [],
            },
          ],
          collections: [],
        },
      };
      const parsed = parseSettingsDocument({
        name: request.name,
        revision: 1,
        access: 'editable',
        value: {
          format: `llsettings.${request.name}`,
          schemaVersion: 1,
          ...contents[request.name],
        },
      });
      if (!parsed.ok) throw new Error('Invalid target fixture');
      return Promise.resolve(parsed.value);
    }
    return base.get(request);
  });
  const edit = vi.fn<LlpApi['settings']['edit']>(change => {
    if (change.type === 'quick.timer.rename') {
      push({
        ...document,
        revision: document.revision + 1,
        value: {
          ...document.value,
          items: document.value.items.map(item =>
            item.id === change.quickItemId
              ? {...item, name: change.timerName}
              : item,
          ),
        },
      });
      return Promise.resolve({
        ok: true,
        value: {id: change.quickItemId, revision: document.revision},
      });
    }
    if (change.type === 'quick.timer.create') {
      push({
        ...document,
        revision: document.revision + 1,
        value: {
          ...document.value,
          items: [
            ...document.value.items,
            {
              id: change.quickItemId,
              kind: 'timer',
              ref: change.timerId,
              name: '타이머 1',
            },
          ],
        },
      });
      return Promise.resolve({
        ok: true,
        value: {id: change.quickItemId, revision: document.revision},
      });
    }
    if (change.type !== 'settings.update' || change.name !== 'quick') {
      throw new Error('Unexpected edit');
    }
    push({...document, revision: document.revision + 1, value: change.value});
    return Promise.resolve({
      ok: true,
      value: {id: 'quick', revision: document.revision},
    });
  });
  const api = mockLlpApi({
    ...base.api,
    settings: {...base.api.settings, get, edit},
  });
  const problem = vi.fn();
  window.llp = api;
  return {
    ...base,
    api,
    get,
    edit,
    problem,
    push,
    current: () => document,
    mount: () =>
      render(<QuickPanel selectionVersion={0} onProblem={problem} />),
  };
}

export function failPersistedEdit(
  edit: ReturnType<typeof setup>['edit'],
): void {
  const original = edit.getMockImplementation();
  if (!original) throw new Error('Missing edit fixture');
  edit.mockImplementationOnce(async change => {
    const applied = await original(change);
    if (!applied.ok) throw new Error('Fixture did not apply');
    return {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: applied.value,
        unchangedFiles: ['quick.json'],
      },
    };
  });
}

export async function openAddMenu(): Promise<void> {
  const add = await screen.findByRole('button', {name: '퀵 실행 추가'});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(add);
  await screen.findByRole('menu', {name: '퀵 실행 추가'});
}

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    '00000000-0000-4000-8000-000000000999',
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShow.setState({
    openItemId: null,
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
    serviceId: null,
  });
  useLive.setState({state: quickLive()});
});
afterEach(() => {
  resetTooltips();
  Reflect.deleteProperty(document, 'elementFromPoint');
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});
