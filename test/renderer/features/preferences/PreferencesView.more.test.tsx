import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/contentEdit';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {MISSING_DEVICE_REASON} from '@renderer/features/preferences/DeviceRow';
import {
  UNKNOWN_FIELDS,
  STORED,
  edit,
  onProblem,
  pushed,
  mount,
  written,
  openPage,
} from '@fixtures/renderer/features/preferences/preferencesViewTesting';

describe('PreferencesView', () => {
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

  it('does not offer global slide transitions in output settings', async () => {
    await mount();
    await openPage('출력');
    expect(screen.queryByRole('group', {name: '전환'})).toBeNull();
  });

  it('edits a new-slide default without writing the other kinds', async () => {
    await mount();
    await openPage('준비');
    await userEvent.click(screen.getByRole('button', {name: '성경 말씀 효과'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '디졸브'}));
    await waitFor(() =>
      expect(written().show?.slideDefaults?.bible).toEqual({
        kind: 'dissolve',
        sec: 0.7,
      }),
    );
    expect(written().show?.slideDefaults?.section).toBeUndefined();
  });

  it('shows preparation transition defaults and saves a direction', async () => {
    await mount();
    await openPage('준비');
    expect(screen.getByRole('button', {name: '곡 제목 효과'})).toBeDefined();
    expect(
      screen
        .getByRole('button', {name: '곡 방향'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('button', {name: '곡 제목 방향'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '→'}));
    await waitFor(() =>
      expect(written().show?.slideDefaults?.songTitle).toEqual({
        kind: 'wipe',
        dir: 'right',
        sec: 4,
      }),
    );
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
      await waitFor(() => expect(discovery.enumerate).toHaveBeenCalled());
      expect(discovery.watch).toHaveBeenCalled();
      await userEvent.click(output);
      await screen.findByRole('menuitemradio', {name: 'Mixer (USB)'});
      expect(discovery.enumerate.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByRole('menuitemradio').map(row => row.textContent),
      ).toContain('Mixer (USB)');
    });

    it('keeps an open device menu stable while devices change', async () => {
      const discovery = connect(MIXER);
      await mount();
      await openPage('미디어');
      await waitFor(() => expect(discovery.enumerate).toHaveBeenCalled());
      await userEvent.click(screen.getByRole('button', {name: /출력 장치/}));
      await screen.findByRole('menuitemradio', {name: 'Mixer (USB)'});
      discovery.enumerate.mockResolvedValue([
        {kind: 'audiooutput', deviceId: 'new', label: 'New device'},
      ]);
      await act(async () => {
        navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
      });
      await waitFor(() =>
        expect(discovery.enumerate.mock.calls.length).toBeGreaterThan(1),
      );
      expect(
        screen.queryByRole('menuitemradio', {name: 'New device'}),
      ).toBeNull();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', {name: /출력 장치/}));
      expect(
        await screen.findByRole('menuitemradio', {name: 'New device'}),
      ).toBeDefined();
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

    it('keeps the previous devices visible while an open refresh is pending', async () => {
      const discovery = connect(MIXER);
      await mount();
      await openPage('미디어');
      await waitFor(() => expect(discovery.enumerate).toHaveBeenCalled());
      await Promise.resolve();
      discovery.enumerate.mockImplementationOnce(() => new Promise(() => {}));
      await userEvent.click(screen.getByRole('button', {name: /출력 장치/}));
      expect(
        screen.getByRole('menuitemradio', {name: 'Mixer (USB)'}),
      ).toBeDefined();
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
