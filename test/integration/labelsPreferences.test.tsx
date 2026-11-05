import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, onTestFinished, vi} from 'vitest';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';
import {LabelsPage} from '@renderer/features/preferences/LabelsPage';
import {LabelManagerDialog} from '@renderer/features/songs/editor/LabelManagerDialog';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import type {DialogProps} from '@renderer/ui/Dialog';
import {PreferencesWindow} from '@renderer/app/PreferencesWindow';
import {ControlSession} from '@renderer/app/controlSession';
import type {EditResult} from '@core/schema/contentEdit';
import type {PreferencePageId} from '@core/schema/preferencePages';

// NOTE(0913vision): These two catalogs represent separate windows, so their
// modal shells must not hide each other's document in this jsdom test.
vi.mock('@renderer/ui/Dialog', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/ui/Dialog')>()),
  Dialog: ({title, children, footerStart, primary}: DialogProps) => (
    <section role="dialog" aria-label={title}>
      {children}
      {footerStart}
      <button type="button" data-modal-primary onClick={primary.onSelect}>
        {primary.label}
      </button>
    </section>
  ),
}));

afterEach(() => {
  cleanup();
  delete window.llp;
});

async function mount(readOnly = false) {
  const fixture = editorFixture();
  window.llp = fixture.api;
  if (readOnly) {
    vi.spyOn(fixture.api.settings, 'get').mockResolvedValue({
      ...fixture.labels(),
      access: 'readOnly',
    });
  }
  const store = new SongEditorStore(fixture.api, vi.fn());
  const other = new SongEditorStore(fixture.api, vi.fn());
  other.open(fixture.first);
  await waitFor(() => expect(store.getSnapshot().labels).not.toBeNull());
  onTestFinished(async () => {
    cleanup();
    await Promise.all([store.dispose(), other.dispose()]);
    expect(fixture.listenerCount()).toBe(0);
  });
  return {...fixture, store, other, user: userEvent.setup()};
}

