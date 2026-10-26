import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {MonitorList} from '@shared/schema/monitors';
import type {
  SettingsDocument,
  SettingsEdit,
} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {ScreenProperties} from './ScreenProperties';
import {useScreensSelection} from './selection';
import {
  CAPTIONS_ID,
  MAIN_ID,
  screensDocument,
  settingsDocument,
} from './testing/documents';

const monitors: MonitorList = [
  {
    number: 2,
    name: 'EPSON 프로젝터',
    bounds: {x: 1920, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow: false,
    screenIds: [MAIN_ID],
  },
];

function setup() {
  const edits: SettingsEdit[] = [];
  const onProblem = vi.fn();
  const listeners = new Set<(document: SettingsDocument) => void>();
  window.llp = fakeLlpApi({
    monitors: {get: () => Promise.resolve(monitors)},
    settings: {
      get: () => Promise.resolve(screensDocument()),
      subscribe: listener => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      edit: edit => {
        edits.push(edit);
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
        return Promise.resolve({ok: true, value: {id: 'screens', revision}});
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
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

async function nameField(): Promise<HTMLElement> {
  return screen.findByRole('textbox', {name: '이름'});
}

describe('the screen properties', () => {
  it('shows the selected screen with its monitor details', async () => {
    setup();

    const name = await nameField();

    expect(name).toHaveProperty('value', '본 화면');
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
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('leaves NDI unavailable', async () => {
    setup();
    await nameField();

    expect(
      screen.getByRole('radio', {name: 'NDI'}).getAttribute('aria-disabled'),
    ).toBe('true');
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

  it('keeps an empty or taken name out of the file and brings the old name back', async () => {
    const {edits} = setup();
    const user = userEvent.setup();
    const name = await nameField();

    await user.clear(name);
    expect(name.getAttribute('aria-invalid')).toBe('true');
    await user.tab();
    expect(name).toHaveProperty('value', '본 화면');

    await user.clear(name);
    await user.type(name, '무대 화면');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    await user.tab();
    expect(name).toHaveProperty('value', '본 화면');
    expect(edits).toEqual([]);
  });

  it('saves a change of kind and of 항상 위 at once', async () => {
    const {savedScreens} = setup();
    const user = userEvent.setup();
    await nameField();

    await user.click(screen.getByRole('radio', {name: '무대'}));
    await waitFor(() => expect(savedScreens()[0]?.kind).toBe('stage'));
    expect(await nameField()).toHaveProperty('value', '본 화면');
    await user.click(screen.getByRole('switch'));

    await waitFor(() => expect(savedScreens()[0]?.alwaysOnTop).toBe(false));
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
      selection: {kind: 'screen', id: CAPTIONS_ID},
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

  it('shows nothing while a Look holds the selection', async () => {
    useScreensSelection.setState({selection: {kind: 'look', id: 'x'}});
    setup();

    await waitFor(() => expect(window.llp).toBeDefined());
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
