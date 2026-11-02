import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  BackUpNowResult,
  ChooseLocationResult,
  LocationsView,
} from '@core/schema/libraryLocations';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {defaultPreferences} from '@core/schema/preferences';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {PreferencesView} from '@renderer/features/preferences/PreferencesView';

const SONGS = 'C:\\data\\Songs';
const MEDIA = 'C:\\data\\Media';
const BACKUPS = 'C:\\data\\Backups';
const VIEW: LocationsView = {
  songs: {path: SONGS, pending: false},
  media: {path: MEDIA, pending: true},
  backup: {path: BACKUPS, pending: false},
  lastBackup: null,
  backingUp: false,
};

const onProblem = vi.fn();

function install(parts: {
  readonly view?: LocationsView;
  readonly choose?: LlpApi['locations']['choose'];
  readonly backUpNow?: LlpApi['locations']['backUpNow'];
  readonly zoom?: number;
}) {
  const document: SettingsDocument = {
    name: 'preferences',
    value: {format: defaultPreferences.format, schemaVersion: 1},
    revision: 1,
    access: 'editable',
  };
  const stopLocations = vi.fn();
  const stopZoom = vi.fn();
  let pushLocations: (view: LocationsView) => void = () => undefined;
  let pushZoom: (percent: number) => void = () => undefined;
  const changeZoom = vi.fn(() => Promise.resolve(100));
  window.llp = mockLlpApi({
    settings: {get: () => Promise.resolve(document)},
    locations: {
      get: () => Promise.resolve(parts.view ?? VIEW),
      subscribe: listener => {
        pushLocations = listener;
        return stopLocations;
      },
      ...(parts.choose === undefined ? {} : {choose: parts.choose}),
      ...(parts.backUpNow === undefined ? {} : {backUpNow: parts.backUpNow}),
    },
    ui: {
      getZoom: () => Promise.resolve(parts.zoom ?? 100),
      onZoomChanged: listener => {
        pushZoom = listener;
        return stopZoom;
      },
      changeZoom,
    },
  });
  return {
    stopLocations,
    stopZoom,
    changeZoom,
    pushLocations: (view: LocationsView) => pushLocations(view),
    pushZoom: (percent: number) => pushZoom(percent),
  };
}

async function mount(page?: string) {
  const view = render(<PreferencesView onProblem={onProblem} />);
  await screen.findByRole('switch', {name: '지우기 되돌리기 단추 보이기'});
  if (page !== undefined) {
    await userEvent.click(screen.getByRole('option', {name: page}));
  }
  return view;
}

async function changeButtons(): Promise<HTMLElement[]> {
  return screen.findAllByRole('button', {name: '바꾸기'});
}

afterEach(() => {
  cleanup();
  resetTooltips();
  onProblem.mockReset();
  delete window.llp;
});

describe('일반 > UI 확대', () => {
  it('shows the stored zoom, sets a chosen step, and follows other windows', async () => {
    const api = install({zoom: 120});
    await mount();
    const row = await screen.findByRole('button', {name: /UI 확대/});
    await waitFor(() => expect(row.textContent).toContain('120%'));

    await userEvent.click(row);
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '140%'}),
    );
    expect(api.changeZoom).toHaveBeenCalledExactlyOnceWith({
      type: 'ui.zoomSet',
      percent: 140,
    });

    api.pushZoom(100);
    await waitFor(() => expect(row.textContent).toContain('100%'));
  });

  it('lists every step of the zoom', async () => {
    install({});
    await mount();
    await userEvent.click(await screen.findByRole('button', {name: /UI 확대/}));

    const steps = (await screen.findAllByRole('menuitemradio')).map(
      item => item.textContent,
    );
    expect(steps).toEqual(
      Array.from({length: 11}, (_, index) => `${100 + index * 10}%`),
    );
  });

  it('stops following the zoom when the window closes', async () => {
    const api = install({});
    const view = await mount();

    view.unmount();

    expect(api.stopZoom).toHaveBeenCalledOnce();
  });
});

