import * as v from 'valibot';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {StrictMode} from 'react';
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
import {translationIdSchema} from '@core/schema/ids';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import type {PreferencePageId} from '@core/schema/preferencePages';
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

const BIBLE_FILE = {
  format: 'llsettings.bible',
  schemaVersion: 1,
  translations: [
    {
      id: v.parse(translationIdSchema, 'krv'),
      name: '개역한글',
      lang: '한국어',
      file: 'krv.llbible',
      default: true,
    },
    {
      id: v.parse(translationIdSchema, 'kjv'),
      name: 'KJV',
      lang: 'English',
      file: 'kjv.llbible',
      default: false,
    },
  ],
  recents: [],
  ...UNKNOWN_FIELDS,
} as const;

const listeners = new Set<(document: SettingsDocument) => void>();

function pushed(document: SettingsDocument): void {
  for (const listener of listeners) listener(document);
}

function install(
  options: {
    readonly access?: 'editable' | 'readOnly';
    readonly window?: Parameters<typeof mockLlpApi>[0] extends infer T
      ? T extends {window?: infer W}
        ? W
        : never
      : never;
  } = {},
) {
  const access = options.access ?? 'editable';
  const documents: Record<'preferences' | 'bible', SettingsDocument> = {
    preferences: {name: 'preferences', value: STORED, revision: 5, access},
    bible: {name: 'bible', value: BIBLE_FILE, revision: 3, access},
  };
  window.llp = mockLlpApi({
    settings: {
      get: ({name}) => {
        const document =
          name === 'bible' ? documents.bible : documents.preferences;
        return Promise.resolve(document);
      },
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      edit: request => edit(request),
    },
    ...(options.window === undefined ? {} : {window: options.window}),
  });
}

