import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeFile} from '@fixtures/core/themeOutput';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import {applyService} from '@renderer/session/show';
import {openLibrarySong} from '@renderer/session/showLibrary';
import {fixtureSong} from '@fixtures/renderer/features/songs/library/libraryFixture';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';
import {
  stageFixture,
  STAGE_ID,
} from '@fixtures/renderer/features/tools/stageTesting';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];

function createSession(): ControlSession {
  const api = window.llp;
  if (api !== undefined) {
    const get = api.settings.get;
    vi.spyOn(api.settings, 'get').mockImplementation(request =>
      request.name === 'screens'
        ? Promise.resolve(settingsDocument('screens', {screens: []}))
        : request.name === 'themes'
          ? Promise.resolve(settingsDocument('themes', themeFile()))
          : get(request),
    );
  }
  const session = new ControlSession(window.llp);
  sessions.push(session);
  return session;
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  applyService(null);
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  applyService(null);
  useLive.setState({state: null});
  delete window.llp;
});

describe('App', () => {
  it('runs assigned live-state actions while the stage and notice tabs are closed', async () => {
    const previousTool = useShowToolTab.getState().tool;
    const noticeId = '44000000-0000-4000-8000-000000000021';
    const media = ['44000000-0000-4000-8000-000000000022'];
    const fixture = stageFixture([
      settingsDocument('shortcuts', {
        bindings: {
          'notice.pauseResume': [{code: 'F8', mods: []}],
          'stage.hideMessage': [{code: 'F9', mods: []}],
        },
      }),
      settingsDocument('macros', {macros: [], collections: []}),
      settingsDocument('quick', {items: []}),
    ]);
    const startedAt = Date.now();
    const active = (pausedAt: number | null): void =>
      fixture.live({
        stageMessage: '창작 무대 안내',
        layers: {
          ...emptyLiveState().layers,
          notice: {
            noticeId,
            playback: {
              media,
              position: 0,
              interval: 8,
              loop: true,
              targets: [STAGE_ID],
              startedAt,
              pausedAt,
            },
          },
        },
      });
    active(null);
    useShowToolTab.getState().setTool('macro');
    const session = new ControlSession(window.llp);
    sessions.push(session);
    const view = render(
      <App
        session={session}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    try {
      await waitFor(() =>
        expect(fixture.get).toHaveBeenCalledWith({name: 'shortcuts'}),
      );
      expect(screen.queryByRole('textbox', {name: '무대 메시지'})).toBeNull();
      expect(screen.queryByRole('button', {name: '일시 정지'})).toBeNull();
      fireEvent.keyDown(document.body, {code: 'F8'});
      expect(fixture.send).toHaveBeenLastCalledWith({type: 'notice.pause'});
      act(() => active(Date.now()));
      fireEvent.keyDown(document.body, {code: 'F8'});
      expect(fixture.send).toHaveBeenLastCalledWith({
        type: 'notice.start',
        noticeId,
      });
      fireEvent.keyDown(document.body, {code: 'F9'});
      expect(fixture.send).toHaveBeenLastCalledWith({
        type: 'stage.message.set',
        text: null,
      });
      fixture.send.mockClear();
      act(() => fixture.live({}));
      fireEvent.keyDown(document.body, {code: 'F8'});
      fireEvent.keyDown(document.body, {code: 'F9'});
      expect(fixture.send).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      useShowToolTab.getState().setTool(previousTool);
    }
  });

  it('opens a library source slide in prep without inventing a service item', async () => {
    const base = fixtureSong(1, 'Invented song');
    const document = {
      ...base,
      song: {
        ...base.song,
        arrangements: [
          {
            name: 'Repeated',
            groups: base.song.groups.flatMap(group => [group.id, group.id]),
          },
        ],
        groups: base.song.groups.map(group => ({
          ...group,
          slides: [{lines: ['First']}, {lines: ['Second']}, {lines: ['Third']}],
        })),
      },
    };
    window.llp = mockLlpApi({
      songs: {
        get: async () => document,
        list: async () => [
          {
            id: document.song.id,
            title: document.song.title,
            slideCount: 3,
            access: 'editable',
            usedBy: [],
          },
        ],
      },
    });
    openLibrarySong({
      songId: document.song.id,
      songRevision: 1,
      title: document.song.title,
      readOnly: false,
      tiles: ['First', 'Second', 'Third'].map(line => ({
        lines: [line],
        label: null,
        labelColor: 'none',
      })),
      jumpKeys: {},
    });
    const session = createSession();
    session.startEditor();
    session.editor?.open(document);
    session.editor?.getSnapshot().session?.selectArrangement('Repeated');
    render(
      <App
        session={session}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    const tile = within(
      screen.getByRole('listbox', {name: '슬라이드'}),
    ).getAllByRole('option')[2];
    if (!tile) throw new Error('Missing slide');
    fireEvent.contextMenu(tile);
    fireEvent.click(screen.getByRole('menuitem', {name: '곡 편집'}));
    await waitFor(() =>
      expect(
        session.editor?.getSnapshot().session?.history.snapshot.selection.block,
      ).toBe(2),
    );
    expect(session.editor?.getSnapshot().session?.document.song.id).toBe(
      document.song.id,
    );
    expect(session.editor?.getSnapshot().session?.arrangement).toBeUndefined();
    const lyrics = screen.getByRole('textbox', {name: '슬라이드 3 가사'});
    expect(
      lyrics.closest('[data-editor-block]')?.getAttribute('data-active'),
    ).toBe('true');
    expect(screen.getByRole('group', {name: '가사'}).scrollTop).toBeGreaterThan(
      0,
    );
    expect(session.items?.getSnapshot().item).toBeNull();
  });

  it('focuses and selects toolbar search from every workspace with Ctrl F', () => {
    const send = vi.fn();
    window.llp = mockLlpApi({live: {send}});
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    for (const code of ['KeyE', 'KeyS', 'Digit1']) {
      fireEvent.keyDown(window, {
        code,
        ctrlKey: true,
        altKey: code === 'Digit1',
      });
      fireEvent.keyDown(window, {code: 'KeyF', ctrlKey: true});
      const field = screen.getByRole('combobox', {name: '검색'});
      expect(document.activeElement).toBe(field);
      fireEvent.change(field, {target: {value: 'Invented'}});
      fireEvent.keyDown(field, {code: 'KeyF', ctrlKey: true});
      expect(field).toHaveProperty('selectionStart', 0);
      expect(field).toHaveProperty('selectionEnd', 8);
    }
    expect(send).not.toHaveBeenCalled();
  });
});

describe('App UI zoom', () => {
  it('updates the size class from the effective CSS viewport after zoom', () => {
    vi.stubGlobal('innerWidth', 1920);
    const {container} = render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    expect(container.firstElementChild?.getAttribute('data-size')).toBe(
      'normal',
    );

    vi.stubGlobal('innerWidth', 960);
    fireEvent.resize(window);

    expect(container.firstElementChild?.getAttribute('data-size')).toBe(
      'narrow',
    );
  });
});