describe('라이브러리 > 위치 and 백업', () => {
  it('shows the three folders in read-only fields with the note while a change waits', async () => {
    install({});
    await mount('라이브러리');

    expect(await screen.findByDisplayValue(SONGS)).toHaveProperty(
      'readOnly',
      true,
    );
    expect(screen.getByDisplayValue(BACKUPS)).toBeDefined();
    expect(await changeButtons()).toHaveLength(3);
    expect(
      (
        await hoverForTooltip(
          screen.getByDisplayValue(MEDIA).parentElement ?? document.body,
        )
      )?.textContent,
    ).toBe('다음에 켤 때 적용됩니다');
  });

  it.each([
    [0, 'songsPath'],
    [1, 'mediaPath'],
    [2, 'backupPath'],
  ])('asks main to change folder %i with %s', async (index, field) => {
    const choose = vi.fn<LlpApi['locations']['choose']>(() =>
      Promise.resolve<ChooseLocationResult>({ok: true, value: undefined}),
    );
    install({choose});
    await mount('라이브러리');
    const button = (await changeButtons())[index];
    if (button === undefined) throw new Error('Missing 바꾸기 button');

    await userEvent.click(button);

    expect(choose).toHaveBeenCalledExactlyOnceWith({field});
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('shows a warning for a refused folder and nothing for a canceled dialog', async () => {
    const choose = vi
      .fn<LlpApi['locations']['choose']>()
      .mockResolvedValueOnce({ok: false, error: {reason: 'canceled'}})
      .mockResolvedValueOnce({
        ok: false,
        error: {reason: 'not-writable', detail: 'EACCES'},
      });
    install({choose});
    await mount('라이브러리');
    const [first] = await changeButtons();
    if (first === undefined) throw new Error('Missing 바꾸기 button');

    await userEvent.click(first);
    await userEvent.click(first);

    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    expect(onProblem).toHaveBeenCalledWith(
      expect.objectContaining({title: '이 폴더에는 쓸 수 없음'}),
    );
  });

  it('shows the reason of an overlapping folder in the tooltip of its row', async () => {
    const choose = vi.fn<LlpApi['locations']['choose']>(() =>
      Promise.resolve<ChooseLocationResult>({
        ok: false,
        error: {reason: 'overlaps-backup'},
      }),
    );
    install({choose});
    await mount('라이브러리');
    const buttons = await changeButtons();
    const backup = buttons[2];
    if (backup === undefined) throw new Error('Missing 바꾸기 button');

    await userEvent.click(backup);

    await waitFor(() => expect(onProblem).toHaveBeenCalledOnce());
    expect(
      (
        await hoverForTooltip(
          screen.getByDisplayValue(BACKUPS).parentElement ?? document.body,
        )
      )?.textContent,
    ).toBe('백업 위치와 겹치는 폴더');
  });

  it('shows 없음 when there is no backup', async () => {
    install({});
    await mount('라이브러리');

    expect(await screen.findByText('없음')).toBeDefined();
  });

  it('shows the time of the last backup', async () => {
    install({view: {...VIEW, lastBackup: Date.now()}});
    await mount('라이브러리');

    expect(await screen.findByText(/^오늘 \d\d:\d\d$/)).toBeDefined();
  });

  it('runs one backup, is disabled while it runs, and follows the pushes', async () => {
    const backUpNow = vi.fn<LlpApi['locations']['backUpNow']>(
      () => new Promise<BackUpNowResult>(() => undefined),
    );
    const api = install({backUpNow});
    await mount('라이브러리');
    const button = await screen.findByRole('button', {name: '지금 백업'});

    await userEvent.click(button);
    expect(backUpNow).toHaveBeenCalledOnce();
    api.pushLocations({...VIEW, backingUp: true});
    await waitFor(() =>
      expect(button.getAttribute('aria-disabled')).toBe('true'),
    );

    api.pushLocations({...VIEW, lastBackup: Date.now()});
    await waitFor(() =>
      expect(button.getAttribute('aria-disabled')).not.toBe('true'),
    );
    expect(onProblem).not.toHaveBeenCalled();
  });

  it('shows the warning of a failed backup', async () => {
    install({
      backUpNow: () => Promise.resolve({ok: false, error: {reason: 'failed'}}),
    });
    await mount('라이브러리');

    await userEvent.click(
      await screen.findByRole('button', {name: '지금 백업'}),
    );

    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '백업하지 못함'}),
      ),
    );
  });

  it('stops following the folders when the window closes', async () => {
    const api = install({});
    const view = await mount('라이브러리');

    view.unmount();

    expect(api.stopLocations).toHaveBeenCalledOnce();
  });
});