it('edits the shared catalog from preferences while an editor dialog follows it', async () => {
  const f = await mount();
  render(
    <>
      <PreferencesView onProblem={vi.fn()} labelStore={f.store} />
      <LabelManagerDialog store={f.other} onClose={vi.fn()} />
    </>,
  );
  const navigation = within(
    screen.getByRole('navigation', {name: '환경설정 항목'}),
  );
  const names = navigation.getAllByRole('option').map(row => row.textContent);
  expect(names.indexOf('이름표')).toBe(names.indexOf('라이브러리') + 1);
  await f.user.click(navigation.getByRole('option', {name: '이름표'}));
  const page = screen.getByRole('region', {name: '이름표'});
  const dialog = screen.getByRole('dialog', {name: '이름표 관리'});
  expect(
    within(page)
      .getAllByRole('textbox')
      .map(field => field.getAttribute('aria-label')),
  ).toEqual(['1절 이름', '후렴 이름']);
  const name = within(page).getByRole('textbox', {name: '1절 이름'});
  await f.user.clear(name);
  await f.user.type(name, '새 절');
  await f.user.click(
    within(within(page).getByRole('radiogroup', {name: '1절 색'})).getByRole(
      'radio',
      {name: '초록'},
    ),
  );
  await waitFor(() =>
    expect(f.labels().value.labels[0]).toMatchObject({
      name: '새 절',
      color: 'green',
      key: null,
    }),
  );
  expect(f.labelEdits).toContainEqual(
    expect.objectContaining({type: 'labels.rename', from: '1절', to: '새 절'}),
  );
  expect(
    within(dialog).getByRole('textbox', {name: '새 절 이름'}),
  ).toHaveProperty('value', '새 절');
  expect(
    within(within(dialog).getByRole('radiogroup', {name: '새 절 색'}))
      .getByRole('radio', {name: '초록'})
      .getAttribute('aria-checked'),
  ).toBe('true');
  expect(
    f.other.getSnapshot().session?.history.snapshot.song.groups[0]?.name,
  ).toBe('새 절');

  await f.user.click(within(page).getByRole('button', {name: '새 이름표'}));
  const created = await within(page).findByRole('textbox', {
    name: '새 이름표 이름',
  });
  await waitFor(() => expect(document.activeElement).toBe(created));
  expect(f.labels().value.labels.at(-1)).toMatchObject({
    name: '새 이름표',
    color: 'none',
    key: null,
  });
  expect(
    within(dialog).getByRole('textbox', {name: '새 이름표 이름'}),
  ).toBeTruthy();
  await f.user.keyboard('태그{Enter}');
  await waitFor(() =>
    expect(
      within(dialog).getByRole('textbox', {name: '태그 이름'}),
    ).toHaveProperty('value', '태그'),
  );

  await f.user.click(within(page).getByRole('button', {name: '새 절 삭제'}));
  const confirmation = screen.getByRole('alertdialog');
  expect(within(confirmation).getByText('모든 곡의 이름표 유지')).toBeTruthy();
  await f.user.click(within(confirmation).getByRole('button', {name: '삭제'}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(
    within(dialog).queryByRole('textbox', {name: '새 절 이름'}),
  ).toBeNull();
  expect(
    f.other.getSnapshot().session?.history.snapshot.song.groups[0]?.name,
  ).toBe('새 절');

  const otherName = within(dialog).getByRole('textbox', {name: '후렴 이름'});
  await f.user.clear(otherName);
  await f.user.type(otherName, '코러스{Enter}');
  await waitFor(() =>
    expect(
      within(page).getByRole('textbox', {name: '코러스 이름'}),
    ).toHaveProperty('value', '코러스'),
  );
  expect(
    f.labels().value.labels.find(label => label.name === '코러스')?.key,
  ).toBe('KeyC');
});

it('keeps an invalid page draft for correction before a palette action', async () => {
  const f = await mount();
  render(<LabelsPage store={f.store} />);
  const name = screen.getByRole('textbox', {name: '1절 이름'});
  await f.user.clear(name);
  await f.user.type(name, '후렴');
  await f.user.click(
    within(screen.getByRole('radiogroup', {name: '1절 색'})).getByRole(
      'radio',
      {name: '초록'},
    ),
  );
  expect(name.getAttribute('aria-invalid')).toBe('true');
  expect(f.labelEdits).toHaveLength(0);
  await f.user.click(name);
  await f.user.keyboard('{Escape}');
  const restored = screen.getByRole('textbox', {name: '1절 이름'});
  expect(restored).toHaveProperty('value', '1절');
  fireEvent.change(restored, {target: {value: '전주'}});
  fireEvent.keyDown(restored, {key: 'Enter', ctrlKey: true});
  fireEvent.keyDown(restored, {key: 'Enter', isComposing: true});
  expect(f.labelEdits).toHaveLength(0);
});

it('keeps the preferences catalog read-only when its file is newer', async () => {
  const f = await mount(true);
  render(<LabelsPage store={f.store} />);
  expect(screen.getByRole('textbox', {name: '1절 이름'})).toHaveProperty(
    'readOnly',
    true,
  );
  await f.user.click(screen.getByRole('button', {name: '새 이름표'}));
  await f.user.click(screen.getByRole('button', {name: '1절 삭제'}));
  expect(
    screen
      .getByRole('button', {name: '새 이름표'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  expect(f.labelEdits).toHaveLength(0);
});

it('keeps the add action focusable after deleting every label on the page', async () => {
  const f = await mount();
  render(<LabelsPage store={f.store} />);
  for (const name of ['1절', '후렴']) {
    await f.user.click(screen.getByRole('button', {name: `${name} 삭제`}));
    await f.user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  }
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '새 이름표'}),
    ),
  );
  expect(f.labels().value.labels).toHaveLength(0);
});

it('reports and dismisses a label save failure in the preferences window', async () => {
  const f = editorFixture();
  window.llp = f.api;
  const user = userEvent.setup();
  const session = new ControlSession(f.api);
  session.startEditor();
  onTestFinished(async () => {
    cleanup();
    await session.dispose();
    expect(f.listenerCount()).toBe(0);
  });
  vi.spyOn(f.api.settings, 'edit').mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Invented catalog conflict'},
  });
  render(<PreferencesWindow session={session} />);
  await user.click(screen.getByRole('option', {name: '이름표'}));
  const colors = await screen.findByRole('radiogroup', {name: '1절 색'});
  await user.click(within(colors).getByRole('radio', {name: '초록'}));
  const notice = await screen.findByRole('alert');
  expect(within(notice).getByText('이름표 변경 실패')).toBeTruthy();
  await user.click(within(notice).getByRole('button', {name: '알림 닫기'}));
  expect(screen.queryByRole('alert')).toBeNull();
});

