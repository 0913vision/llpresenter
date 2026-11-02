import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {
  defaultPreferences,
  type PreferencesFile,
} from '@core/schema/preferences';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';

const UNKNOWN_FIELDS = {unknownField: 'kept'};
const STORED: PreferencesFile = {
  format: defaultPreferences.format,
  schemaVersion: 1,
  backup: {keep: 30},
  ...UNKNOWN_FIELDS,
};

const edit = vi.fn<(request: SettingsEdit) => Promise<EditResult>>();
const onProblem = vi.fn();

function install(options: {readonly access?: 'editable' | 'readOnly'} = {}) {
  const document: SettingsDocument = {
    name: 'preferences',
    value: STORED,
    revision: 5,
    access: options.access ?? 'editable',
  };
  window.llp = mockLlpApi({
    settings: {
      get: () => Promise.resolve(document),
      edit: request => edit(request),
    },
  });
}

async function mount(options?: Parameters<typeof install>[0]) {
  install(options);
  const view = render(<PreferencesView onProblem={onProblem} />);
  await screen.findByRole('switch', {name: '지우기 되돌리기 단추 보이기'});
  return view;
}

function written(): PreferencesFile {
  const request = edit.mock.calls.at(-1)?.[0];
  if (request?.type !== 'settings.update' || request.name !== 'preferences') {
    throw new Error('Expected a preferences update');
  }
  return request.value;
}

beforeEach(() => {
  edit.mockReset();
  edit.mockResolvedValue({ok: true, value: {id: 'preferences', revision: 6}});
  onProblem.mockReset();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

async function openPage(name: string): Promise<void> {
  await userEvent.click(screen.getByRole('option', {name}));
}

describe('PreferencesView', () => {
  it('lists the six pages and fills only 일반, 출력, and 라이브러리', async () => {
    await mount();

    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '일반',
      '출력',
      '라이브러리',
      '성경',
      '가져오기',
      '단축키',
    ]);
    await openPage('성경');
    expect(screen.getByRole('heading').textContent).toBe('성경');
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('shows the stored value or its default in each 일반 row', async () => {
    await mount();

    expect(screen.getByRole('button', {name: /언어/}).textContent).toContain(
      '한국어',
    );
    expect(screen.getByRole('spinbutton', {name: '복구 사본'})).toHaveProperty(
      'value',
      '10',
    );
    expect(
      screen
        .getByRole('switch', {name: '지우기 되돌리기 단추 보이기'})
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('saves a switch at once against the file revision and keeps unknown fields', async () => {
    await mount();
    await userEvent.click(
      screen.getByRole('switch', {name: '지우기 되돌리기 단추 보이기'}),
    );

    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 5});
    expect(written()).toMatchObject({
      show: {showClearUndoButton: true},
      backup: {keep: 30},
      unknownField: 'kept',
    });
  });

  it.each([
    ['켤 때 화면 출력', {showOnLaunch: true}],
    ['출력 중 절전 막기', {preventSleep: false}],
    ['출력 창 항상 위', {alwaysOnTop: true}],
    ['하드웨어 가속', {hardwareAcceleration: false}],
  ])('writes the 출력 switch %s', async (label, expected) => {
    await mount();
    await openPage('출력');
    await userEvent.click(screen.getByRole('switch', {name: label}));

    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(written()).toMatchObject(expected);
  });

  it('builds the next write on the revision and value of the one before', async () => {
    edit
      .mockResolvedValueOnce({
        ok: true,
        value: {id: 'preferences', revision: 6},
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {id: 'preferences', revision: 7},
      });
    await mount();
    await openPage('출력');
    await userEvent.click(
      screen.getByRole('switch', {name: '켤 때 화면 출력'}),
    );
    await userEvent.click(
      screen.getByRole('switch', {name: '출력 창 항상 위'}),
    );

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 5});
    expect(edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 6});
    expect(written()).toMatchObject({showOnLaunch: true, alwaysOnTop: true});
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('writes the 출력 selects', async () => {
    await mount();
    await openPage('출력');
    await userEvent.click(screen.getByRole('button', {name: /미리보기/}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '60fps'}),
    );
    await waitFor(() => expect(written()).toMatchObject({previewFps: 60}));

    edit.mockClear();
    await userEvent.click(
      screen.getByRole('button', {name: /화면 연결이 끊기면/}),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '출력 끄기'}),
    );
    await waitFor(() => expect(written()).toMatchObject({onDisconnect: 'off'}));
  });

  it('writes the 라이브러리 backup rows', async () => {
    await mount();
    await openPage('라이브러리');
    await userEvent.click(screen.getByRole('switch', {name: '자동 백업'}));
    await waitFor(() =>
      expect(written()).toMatchObject({backup: {auto: false, keep: 30}}),
    );

    edit.mockClear();
    const keep = screen.getByRole('spinbutton', {name: '보관'});
    fireEvent.change(keep, {target: {value: '12'}});
    fireEvent.keyDown(keep, {key: 'Enter'});
    await waitFor(() => expect(written()).toMatchObject({backup: {keep: 12}}));
  });

  it('writes a committed count and keeps it within its range', async () => {
    await mount();
    const copies = screen.getByRole('spinbutton', {name: '복구 사본'});
    fireEvent.change(copies, {target: {value: '99'}});
    fireEvent.keyDown(copies, {key: 'Enter'});

    await waitFor(() => expect(written()).toMatchObject({backupCopies: 50}));
  });

  it('shows the save failure when the write is refused or throws', async () => {
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'changed'},
    });
    await mount();
    await userEvent.click(
      screen.getByRole('switch', {name: '지우기 되돌리기 단추 보이기'}),
    );
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '환경설정을 저장하지 못함'}),
      ),
    );

    onProblem.mockClear();
    edit.mockRejectedValueOnce(new Error('ipc down'));
    await userEvent.click(
      screen.getByRole('switch', {name: '지우기 되돌리기 단추 보이기'}),
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
  });

  it('writes nothing for a file of a newer version', async () => {
    await mount({access: 'readOnly'});
    await userEvent.click(
      screen.getByRole('switch', {name: '지우기 되돌리기 단추 보이기'}),
    );

    expect(edit).not.toHaveBeenCalled();
  });
});
