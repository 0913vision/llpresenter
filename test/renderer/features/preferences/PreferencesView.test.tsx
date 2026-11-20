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
import {describe, expect, it, vi} from 'vitest';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {PreferencePageId} from '@core/schema/preferencePages';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';
import {MenuBar} from '@renderer/app/shell/MenuBar';
import {renderWithScreenSummaries} from '@fixtures/renderer/platform/screenSummaries';
import {
  UNKNOWN_FIELDS,
  STORED,
  edit,
  onProblem,
  pushed,
  install,
  mount,
  written,
  openPage,
} from '@fixtures/renderer/features/preferences/preferencesViewTesting';

describe('PreferencesView', () => {
  it('announces the requested page when the font API is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(document, 'fonts');
    Reflect.deleteProperty(document, 'fonts');
    const onReady = vi.fn();
    const request = {requestId: 1, page: 'general'} as const;
    try {
      render(
        <PreferencesView
          onProblem={onProblem}
          onReady={onReady}
          request={request}
        />,
      );
      await waitFor(() => expect(onReady).toHaveBeenCalledWith(request));
    } finally {
      if (original !== undefined) {
        Object.defineProperty(document, 'fonts', original);
      }
    }
  });
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

  it('lists the pages and opens the 단축키 page', async () => {
    await mount();

    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '일반',
      '진행',
      '준비',
      '출력',
      '예배 순서',
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

  it('saves the clear fade duration for the selected target', async () => {
    await mount();
    await openPage('진행');
    const duration = screen.getByRole('spinbutton', {name: '모두 지우기 시간'});
    fireEvent.change(duration, {target: {value: '1.5'}});
    fireEvent.blur(duration);
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(written()).toMatchObject({
      clearKeys: {all: {fade: true, durationMs: 1500}},
    });
  });

  it('saves past-row dimming immediately while preserving other show settings', async () => {
    await mount({
      stored: {...STORED, show: {atLastSlide: 'nextItem'}},
    });
    await openPage('예배 순서');
    const checkbox = screen.getByRole('checkbox', {name: '지난 순서 흐리게'});
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(checkbox);
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(written()).toMatchObject({
      ...UNKNOWN_FIELDS,
      show: {dimPastItems: true, atLastSlide: 'nextItem'},
    });
    act(() =>
      pushed({
        name: 'preferences',
        value: written(),
        revision: 6,
        access: 'editable',
      }),
    );
    await waitFor(() =>
      expect(checkbox.getAttribute('aria-checked')).toBe('true'),
    );
    await userEvent.click(checkbox);
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(written()).toMatchObject({show: {dimPastItems: false}});
  });

  it('keeps the last-slide choice and menu check in sync in both directions', async () => {
    await mount();
    renderWithScreenSummaries(<MenuBar title="" />);
    await openPage('예배 순서');
    const choice = screen.getByRole('radiogroup', {
      name: '마지막 슬라이드에서',
    });
    const stop = within(choice).getByRole('radio', {name: '멈춤'});
    const next = within(choice).getByRole('radio', {name: '다음 항목으로'});
    expect(stop.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(next);
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    expect(written()).toMatchObject({show: {atLastSlide: 'nextItem'}});
    act(() =>
      pushed({
        name: 'preferences',
        value: written(),
        revision: 6,
        access: 'editable',
      }),
    );
    await userEvent.click(screen.getByRole('menuitem', {name: '진행'}));
    const row = screen.getByRole('menuitemcheckbox', {
      name: '마지막 슬라이드에서 다음 항목으로',
    });
    await waitFor(() => expect(row.getAttribute('aria-checked')).toBe('true'));
    await userEvent.click(row);
    await waitFor(() => expect(edit).toHaveBeenCalledTimes(2));
    expect(written()).toMatchObject({show: {atLastSlide: 'stop'}});
    act(() =>
      pushed({
        name: 'preferences',
        value: written(),
        revision: 7,
        access: 'editable',
      }),
    );
    await waitFor(() => expect(stop.getAttribute('aria-checked')).toBe('true'));
  });

  it('loads saved past-row dimming and locks it for a newer preferences file', async () => {
    await mount({
      access: 'readOnly',
      stored: {...STORED, show: {dimPastItems: true}},
    });
    await openPage('예배 순서');
    const checkbox = screen.getByRole('checkbox', {name: '지난 순서 흐리게'});
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    expect(checkbox.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(checkbox);
    expect(edit).not.toHaveBeenCalled();
  });

  it('shows zoom and startup choices on the general page', async () => {
    await mount();

    expect(screen.getByRole('button', {name: /화면 확대/})).toBeTruthy();
    expect(
      screen
        .getByRole('checkbox', {name: 'Windows 시작할 때 실행'})
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      screen
        .getByRole('checkbox', {name: '시작할 때 최대화'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    for (const gone of ['언어', '복구 사본', '지우기 되돌리기']) {
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

  it('saves the stage lyric label position from output preferences', async () => {
    await mount();
    await openPage('출력');
    expect(
      screen.getByRole('button', {name: /무대 가사 이름표/}).textContent,
    ).toContain('가사 위 한 줄');
    await userEvent.click(
      screen.getByRole('button', {name: /무대 가사 이름표/}),
    );
    expect(
      await screen.findByRole('menuitemradio', {
        name: /^가사 위 한 줄$/u,
      }),
    ).toBeDefined();
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '가사 앞에 붙이기'}),
    );
    await waitFor(() =>
      expect(written().output?.stageLyricLabelPosition).toBe('inline'),
    );
    expect(written()).toMatchObject(UNKNOWN_FIELDS);
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
});