it.each(['sidebar', 'request'] as const)(
  'keeps a refused rename available when the %s tries to leave the labels page',
  async source => {
    const f = await mount();
    let request: (page: PreferencePageId) => void = () => undefined;
    vi.spyOn(f.api.window, 'onPreferencesPage').mockImplementation(listener => {
      request = listener;
      return () => undefined;
    });
    let finish: (result: EditResult) => void = () => undefined;
    const write = new Promise<EditResult>(resolve => {
      finish = resolve;
    });
    const edit = vi.spyOn(f.api.settings, 'edit').mockReturnValueOnce(write);
    render(<PreferencesView onProblem={vi.fn()} labelStore={f.store} />);
    await f.user.click(screen.getByRole('option', {name: '이름표'}));
    const field = screen.getByRole('textbox', {name: '1절 이름'});
    await f.user.clear(field);
    await f.user.type(field, '보존할 이름');
    const navigate = async (): Promise<void> => {
      if (source === 'sidebar') {
        await f.user.click(screen.getByRole('option', {name: '라이브러리'}));
      } else {
        act(() => request('library'));
      }
    };
    if (source === 'request') fireEvent.blur(field);
    await navigate();
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading').textContent).toBe('이름표');
    await act(async () =>
      finish({
        ok: false,
        error: {reason: 'stale', message: 'Invented refused rename'},
      }),
    );
    await waitFor(() =>
      expect(field.getAttribute('aria-invalid')).toBe('true'),
    );
    expect(screen.getByRole('heading').textContent).toBe('이름표');
    expect(screen.getByRole('textbox', {name: '1절 이름'})).toBe(field);
    expect(field).toHaveProperty('value', '보존할 이름');
    expect(
      screen
        .getByRole('option', {name: '이름표'})
        .getAttribute('aria-selected'),
    ).toBe('true');
    await f.user.clear(field);
    await f.user.type(field, '수정한 이름');
    await navigate();
    await waitFor(() =>
      expect(screen.getByRole('heading').textContent).toBe('라이브러리'),
    );
    expect(f.labels().value.labels[0]?.name).toBe('수정한 이름');
  },
);

it('settles an unblurred rename before applying the latest requested page', async () => {
  const f = await mount();
  let request: (page: PreferencePageId) => void = () => undefined;
  vi.spyOn(f.api.window, 'onPreferencesPage').mockImplementation(listener => {
    request = listener;
    return () => undefined;
  });
  let finish: () => void = () => undefined;
  const gate = new Promise<void>(resolve => {
    finish = resolve;
  });
  const original = f.api.settings.edit;
  const edit = vi
    .spyOn(f.api.settings, 'edit')
    .mockImplementationOnce(async value => {
      await gate;
      return original(value);
    });
  render(<PreferencesView onProblem={vi.fn()} labelStore={f.store} />);
  await f.user.click(screen.getByRole('option', {name: '이름표'}));
  const field = screen.getByRole('textbox', {name: '1절 이름'});
  await f.user.clear(field);
  await f.user.type(field, '저장할 이름');
  act(() => {
    request('library');
    request('import');
  });
  await waitFor(() => expect(edit).toHaveBeenCalledOnce());
  expect(screen.getByRole('heading').textContent).toBe('이름표');
  await act(async () => finish());
  await waitFor(() =>
    expect(screen.getByRole('heading').textContent).toBe('가져오기'),
  );
  expect(f.labels().value.labels[0]?.name).toBe('저장할 이름');
  expect(edit).toHaveBeenCalledOnce();
});

it('keeps invalid label text when navigation cannot save it', async () => {
  const f = await mount();
  render(<PreferencesView onProblem={vi.fn()} labelStore={f.store} />);
  await f.user.click(screen.getByRole('option', {name: '이름표'}));
  const field = screen.getByRole('textbox', {name: '1절 이름'});
  await f.user.clear(field);
  await f.user.type(field, '후렴');
  await f.user.click(screen.getByRole('option', {name: '라이브러리'}));
  expect(screen.getByRole('heading').textContent).toBe('이름표');
  expect(field).toHaveProperty('value', '후렴');
  expect(field.getAttribute('aria-invalid')).toBe('true');
  expect(f.labelEdits).toHaveLength(0);
});
