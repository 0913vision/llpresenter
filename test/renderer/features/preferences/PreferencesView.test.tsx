import * as v from 'valibot';
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
import {Activity, StrictMode} from 'react';
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
import {translationIdSchema, themeIdSchema} from '@core/schema/ids';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {MISSING_DEVICE_REASON} from '@renderer/features/preferences/DeviceRow';
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
    readonly stored?: PreferencesFile;
    readonly window?: Parameters<typeof mockLlpApi>[0] extends infer T
      ? T extends {window?: infer W}
        ? W
        : never
      : never;
  } = {},
) {
  const access = options.access ?? 'editable';
  const documents: Record<'preferences' | 'bible', SettingsDocument> = {
    preferences: {
      name: 'preferences',
      value: options.stored ?? STORED,
      revision: 5,
      access,
    },
    bible: {name: 'bible', value: BIBLE_FILE, revision: 3, access},
  };
  const extra: readonly SettingsDocument[] = [
    {
      name: 'shortcuts',
      revision: 1,
      access,
      value: {format: 'llsettings.shortcuts', schemaVersion: 1, bindings: {}},
    },
    {
      name: 'themes',
      revision: 1,
      access,
      value: {
        format: 'llsettings.themes',
        schemaVersion: 1,
        themes: [],
        defaults: {},
        standby: {
          id: v.parse(themeIdSchema, '00000000-0000-4000-8000-000000000001'),
          name: 'Standby',
          screens: {},
        },
      },
    },
    {
      name: 'props',
      revision: 1,
      access,
      value: {format: 'llsettings.props', schemaVersion: 1, props: []},
    },
    {
      name: 'macros',
      revision: 1,
      access,
      value: {
        format: 'llsettings.macros',
        schemaVersion: 1,
        macros: [],
        collections: [],
      },
    },
    {
      name: 'timers',
      revision: 1,
      access,
      value: {format: 'llsettings.timers', schemaVersion: 1, timers: []},
    },
    {
      name: 'screens',
      revision: 1,
      access,
      value: {format: 'llsettings.screens', schemaVersion: 1, screens: []},
    },
  ];
  window.llp = mockLlpApi({
    settings: {
      get: ({name}) => {
        const document =
          name === 'bible'
            ? documents.bible
            : (extra.find(document => document.name === name) ??
              documents.preferences);
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
  await screen.findByRole('checkbox', {name: 'Windows 시작할 때 실행'});
  return view;
}

function written(): PreferencesFile {
  const request = edit.mock.calls.at(-1)?.[0];
  if (request?.type !== 'settings.update' || request.name !== 'preferences') {
    throw new Error('Expected a preferences update');
  }
  return request.value;
}

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {ready: Promise.resolve()},
  });
  edit.mockReset();
  edit.mockResolvedValue({ok: true, value: {id: 'preferences', revision: 6}});
  onProblem.mockReset();
});

afterEach(() => {
  if (originalFonts === undefined) Reflect.deleteProperty(document, 'fonts');
  else Object.defineProperty(document, 'fonts', originalFonts);
  cleanup();
  delete window.llp;
});

async function openPage(name: string): Promise<void> {
  await userEvent.click(screen.getByRole('option', {name}));
}

