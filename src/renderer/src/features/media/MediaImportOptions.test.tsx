import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import type {EditResult} from '@core/schema/contentEdit';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {resetTooltips} from '@renderer/ui/tooltipTesting';
import type {NamedDocument} from '@renderer/platform/useSettingsDocument';
import {MediaImportOptions} from './MediaImportOptions';

function document(
  revision = 1,
  value: object = {},
  access: 'editable' | 'readOnly' = 'editable',
) {
  const parsed = parseSettingsDocument({
    name: 'preferences',
    revision,
    access,
    value: {format: 'llsettings.preferences', schemaVersion: 1, ...value},
  });
  if (!parsed.ok || parsed.value.name !== 'preferences') {
    throw new Error('Invalid invented preferences');
  }
  return parsed.value;
}

function setup(initial = document()) {
  let current = initial;
  const listeners = new Set<(document: SettingsDocument) => void>();
  const push = (next: NamedDocument<'preferences'>) => {
    current = next;
    for (const listener of listeners) listener(next);
  };
  const edit = vi.fn(async (): Promise<EditResult> => ({
    ok: true,
    value: {id: 'preferences', revision: 2},
  }));
  const get = vi.fn(async () => current);
  const api = mockLlpApi({
    settings: {
      get,
      edit,
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  });
  window.llp = api;
  const onProblem = vi.fn();
  const view = render(<MediaImportOptions onProblem={onProblem} />);
  return {edit, get, listeners, push, onProblem, ...view};
}

async function open() {
  fireEvent.click(screen.getByRole('button', {name: '가져오기 설정'}));
  const item = await screen.findByRole('menuitemcheckbox', {
    name: '미디어 폴더로 복사',
  });
  await waitFor(() =>
    expect(item.getAttribute('aria-disabled')).not.toBe('true'),
  );
  return item;
}

afterEach(() => {
  cleanup();
  delete window.llp;
  resetTooltips();
});

it('lists only the copy-on-import checkbox with no separator', async () => {
  setup();
  await open();
  const menu = screen.getByRole('menu', {name: '가져오기 설정'});
  expect(
    [...menu.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
      row => row.textContent,
    ),
  ).toEqual(['미디어 폴더로 복사']);
});

it('shows the absent setting off and preserves the newest document when changing it', async () => {
  const {edit, push} = setup();
  expect((await open()).getAttribute('aria-checked')).toBe('false');
  act(() =>
    push(
      document(4, {
        backup: {keep: 8},
        future: {invented: true},
        media: {copyOnImport: true, future: 'kept'},
      }),
    ),
  );
  expect(
    screen.getByRole('menuitemcheckbox').getAttribute('aria-checked'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('menuitemcheckbox'));
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
  expect(edit).toHaveBeenCalledWith({
    type: 'settings.update',
    name: 'preferences',
    baseRevision: 4,
    value: {
      format: 'llsettings.preferences',
      schemaVersion: 1,
      backup: {keep: 8},
      future: {invented: true},
      media: {copyOnImport: false, future: 'kept'},
    },
  });
});

it('uses the latest saved choice after reopening and releases every menu subscription', async () => {
  const {listeners, push, unmount} = setup();
  expect(listeners.size).toBe(0);
  for (let index = 0; index < 20; index += 1) {
    const item = await open();
    expect(item.getAttribute('aria-checked')).toBe(String(index % 2 === 1));
    expect(listeners.size).toBe(1);
    fireEvent.keyDown(item, {key: 'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
    expect(listeners.size).toBe(0);
    act(() =>
      push(document(index + 2, {media: {copyOnImport: index % 2 === 0}})),
    );
  }
  unmount();
  expect(listeners.size).toBe(0);
});

it('refuses changes to a read-only document', async () => {
  const {edit} = setup(document(1, {media: {copyOnImport: true}}, 'readOnly'));
  fireEvent.click(screen.getByRole('button', {name: '가져오기 설정'}));
  const item = await screen.findByRole('menuitemcheckbox');
  await waitFor(() => expect(item.getAttribute('aria-checked')).toBe('true'));
  expect(item.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(item);
  expect(edit).not.toHaveBeenCalled();
});

it('keeps one write in flight and reports failure after the menu closes', async () => {
  const {edit, onProblem} = setup();
  let finish: (result: EditResult) => void = () => undefined;
  edit.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.click(await open());
  expect(
    screen
      .getByRole('button', {name: '가져오기 설정'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '가져오기 설정'}));
  expect(edit).toHaveBeenCalledOnce();
  await act(async () => {
    finish({
      ok: false,
      error: {reason: 'stale', message: 'Invented revision conflict'},
    });
  });
  expect(onProblem).toHaveBeenCalledWith(
    expect.objectContaining({title: '가져오기 설정을 저장하지 못함'}),
  );
  expect(
    screen
      .getByRole('button', {name: '가져오기 설정'})
      .getAttribute('aria-disabled'),
  ).not.toBe('true');
});

it('ignores an older initial read and releases a pending read when dismissed', async () => {
  const {get, push, listeners} = setup();
  let finish: (value: NamedDocument<'preferences'>) => void = () => undefined;
  get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.keyDown(screen.getByRole('button', {name: '가져오기 설정'}), {
    key: 'ArrowDown',
  });
  expect(
    screen.getByRole('menuitemcheckbox').getAttribute('aria-disabled'),
  ).toBe('true');
  act(() => push(document(3, {media: {copyOnImport: true}})));
  await act(async () => {
    finish(document());
  });
  expect(
    screen.getByRole('menuitemcheckbox').getAttribute('aria-checked'),
  ).toBe('true');
  fireEvent.keyDown(screen.getByRole('menuitemcheckbox'), {key: 'Escape'});
  expect(listeners.size).toBe(0);
});

it('does not show a late save failure after the bin unmounts', async () => {
  const {edit, onProblem, unmount} = setup();
  let finish: (result: EditResult) => void = () => undefined;
  edit.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.click(await open());
  unmount();
  await act(async () => {
    finish({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: {id: 'preferences', revision: null},
        unchangedFiles: [],
      },
    });
  });
  expect(onProblem).not.toHaveBeenCalled();
});
