import {settingsDocument} from '@fixtures/core/settingsDocument';
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
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DEFAULT_MESSAGE_STYLE, type MessageStyle} from '@core/schema/messages';
import {createMessageStyleId} from '@core/schema/ids';
import type {MonitorList} from '@core/schema/monitors';
import type {EditResult} from '@core/schema/contentEdit';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {ScreenProperties} from '@renderer/features/screens/ScreenProperties';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {
  CAPTIONS_ID,
  MAIN_ID,
  screensDocument,
} from '@fixtures/core/screenDocuments';

const monitors: MonitorList = [
  {
    id: 2,
    number: 2,
    name: 'EPSON 프로젝터',
    bounds: {x: 1920, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow: false,
    screenIds: [MAIN_ID],
  },
  {
    id: 1,
    number: 1,
    name: 'Desk',
    bounds: {x: 0, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow: true,
    screenIds: [],
  },
];

function setup({
  access = 'editable',
  beforeSave = () => Promise.resolve(),
  messageStyles = [],
}: {
  readonly messageStyles?: readonly MessageStyle[];
  readonly access?: 'editable' | 'readOnly';
  readonly beforeSave?: () => Promise<void>;
} = {}) {
  const edits: SettingsEdit[] = [];
  const onProblem = vi.fn();
  const listeners = new Set<(document: SettingsDocument) => void>();
  window.llp = mockLlpApi({
    monitors: {get: () => Promise.resolve(monitors)},
    settings: {
      get: ({name}) =>
        Promise.resolve(
          name === 'messages'
            ? settingsDocument('messages', {
                templates: [],
                messageStyles,
              })
            : {...screensDocument(), access},
        ),
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      edit: async (edit): Promise<EditResult> => {
        edits.push(edit);
        await beforeSave();
        const revision = edits.length + 1;
        if (edit.name === 'screens') {
          const next = settingsDocument(
            'screens',
            {screens: edit.value.screens},
            revision,
          );
          act(() => {
            for (const listener of listeners) listener(next);
          });
        }
        return {ok: true, value: {id: 'screens', revision}};
      },
    },
  });
  render(<ScreenProperties onProblem={onProblem} />);
  const savedScreens = () => {
    const edit = edits.at(-1);
    return edit?.name === 'screens' ? edit.value.screens : [];
  };
  return {edits, onProblem, savedScreens};
}

beforeEach(() => {
  useScreensSelection.setState({selection: {id: null}});
});

afterEach(() => {
  cleanup();
  resetTooltips();
  delete window.llp;
});

async function nameField(): Promise<HTMLElement> {
  return screen.findByRole('textbox', {name: '이름'});
}

describe('the screen properties', () => {
  it('shows song caption controls only for broadcast and saves the selected look', async () => {
    const {savedScreens} = setup();
    await nameField();
    expect(
      screen.queryByRole('radiogroup', {name: '\ucc2c\uc591 \uc790\ub9c9'}),
    ).toBeNull();
    act(() => useScreensSelection.getState().select(CAPTIONS_ID));
    const group = await screen.findByRole('radiogroup', {
      name: '\ucc2c\uc591 \uc790\ub9c9',
    });
    const band = within(group).getByRole('radio', {name: '\ub760'});
    expect(band.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(
      within(group).getByRole('radio', {name: '\uae00\uc528\ub9cc'}),
    );
    await waitFor(() =>
      expect(
        savedScreens().find(item => item.id === CAPTIONS_ID)?.songCaption,
      ).toBe('text'),
    );
    expect(
      savedScreens().find(item => item.id === MAIN_ID)?.songCaption,
    ).toBeUndefined();
  });
  it('shows black for regular output and green for capture, and saves a chosen empty color', async () => {
    const {savedScreens} = setup();
    expect(
      (await screen.findByRole('textbox', {name: '빈 화면 색'})).getAttribute(
        'value',
      ),
    ).toBe('#000000');
    act(() => useScreensSelection.getState().select(CAPTIONS_ID));
    const color = await screen.findByRole('textbox', {name: '빈 화면 색'});
    expect(color.getAttribute('value')).toBe('#00B140');
    await userEvent.clear(color);
    await userEvent.type(color, '#123456{Enter}');
    await waitFor(() =>
      expect(
        savedScreens().find(item => item.id === CAPTIONS_ID)?.emptyColor,
      ).toBe('#123456'),
    );
    expect(
      savedScreens().find(item => item.id === MAIN_ID)?.emptyColor,
    ).toBeUndefined();
  });

  it('keeps the empty color read-only in newer settings', async () => {
    const {edits} = setup({access: 'readOnly'});
    const color = await screen.findByRole('textbox', {name: '빈 화면 색'});
    expect(color.hasAttribute('readonly')).toBe(true);
    expect(
      screen
        .getByRole('button', {name: '빈 화면 색 선택'})
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(edits).toEqual([]);
  });
  it('locks the device select for a read-only document', async () => {
    const {edits} = setup({access: 'readOnly'});
    await nameField();
    const device = screen.getByRole('button', {name: '장치'});
    expect(device.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(device);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(edits).toEqual([]);
  });

  it('keeps both offset axes when another edit waits for a delayed save', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const {savedScreens, edits} = setup({beforeSave: () => held});
    const user = userEvent.setup();
    await nameField();
    const x = screen.getByRole('spinbutton', {name: '가로 위치'});
    const y = screen.getByRole('spinbutton', {name: '세로 위치'});
    await user.clear(x);
    await user.type(x, '20{Enter}');
    await waitFor(() => expect(edits).toHaveLength(1));
    await user.clear(y);
    await user.type(y, '30{Enter}');
    expect(edits).toHaveLength(1);

    release();

    await waitFor(() =>
      expect(savedScreens()[0]?.offset).toEqual({x: 20, y: 30}),
    );
  });

  it('locks read-only properties, explains why, and sends no edits', async () => {
    const {edits} = setup({access: 'readOnly'});
    const user = userEvent.setup();
    const name = await nameField();
    expect(name).toHaveProperty('readOnly', true);
    await user.type(name, '새 이름{Enter}');
    expect(name).toHaveProperty('value', '청중 화면');
    const kind = screen.getByRole('radio', {name: '무대'});
    expect(kind.getAttribute('aria-disabled')).toBe('true');
    await user.click(kind);
    const method = screen.getByRole('radio', {name: '창'});
    expect(method.getAttribute('aria-disabled')).toBe('true');
    await user.click(method);
    const alwaysOnTop = screen.getByRole('checkbox');
    expect(alwaysOnTop.getAttribute('aria-disabled')).toBe('true');
    await user.click(alwaysOnTop);
    const disconnect = screen.getByRole('button', {name: '연결이 끊기면'});
    expect(disconnect.getAttribute('aria-disabled')).toBe('true');
    await user.click(disconnect);
    expect(screen.queryByRole('menu')).toBeNull();
    for (const field of screen.getAllByRole('spinbutton')) {
      expect(field).toHaveProperty('readOnly', true);
      await user.type(field, '20{Enter}');
    }
    expect(edits).toEqual([]);
    expect((await hoverForTooltip(alwaysOnTop))?.textContent).toBe(
      '새 버전의 파일이라 바꿀 수 없습니다',
    );
  });

  it('locks the capture resolution for a read-only file', async () => {
    useScreensSelection.setState({
      selection: {id: CAPTIONS_ID},
    });
    const {edits} = setup({access: 'readOnly'});
    await nameField();
    const resolution = screen.getByRole('button', {name: '해상도'});
    expect(resolution.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(resolution);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(edits).toEqual([]);
  });

  it('offers only output monitors and saves the chosen display identity', async () => {
    const {savedScreens} = setup();
    await nameField();
    const device = await screen.findByRole('button', {name: '장치'});
    await waitFor(() => expect(device.textContent).toContain('EPSON 프로젝터'));
    await userEvent.click(device);
    expect(screen.queryByRole('menuitemradio', {name: /모니터 1/})).toBeNull();
    await userEvent.click(
      screen.getByRole('menuitemradio', {name: /모니터 2/}),
    );
    await waitFor(() =>
      expect(savedScreens()[0]?.display).toMatchObject({
        id: 2,
        name: 'EPSON 프로젝터',
        number: 2,
        scaleFactor: 1,
      }),
    );
  });

  it('hides the device row for capture windows', async () => {
    useScreensSelection.setState({
      selection: {id: CAPTIONS_ID},
    });
    setup();
    await nameField();
    expect(screen.queryByRole('button', {name: '장치'})).toBeNull();
  });

  it('shows the selected screen with its monitor details', async () => {
    setup();

    const name = await nameField();

    expect(name).toHaveProperty('value', '청중 화면');
    expect(
      screen.getByRole('radio', {name: '청중'}).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen
        .getByRole('radio', {name: '전체 화면'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(await screen.findByText('1920×1080')).toBeTruthy();
    expect(screen.getByText('60Hz')).toBeTruthy();
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it('selects NDI for a broadcast screen and shows its settings', async () => {
    const {savedScreens} = setup();
    const user = userEvent.setup();
    await nameField();
    act(() => useScreensSelection.getState().select(CAPTIONS_ID));
    await user.click(await screen.findByRole('radio', {name: 'NDI'}));
    await waitFor(() =>
      expect(savedScreens().find(item => item.id === CAPTIONS_ID)?.method).toBe(
        'ndi',
      ),
    );
    expect(
      await screen.findByRole('textbox', {name: '소스 이름'}),
    ).toHaveProperty('value', 'LOVELIGHT 방송 화면');
    const source = await screen.findByRole('textbox', {name: '소스 이름'});
    expect(source.getAttribute('maxlength')).toBe('64');
    await user.clear(source);
    await user.type(source, 'Broadcast source{Enter}');
    await waitFor(() =>
      expect(
        savedScreens().find(item => item.id === CAPTIONS_ID)?.ndi?.sourceName,
      ).toBe('Broadcast source'),
    );
    const hardware = screen.getByRole('checkbox', {name: '하드웨어 가속'});
    expect(hardware.getAttribute('aria-checked')).toBe('true');
    await user.click(hardware);
    await waitFor(() =>
      expect(
        savedScreens().find(item => item.id === CAPTIONS_ID)?.ndi
          ?.hardwareAcceleration,
      ).toBe(false),
    );
    expect(screen.getByText('30fps')).toBeTruthy();
  });

  it('saves a new name when the field is left', async () => {
    const {savedScreens} = setup();
    const user = userEvent.setup();
    const name = await nameField();

    await user.clear(name);
    await user.type(name, '본당');
    await user.tab();

    await waitFor(() => expect(savedScreens()[0]?.name).toBe('본당'));
  });

  it('rejects a duplicate name queued before an earlier rename is published', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const {edits, savedScreens, onProblem} = setup({beforeSave: () => held});
    const user = userEvent.setup();
    const first = await nameField();
    await user.clear(first);
    await user.type(first, '공통 이름{Enter}');
    await waitFor(() => expect(edits).toHaveLength(1));

    act(() => useScreensSelection.getState().select(CAPTIONS_ID));
    const second = await nameField();
    await user.clear(second);
    await user.type(second, '공통 이름{Enter}');
    expect(edits).toHaveLength(1);
    release();

    await waitFor(() =>
      expect(onProblem).toHaveBeenCalledWith(
        expect.objectContaining({title: '같은 이름의 화면이 있습니다'}),
      ),
    );
    expect(edits).toHaveLength(1);
    expect(savedScreens()[0]?.name).toBe('공통 이름');
    expect(savedScreens()[1]?.name).toBe('방송 화면');
  });

  it('keeps a queued reversion to the displayed name while the first rename is held', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const {edits, savedScreens} = setup({beforeSave: () => held});
    const user = userEvent.setup();
    const name = await nameField();
    await user.clear(name);
    await user.type(name, '임시 이름{Enter}');
    await waitFor(() => expect(edits).toHaveLength(1));
    await user.clear(name);
    await user.type(name, '청중 화면{Enter}');
    expect(edits).toHaveLength(1);

    release();
    await waitFor(() => expect(edits).toHaveLength(2));
    expect(savedScreens()[0]?.name).toBe('청중 화면');
  });

  it('keeps the screen name focused when Enter confirms an IME composition', async () => {
    const {edits, savedScreens} = setup();
    const user = userEvent.setup();
    const name = await nameField();
    await user.clear(name);
    await user.type(name, '본당');

    fireEvent.keyDown(name, {key: 'Enter', isComposing: true});
    expect(document.activeElement).toBe(name);
    expect(edits).toEqual([]);

    await user.keyboard('{Enter}');
    await waitFor(() => expect(savedScreens()[0]?.name).toBe('본당'));
  });

  it('keeps an empty or taken name out of the file and brings the old name back', async () => {
    const {edits} = setup();
    const user = userEvent.setup();
    const name = await nameField();

    await user.clear(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    await user.tab();
    expect(name).toHaveProperty('value', '청중 화면');

    await user.clear(name);
    await user.type(name, '무대 화면');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    await user.tab();
    expect(name).toHaveProperty('value', '청중 화면');
    expect(edits).toEqual([]);
  });

  it('saves a change of kind and of 항상 위 at once', async () => {
    const {savedScreens} = setup();
    const user = userEvent.setup();
    await nameField();

    await user.click(screen.getByRole('radio', {name: '무대'}));
    await waitFor(() => expect(savedScreens()[0]?.kind).toBe('stage'));
    expect(await nameField()).toHaveProperty('value', '청중 화면');
    await user.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(savedScreens()[0]?.alwaysOnTop).toBe(true));
    expect(savedScreens()[0]?.kind).toBe('stage');
  });

  it('saves 연결이 끊기면 only for a full screen', async () => {
    const {savedScreens} = setup();
    const user = userEvent.setup();
    await nameField();

    await user.click(screen.getByRole('button', {name: '연결이 끊기면'}));
    await user.click(screen.getByRole('menuitemradio', {name: '출력 끄기'}));
    await waitFor(() => expect(savedScreens()[0]?.onDisconnect).toBe('off'));

    await user.click(screen.getByRole('radio', {name: '창'}));
    await waitFor(() => expect(savedScreens()[0]?.method).toBe('window'));
    expect(screen.queryByText('연결이 끊기면')).toBeNull();
  });

  it('offers the capture sizes for a capture window and saves the choice', async () => {
    useScreensSelection.setState({
      selection: {id: CAPTIONS_ID},
    });
    const {savedScreens} = setup();
    const user = userEvent.setup();
    await nameField();

    await user.click(screen.getByRole('button', {name: '해상도'}));
    await user.click(screen.getByRole('menuitemradio', {name: '1280×720'}));

    await waitFor(() =>
      expect(savedScreens()[1]?.resolution).toEqual({width: 1280, height: 720}),
    );
    expect(screen.queryByText('60Hz')).toBeNull();
  });

  it('saves the correction within its limits', async () => {
    const {savedScreens} = setup();
    const user = userEvent.setup();
    await nameField();

    const margin = screen.getByRole('spinbutton', {name: /가장자리 여백/});
    await user.clear(margin);
    await user.type(margin, '50{Enter}');
    await waitFor(() => expect(savedScreens()[0]?.edgeMargin).toBe(20));

    const x = screen.getByRole('spinbutton', {name: '가로 위치'});
    await user.clear(x);
    await user.type(x, '-30{Enter}');
    await waitFor(() =>
      expect(savedScreens()[0]?.offset).toEqual({x: -30, y: 0}),
    );
  });

  describe('the 메시지 스타일 row', () => {
    const bigStyle: MessageStyle = {
      ...DEFAULT_MESSAGE_STYLE,
      id: createMessageStyleId('44444444-4444-4444-8444-444444444444'),
      name: '큰 글씨',
      size: 120,
    };

    it('saves a chosen style and returns to 기본', async () => {
      const {savedScreens} = setup({messageStyles: [bigStyle]});
      const user = userEvent.setup();
      await nameField();
      expect(
        screen.getByRole('button', {name: '메시지 스타일'}).textContent,
      ).toContain('기본');

      await user.click(screen.getByRole('button', {name: '메시지 스타일'}));
      await user.click(screen.getByRole('menuitemradio', {name: '큰 글씨'}));
      await waitFor(() =>
        expect(savedScreens()[0]?.messageStyleId).toBe(bigStyle.id),
      );

      await user.click(screen.getByRole('button', {name: '메시지 스타일'}));
      await user.click(screen.getByRole('menuitemradio', {name: '기본'}));
      await waitFor(() =>
        expect(savedScreens()[0]?.messageStyleId).toBeUndefined(),
      );
      expect(savedScreens()[0]?.name).toBe('청중 화면');
    });

    it('stays locked with its reason for a read-only file', async () => {
      const {edits} = setup({access: 'readOnly', messageStyles: [bigStyle]});
      const user = userEvent.setup();
      await nameField();
      const row = screen.getByRole('button', {name: '메시지 스타일'});

      expect(row.getAttribute('aria-disabled')).toBe('true');
      await user.click(row);
      expect(screen.queryByRole('menu')).toBeNull();
      expect(edits).toEqual([]);
      expect((await hoverForTooltip(row))?.textContent).toBe(
        '새 버전의 파일이라 바꿀 수 없습니다',
      );
    });
  });
});