describe('PreferencesView', () => {
  it('uses the current shared-window request after the view resumes', async () => {
    const legacy = vi.fn(async () => 'general' as const);
    install({window: {preferencesPage: legacy}});
    const onReady = vi.fn();
    const request = {requestId: 2, page: 'shortcuts'} as const;
    const view = render(
      <Activity mode="visible">
        <PreferencesView
          onProblem={onProblem}
          onReady={onReady}
          request={request}
        />
      </Activity>,
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(request));
    view.rerender(
      <Activity mode="hidden">
        <PreferencesView
          onProblem={onProblem}
          onReady={onReady}
          request={request}
        />
      </Activity>,
    );
    const next = {requestId: 4, page: 'bible'} as const;
    onReady.mockClear();
    view.rerender(
      <Activity mode="visible">
        <PreferencesView
          onProblem={onProblem}
          onReady={onReady}
          request={next}
        />
      </Activity>,
    );
    await waitFor(() => expect(onReady).toHaveBeenCalledWith(next));
    expect(screen.getByRole('heading', {name: '성경'})).toBeTruthy();
    expect(legacy).not.toHaveBeenCalled();
  });
  it.each([
    'bible',
    'shortcuts',
    'themes',
    'props',
    'macros',
    'timers',
    'screens',
  ] as const)(
    'waits for the requested page data when %s is deferred',
    async name => {
      const page = name === 'bible' ? 'bible' : 'shortcuts';
      const request = {requestId: 7, page} as const;
      install({
        window: {
          preferencesPage: async () => page,
          preferencesRequest: async () => request,
        },
      });
      const api = window.llp;
      if (api === undefined) throw new Error('Missing API');
      const get = api.settings.get;
      const document = await get({name});
      let release: (value: SettingsDocument) => void = () => undefined;
      const pending = new Promise<SettingsDocument>(resolve => {
        release = resolve;
      });
      vi.spyOn(api.settings, 'get').mockImplementation(query =>
        query.name === name ? pending : get(query),
      );
      const onReady = vi.fn();
      render(<PreferencesView onProblem={onProblem} onReady={onReady} />);
      await screen.findByRole('heading', {
        name: page === 'bible' ? '성경' : '단축키',
      });
      await act(async () => {
        await new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      expect(onReady).not.toHaveBeenCalled();
      await act(async () => release(document));
      await waitFor(() =>
        expect(onReady).toHaveBeenCalledExactlyOnceWith(request),
      );
    },
  );
  it('reports readiness after settings, the requested page, and fonts have drawn', async () => {
    const onReady = vi.fn();
    let finishFonts: () => void = () => undefined;
    const ready = new Promise<void>(resolve => {
      finishFonts = resolve;
    });
    const original = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {ready},
    });
    try {
      install({
        window: {
          preferencesPage: async () => 'output',
          preferencesRequest: async () => ({requestId: 1, page: 'output'}),
        },
      });
      render(<PreferencesView onProblem={onProblem} onReady={onReady} />);
      await screen.findByRole('heading', {name: '출력'});
      expect(onReady).not.toHaveBeenCalled();
      await act(async () => finishFonts());
      await waitFor(() => expect(onReady).toHaveBeenCalledOnce());
    } finally {
      cleanup();
      if (original === undefined) Reflect.deleteProperty(document, 'fonts');
      else Object.defineProperty(document, 'fonts', original);
    }
  });
  it('saves the Bible auto-open setting from the new-passage group', async () => {
    await mount();
    await openPage('성경');
    const toggle = screen.getByRole('checkbox', {
      name: '나눌 자리 확인',
    });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(written().bible?.splitEditorAutoOpen).toBe(false),
    );
    expect(written()).toMatchObject(UNKNOWN_FIELDS);
  });
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
    await screen.findByRole('checkbox', {name: 'Windows 시작할 때 실행'});
    act(() => show('bible'));
    await waitFor(() =>
      expect(screen.getByRole('heading').textContent).toBe('성경'),
    );
  });

  it('lists the eight pages and opens the 단축키 page', async () => {
    await mount();

    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '일반',
      '출력',
      '저장',
      '이름표',
      '미디어',
      '성경',
      '단축키',
      '정보',
    ]);
    await openPage('단축키');
    expect(screen.getByRole('heading').textContent).toBe('단축키');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('has only 화면 확대 and Windows 시작할 때 실행 on the 일반 page', async () => {
    await mount();

    expect(screen.getByRole('button', {name: /화면 확대/})).toBeTruthy();
    expect(
      screen
        .getByRole('checkbox', {name: 'Windows 시작할 때 실행'})
        .getAttribute('aria-checked'),
    ).toBe('false');
    for (const gone of ['언어', '시작할 때', '복구 사본', '지우기 되돌리기']) {
      expect(screen.queryByText(new RegExp(`^${gone}`))).toBeNull();
    }
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('shows Windows 시작할 때 실행 off by default and saves it under general at once', async () => {
    await mount();
    const row = screen.getByRole('checkbox', {name: 'Windows 시작할 때 실행'});
    expect(row.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(row);
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(written().general).toEqual({launchAtLogin: true});
    expect(written()).toMatchObject(UNKNOWN_FIELDS);
  });

  it('saves a switch at once against the file revision and keeps unknown fields', async () => {
    await mount();
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Windows 시작할 때 실행'}),
    );

    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 5});
    expect(written()).toMatchObject({
      general: {launchAtLogin: true},
      backup: {keep: 30},
      unknownField: 'kept',
    });
  });

  it('writes 앱을 켤 때 출력', async () => {
    await mount();
    await openPage('출력');
    await userEvent.click(
      screen.getByRole('checkbox', {name: '앱을 켤 때 출력'}),
    );

    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(written()).toMatchObject({showOnLaunch: true});
  });

  it('opens 화면 설정 from the 모니터 row', async () => {
    const openScreens = vi.fn();
    await mount({window: {openScreens}});
    await openPage('출력');
    await userEvent.click(screen.getByRole('button', {name: '화면 설정…'}));

    expect(openScreens).toHaveBeenCalledOnce();
    expect(edit).not.toHaveBeenCalled();
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
      screen.getByRole('checkbox', {name: '앱을 켤 때 출력'}),
    );
    await openPage('저장');
    await userEvent.click(screen.getByRole('checkbox', {name: '자동 백업'}));

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 5});
    expect(edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 6});
    expect(written()).toMatchObject({
      showOnLaunch: true,
      backup: {auto: false, keep: 30},
    });
    expect(onProblem).not.toHaveBeenCalled();
  });

  describe('the 소리 time rows of the 미디어 page', () => {
    it('shows 0.5 s and 3 s by default', async () => {
      await mount();
      await openPage('미디어');
      expect(
        screen.getByRole('spinbutton', {name: '오디오 겹치기'}),
      ).toHaveProperty('value', '0.5');
      expect(
        screen.getByRole('spinbutton', {name: '페이드 아웃'}),
      ).toHaveProperty('value', '3.0');
    });

    it('writes a committed time, kept within its range, and the other fields', async () => {
      await mount();
      await openPage('미디어');
      const fade = screen.getByRole('spinbutton', {name: '페이드 아웃'});
      fireEvent.change(fade, {target: {value: '99'}});
      fireEvent.keyDown(fade, {key: 'Enter'});
      await waitFor(() => expect(edit).toHaveBeenCalledOnce());
      expect(written().show?.audio).toEqual({fadeOutSeconds: 10});
      expect(written()).toMatchObject(UNKNOWN_FIELDS);
    });
  });

  describe('the 정보 page', () => {
    const clipboard = vi.fn(() => Promise.resolve());
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {writeText: clipboard},
      });
      clipboard.mockClear();
    });
    afterEach(() => Reflect.deleteProperty(navigator, 'clipboard'));

    it('shows the version, opens the log folder, copies the diagnostics, and turns 자세한 기록 on', async () => {
      const openLogFolder = vi.fn();
      const setVerboseLogging = vi.fn();
      await mount({
        window: {
          openLogFolder,
          setVerboseLogging,
          appInfo: () => Promise.resolve({name: 'LoveLight', version: '9.8.7'}),
          diagnostics: () => Promise.resolve('LoveLight 9.8.7'),
        },
      });
      await openPage('정보');
      expect(await screen.findByText('9.8.7')).toBeDefined();
      await userEvent.click(screen.getByRole('button', {name: '폴더 열기'}));
      expect(openLogFolder).toHaveBeenCalledOnce();
      await userEvent.click(screen.getByRole('button', {name: '복사'}));
      await waitFor(() =>
        expect(clipboard).toHaveBeenCalledExactlyOnceWith('LoveLight 9.8.7'),
      );
      expect(await screen.findByText('복사했습니다')).toBeDefined();
      const verbose = screen.getByRole('checkbox', {name: '자세한 기록'});
      expect(verbose.getAttribute('aria-checked')).toBe('false');
      await userEvent.click(verbose);
      expect(setVerboseLogging).toHaveBeenCalledExactlyOnceWith(true);
      expect(edit).not.toHaveBeenCalled();
    });

    it('shows 자세한 기록 on when main says it is on, so a reopened page matches the logger', async () => {
      await mount({window: {verboseLogging: () => Promise.resolve(true)}});
      await openPage('정보');
      await waitFor(() =>
        expect(
          screen
            .getByRole('checkbox', {name: '자세한 기록'})
            .getAttribute('aria-checked'),
        ).toBe('true'),
      );
    });

    it('says when the diagnostics could not be copied', async () => {
      await mount({
        window: {diagnostics: () => Promise.reject(new Error('no'))},
      });
      await openPage('정보');
      await userEvent.click(screen.getByRole('button', {name: '복사'}));
      expect(await screen.findByText('복사하지 못했습니다')).toBeDefined();
    });
  });

  describe('the 전환 rows of the 출력 page', () => {
    const times = (label: string) =>
      screen.queryByRole('spinbutton', {name: label});

    it('shows independent defaults and a disabled time for none', async () => {
      await mount();
      await openPage('출력');
      const between = screen.getByRole('group', {name: '곡이 바뀔 때'});
      const inside = screen.getByRole('group', {name: '곡 안에서 넘길 때'});
      expect(
        within(between)
          .getByRole('button', {name: '디졸브'})
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(
        within(inside)
          .getByRole('button', {name: '없음'})
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(times('곡이 바뀔 때 시간')).toHaveProperty('value', '0.5');
      expect(times('곡 안에서 넘길 때 시간')).toHaveProperty('disabled', true);
      expect(times('배경 시간')).toHaveProperty('value', '0.5');
    });

    it('keeps a none time visible and disables direction', async () => {
      await mount({
        stored: {
          ...STORED,
          output: {transition: {between: {kind: 'none', sec: 1}}},
        },
      });
      await openPage('출력');
      const group = screen.getByRole('group', {name: '곡이 바뀔 때'});
      expect(
        within(group)
          .getByRole('button', {name: '없음'})
          .getAttribute('aria-pressed'),
      ).toBe('true');
      expect(times('곡이 바뀔 때 시간')).toHaveProperty('disabled', true);
      expect(times('곡이 바뀔 때 시간')).toHaveProperty('value', '1.0');
      expect(
        within(group).getByRole('button', {name: '왼쪽으로'}),
      ).toHaveProperty('disabled', true);
      expect(times('배경 시간')).not.toBeNull();
    });

    it('saves 없음 at once and keeps the seconds and the other fields', async () => {
      await mount({
        stored: {
          ...STORED,
          output: {transition: {between: {kind: 'wipe', dir: 'up', sec: 1.5}}},
        },
      });
      await openPage('출력');
      const group = screen.getByRole('group', {name: '곡이 바뀔 때'});
      expect(within(group).getByRole('button', {name: '위로'})).toHaveProperty(
        'disabled',
        false,
      );
      await userEvent.click(within(group).getByRole('button', {name: '없음'}));
      await waitFor(() => expect(edit).toHaveBeenCalledOnce());
      expect(written().output).toEqual({
        transition: {between: {sec: 1.5, kind: 'none'}},
      });
      expect(written()).toMatchObject(UNKNOWN_FIELDS);
    });

    it('saves a time within its range when it is committed', async () => {
      await mount();
      await openPage('출력');
      const field = screen.getByRole('spinbutton', {name: '배경 시간'});
      fireEvent.change(field, {target: {value: '2.5'}});
      fireEvent.keyDown(field, {key: 'Enter'});
      await waitFor(() => expect(edit).toHaveBeenCalledOnce());
      expect(written().output?.transition?.media?.seconds).toBe(2.5);
    });
  });

  it('writes the 저장 backup rows', async () => {
    await mount();
    await openPage('저장');
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
    await openPage('저장');
    const copies = screen.getByRole('spinbutton', {name: '파일마다'});
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
      screen.getByRole('checkbox', {name: 'Windows 시작할 때 실행'}),
    );
    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '환경설정 저장 실패'}),
      ),
    );

    onProblem.mockClear();
    edit.mockRejectedValueOnce(new Error('ipc down'));
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Windows 시작할 때 실행'}),
    );
    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
  });

  it('writes nothing for a file of a newer version', async () => {
    await mount({access: 'readOnly'});
    await userEvent.click(
      screen.getByRole('checkbox', {name: 'Windows 시작할 때 실행'}),
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
        expect.objectContaining({title: '기본 역본 저장 실패'}),
      ),
    );

    edit.mockClear();
    await userEvent.click(screen.getByRole('checkbox', {name: '절 번호'}));
    await waitFor(() =>
      expect(written()).toMatchObject({
        bible: {defaults: {verseNumbers: false}},
      }),
    );
  });

  it('shows the 새 구절 defaults, and writes each choice beside the other fields', async () => {
    await mount();
    await openPage('성경');
    expect(screen.queryByRole('button', {name: /한 슬라이드에/})).toBeNull();
    expect(
      screen.getByRole('button', {name: /구절 표시/}).textContent,
    ).toContain('슬라이드마다');
    const translationName = screen.getByRole('checkbox', {name: '역본 이름'});
    expect(translationName.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(translationName);
    await waitFor(() =>
      expect(written().bible?.defaults?.translationName).toBe(true),
    );
    edit.mockClear();
    await userEvent.click(screen.getByRole('button', {name: /구절 표시/}));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '마지막 슬라이드만'}),
    );
    await waitFor(() =>
      expect(written().bible?.defaults?.reference).toBe('last'),
    );
    expect(written()).toMatchObject(UNKNOWN_FIELDS);
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
      screen.getByRole('checkbox', {name: '앱을 켤 때 출력'}),
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
    await openPage('저장');
    await userEvent.click(screen.getByRole('checkbox', {name: '자동 백업'}));

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
      screen.getByRole('checkbox', {name: '앱을 켤 때 출력'}),
    );

    expect(edit).not.toHaveBeenCalled();
    pendingWritesOf(api).resume();
  });

  describe('the 미디어 page, 소리 rows', () => {
    const MIXER = {id: 'hall-1', label: 'Mixer (USB)'};

    function connect(...labels: Array<{id: string; label: string}>) {
      const list = labels.map(device => ({
        kind: 'audiooutput',
        deviceId: device.id,
        label: device.label,
      }));
      const devices = Object.assign(new EventTarget(), {
        enumerateDevices: vi.fn(() => Promise.resolve(list)),
      });
      const watch = vi.spyOn(devices, 'addEventListener');
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: devices,
      });
      return {enumerate: devices.enumerateDevices, watch};
    }
    afterEach(() => Reflect.deleteProperty(navigator, 'mediaDevices'));

    it('shows Windows 기본 장치 for both rows by default and lists each connected device', async () => {
      const discovery = connect(MIXER);
      await mount();
      await openPage('미디어');
      expect(screen.getByRole('heading').textContent).toBe('미디어');
      const output = screen.getByRole('button', {name: /출력 장치/});
      expect(output.textContent).toContain('Windows 기본 장치');
      expect(
        screen.getByRole('button', {name: /미리 듣기 장치/}).textContent,
      ).toContain('Windows 기본 장치');
      expect(discovery.enumerate).not.toHaveBeenCalled();
      expect(discovery.watch).not.toHaveBeenCalled();
      await userEvent.click(output);
      await screen.findByRole('menuitemradio', {name: 'Mixer (USB)'});
      expect(discovery.enumerate).toHaveBeenCalledOnce();
      expect(
        screen.getAllByRole('menuitemradio').map(row => row.textContent),
      ).toContain('Mixer (USB)');
    });

    it('saves a chosen device with its label at once and keeps the other media settings', async () => {
      connect(MIXER);
      await mount();
      await openPage('미디어');
      await userEvent.click(screen.getByRole('button', {name: /출력 장치/}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Mixer (USB)'}),
      );
      expect(written().media).toMatchObject({audioOutput: MIXER});
      expect(written()).toMatchObject(UNKNOWN_FIELDS);
    });

    it('saves the Windows default with an empty id and an empty label, no wording', async () => {
      connect(MIXER);
      await mount({
        stored: {...STORED, media: {audioOutput: MIXER}},
      });
      await openPage('미디어');
      await userEvent.click(screen.getByRole('button', {name: /출력 장치/}));
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Windows 기본 장치'}),
      );
      await waitFor(() => expect(edit).toHaveBeenCalledOnce());
      expect(written().media?.audioOutput).toEqual({id: '', label: ''});
    });

    it('marks a saved device that is not connected with the warning and keeps the choice', async () => {
      connect(MIXER);
      await mount({
        stored: {
          ...STORED,
          media: {previewOutput: {id: 'gone', label: 'Unplugged phones'}},
        },
      });
      await openPage('미디어');
      expect(
        screen.getByRole('button', {name: /미리 듣기 장치/}).textContent,
      ).toContain('Unplugged phones');
      expect(
        screen.getByRole('img', {name: MISSING_DEVICE_REASON}),
      ).toBeDefined();
      expect(edit).not.toHaveBeenCalled();
    });
  });

  describe('the 미디어 page, 새 미디어 rows', () => {
    it('shows 반복, 채우기, and the sound off by default', async () => {
      await mount();
      await openPage('미디어');
      expect(
        screen.getByRole('radio', {name: '반복'}).getAttribute('aria-checked'),
      ).toBe('true');
      expect(
        screen
          .getByRole('radio', {name: '채우기'})
          .getAttribute('aria-checked'),
      ).toBe('true');
      expect(
        screen
          .getByRole('checkbox', {name: '영상 소리'})
          .getAttribute('aria-checked'),
      ).toBe('false');
    });

    it('saves each default at once under media.defaults and keeps the other media fields', async () => {
      await mount({
        stored: {
          ...STORED,
          media: {previewOutput: {id: 'kept', label: 'Kept'}},
        },
      });
      await openPage('미디어');
      await userEvent.click(screen.getByRole('radio', {name: '정지'}));
      await waitFor(() => expect(edit).toHaveBeenCalledOnce());
      expect(written().media).toEqual({
        previewOutput: {id: 'kept', label: 'Kept'},
        defaults: {end: 'stop'},
      });
      expect(written()).toMatchObject(UNKNOWN_FIELDS);
    });
  });
});