async function mount(options?: Parameters<typeof install>[0]) {
  install(options);
  const view = render(<PreferencesView onProblem={onProblem} />);
  await screen.findByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'});
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
  it('opens on the page main hands over once, also when StrictMode runs its effects twice', async () => {
    let answers: Array<PreferencePageId | null> = ['shortcuts', null];
    const preferencesPage = vi.fn(() =>
      Promise.resolve(answers.shift() ?? null),
    );
    install({window: {preferencesPage}});
    render(
      <StrictMode>
        <PreferencesView onProblem={onProblem} />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(screen.getByRole('heading').textContent).toBe('단축키'),
    );
    expect(preferencesPage).toHaveBeenCalledOnce();
    answers = [];
  });

  it('moves to a page main pushes while the window is open', async () => {
    let show: (page: PreferencePageId) => void = () => undefined;
    install({
      window: {
        onPreferencesPage: listener => {
          show = listener;
          return () => undefined;
        },
      },
    });
    render(<PreferencesView onProblem={onProblem} />);
    await screen.findByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'});
    act(() => show('bible'));
    await waitFor(() =>
      expect(screen.getByRole('heading').textContent).toBe('성경'),
    );
  });

  it('lists the six pages and opens the 단축키 page', async () => {
    await mount();

    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '일반',
      '출력',
      '라이브러리',
      '성경',
      '가져오기',
      '단축키',
    ]);
    await openPage('단축키');
    expect(screen.getByRole('heading').textContent).toBe('단축키');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
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
        .getByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'})
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('saves a switch at once against the file revision and keeps unknown fields', async () => {
    await mount();
    await userEvent.click(
      screen.getByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'}),
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
    await userEvent.click(screen.getByRole('checkbox', {name: label}));

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
      screen.getByRole('checkbox', {name: '켤 때 화면 출력'}),
    );
    await userEvent.click(
      screen.getByRole('checkbox', {name: '출력 창 항상 위'}),
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

  it('shows 정지 for what next does on the last slide and saves 다음 항목 beside the other show choices', async () => {
    await mount();
    const row = screen.getByRole('button', {
      name: /마지막 슬라이드에서 다음 슬라이드/,
    });
    expect(row.textContent).toContain('정지');
    edit.mockClear();
    await userEvent.click(row);
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '다음 항목'}),
    );
    await waitFor(() =>
      expect(written()).toMatchObject({
        show: {atLastSlide: 'nextItem'},
        ...UNKNOWN_FIELDS,
      }),
    );
  });

  it('locks the last-slide row for a file of a newer version', async () => {
    await mount({access: 'readOnly'});
    expect(
      screen
        .getByRole('button', {name: /마지막 슬라이드에서 다음 슬라이드/})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('writes the 라이브러리 backup rows', async () => {
    await mount();
    await openPage('라이브러리');
    await userEvent.click(screen.getByRole('checkbox', {name: '자동 백업'}));
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
      screen.getByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'}),
    );
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '환경설정을 저장하지 못함'}),
      ),
    );

    onProblem.mockClear();
    edit.mockRejectedValueOnce(new Error('ipc down'));
    await userEvent.click(
      screen.getByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'}),
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
  });

  it('writes nothing for a file of a newer version', async () => {
    await mount({access: 'readOnly'});
    await userEvent.click(
      screen.getByRole('checkbox', {name: '지우기 되돌리기 단추 보이기'}),
    );

    expect(edit).not.toHaveBeenCalled();
  });

  it('lists the installed translations with the default tagged', async () => {
    await mount();
    await openPage('성경');

    expect(await screen.findByText('개역한글')).toBeTruthy();
    expect(screen.getByText('KJV')).toBeTruthy();
    expect(screen.getAllByText('기본')).toHaveLength(1);
  });

  it('makes a translation the only default and keeps unknown fields', async () => {
    await mount();
    await openPage('성경');
    await userEvent.click(
      await screen.findByRole('button', {name: 'KJV 메뉴'}),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '기본으로'}),
    );

    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    const request = edit.mock.calls[0]?.[0];
    if (request?.type !== 'settings.update' || request.name !== 'bible') {
      throw new Error('Expected a bible update');
    }
    expect(request.baseRevision).toBe(3);
    expect(
      request.value.translations.map(item => [item.id, item.default]),
    ).toEqual([
      ['krv', false],
      ['kjv', true],
    ]);
    expect(request.value).toMatchObject(UNKNOWN_FIELDS);
  });

  it('disables 기본으로 on the default translation', async () => {
    await mount();
    await openPage('성경');
    await userEvent.click(
      await screen.findByRole('button', {name: '개역한글 메뉴'}),
    );

    expect(
      (await screen.findByRole('menuitem', {name: '기본으로'})).getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
  });

  it('shows a failed default change and writes 절 번호 into the preferences', async () => {
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'changed'},
    });
    await mount();
    await openPage('성경');
    await userEvent.click(
      await screen.findByRole('button', {name: 'KJV 메뉴'}),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '기본으로'}),
    );
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '기본 역본을 저장하지 못함'}),
      ),
    );

    edit.mockClear();
    await userEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    await waitFor(() =>
      expect(written()).toMatchObject({bible: {verseNumbers: false}}),
    );
  });

  it('writes 한 슬라이드 최대 줄 수 within its range', async () => {
    await mount();
    await openPage('성경');
    const lines = await screen.findByRole('spinbutton', {
      name: '한 슬라이드 최대 줄 수',
    });
    fireEvent.change(lines, {target: {value: '30'}});
    fireEvent.keyDown(lines, {key: 'Enter'});

    await waitFor(() =>
      expect(written()).toMatchObject({bible: {maxLines: 12}}),
    );
  });

  it.each([
    ['슬라이드 나누기', '줄 바꿈', {split: 'lineBreak'}],
    ['이름표', '사용 안 함', {labels: 'off'}],
    ['첫 줄', '가사', {firstLine: 'lyrics'}],
    ['글자 인코딩', 'CP949', {encoding: 'cp949'}],
  ])('writes the 가져오기 select %s', async (label, choice, expected) => {
    await mount();
    await openPage('가져오기');
    await userEvent.click(
      screen.getByRole('button', {name: new RegExp(label)}),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: choice}),
    );

    await waitFor(() =>
      expect(written()).toMatchObject({import: {txt: expected}}),
    );
  });

  it('never replaces a newer pushed document with an older reply', async () => {
    let answer: (result: EditResult) => void = () => undefined;
    edit.mockImplementationOnce(
      () =>
        new Promise<EditResult>(resolve => {
          answer = resolve;
        }),
    );
    await mount();
    await openPage('출력');
    await userEvent.click(
      screen.getByRole('checkbox', {name: '켤 때 화면 출력'}),
    );
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    act(() =>
      pushed({
        name: 'preferences',
        value: {...STORED, showOnLaunch: true},
        revision: 9,
        access: 'editable',
      }),
    );
    answer({ok: true, value: {id: 'preferences', revision: 6}});
    await userEvent.click(
      screen.getByRole('checkbox', {name: '출력 창 항상 위'}),
    );

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 9});
  });

  it('sends no queued write once the close gate has stopped writing', async () => {
    await mount();
    await openPage('출력');
    const api = window.llp;
    if (api === undefined) throw new Error('Missing api');
    await pendingWritesOf(api).flush();
    await userEvent.click(
      screen.getByRole('checkbox', {name: '켤 때 화면 출력'}),
    );

    expect(edit).not.toHaveBeenCalled();
    pendingWritesOf(api).resume();
  });
});
