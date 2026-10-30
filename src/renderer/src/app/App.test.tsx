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
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {createServiceId, createServiceItemId} from '@core/schema/ids';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {settingsDocument} from '@renderer/screens/testing/documents';
import userEvent from '@testing-library/user-event';
import {convertTextImport} from '../../../main/import/convert';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/platform/live';
import {
  applyService,
  openItem,
  useShow,
} from '@renderer/features/presentation/state/show';
import {openLibrarySong} from '@renderer/features/presentation/state/showLibrary';
import {fixtureSong} from '@renderer/features/songs/library/fixture';
import {
  sampleService,
  seedSampleService,
} from '@renderer/features/presentation/testing/sampleService';
import {App} from './App';
import {ControlSession} from './controlSession';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

function titleOfMenuBar(): string {
  const bar = screen.getByRole('menubar', {name: '메뉴'}).parentElement;
  const title = bar?.children[2];
  return title?.textContent ?? '';
}

const sessions: ControlSession[] = [];

function createSession(): ControlSession {
  const api = window.llp;
  if (api !== undefined) {
    const get = api.settings.get;
    vi.spyOn(api.settings, 'get').mockImplementation(request =>
      request.name === 'screens'
        ? Promise.resolve(settingsDocument('screens', {screens: []}))
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

describe('App menu bar title', () => {
  it('opens the clicked service slide in prep at its arrangement position', () => {
    window.llp = fakeLlpApi();
    seedSampleService();
    openItem('song-morning');
    const session = createSession();
    session.startEditor();
    const items = session.items;
    if (!items) throw new Error('Missing item store');
    const show = vi.spyOn(items, 'show');
    const select = vi.spyOn(items, 'selectPosition');
    render(
      <App
        session={session}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    const grid = screen.getByRole('listbox', {name: '슬라이드'});
    const tile = within(grid).getAllByRole('option')[2];
    if (!tile) throw new Error('Missing slide');
    fireEvent.contextMenu(tile);
    fireEvent.click(screen.getByRole('menuitem', {name: '슬라이드 편집'}));
    expect(
      screen.getByRole('tab', {name: '준비'}).getAttribute('aria-selected'),
    ).toBe('true');
    expect(show).toHaveBeenCalledWith({
      serviceId: 'sample',
      itemId: 'song-morning',
    });
    expect(select).toHaveBeenCalledWith(2);
    expect(items.getSnapshot().position).toBe(2);
    expect(useShow.getState().openItemId).toBe('song-morning');
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
    window.llp = fakeLlpApi({
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
    fireEvent.click(screen.getByRole('menuitem', {name: '슬라이드 편집'}));
    await waitFor(() =>
      expect(
        session.editor?.getSnapshot().session?.history.snapshot.selection.block,
      ).toBe(2),
    );
    expect(session.editor?.getSnapshot().session?.document.song.id).toBe(
      document.song.id,
    );
    expect(session.editor?.getSnapshot().session?.arrangement).toBeUndefined();
    expect(session.items?.getSnapshot().item).toBeNull();
  });

  it('focuses and selects toolbar search from every workspace with Ctrl F', () => {
    const send = vi.fn();
    window.llp = fakeLlpApi({live: {send}});
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

  it.each([false, true])(
    'routes Ctrl Shift I without changing media visibility %s and suppresses held repeats',
    async mediaOpen => {
      const read = vi.fn(async () => ({
        ok: true as const,
        value: {
          source: 'file' as const,
          fileName: 'Invented.txt',
          text: 'Invented line',
        },
      }));
      window.llp = fakeLlpApi({
        textImport: {
          read,
          preview: async request => convertTextImport(request),
        },
      });
      render(
        <App
          session={createSession()}
          columnWidthStore={createMemoryColumnWidthStore()}
          uiState={{mediaStrip: mediaOpen}}
        />,
      );
      fireEvent.keyDown(window, {code: 'KeyI', ctrlKey: true, shiftKey: true});
      fireEvent.keyDown(window, {
        code: 'KeyI',
        ctrlKey: true,
        shiftKey: true,
        repeat: true,
      });
      await screen.findByText('슬라이드 1', undefined, {timeout: 5000});
      expect(read).toHaveBeenCalledExactlyOnceWith({
        source: 'file',
        encoding: 'auto',
      });
      expect(
        screen.getByRole('tab', {name: '준비'}).getAttribute('aria-selected'),
      ).toBe('true');
      expect(
        screen
          .getByRole('button', {name: '미디어'})
          .getAttribute('aria-pressed'),
      ).toBe(String(mediaOpen));
    },
  );

  it('opens existing workspaces by S1 keys and View menu without sending live commands', async () => {
    const send = vi.fn();
    window.llp = fakeLlpApi({live: {send}});
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    fireEvent.keyDown(window, {code: 'KeyR', ctrlKey: true});
    expect(
      screen.getByRole('tab', {name: '준비'}).getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.keyDown(window, {code: 'Digit1', ctrlKey: true, altKey: true});
    expect(
      screen
        .getByRole('tab', {name: '화면 설정'})
        .getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.keyDown(window, {code: 'KeyS', ctrlKey: true});
    expect(
      screen.getByRole('tab', {name: '진행'}).getAttribute('aria-selected'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('menuitem', {name: '보기'}));
    expect(screen.getByRole('menuitem', {name: /준비Ctrl R/})).toBeDefined();
    await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
    await userEvent.click(
      screen.getByRole('menuitem', {name: /화면 설정…Ctrl Alt 1/}),
    );
    expect(
      screen
        .getByRole('tab', {name: '화면 설정'})
        .getAttribute('aria-selected'),
    ).toBe('true');
    fireEvent.keyDown(window, {code: 'KeyV', ctrlKey: true, shiftKey: true});
    expect(
      screen.getByRole('tab', {name: '진행'}).getAttribute('aria-selected'),
    ).toBe('true');
    expect(send).not.toHaveBeenCalled();
  });

  it('routes a failed File-menu action to the shared notification stack', async () => {
    window.llp = fakeLlpApi();
    applyService({
      ...sampleService,
      id: createServiceId('00000000-0000-4000-8000-000000000001'),
    });
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    fireEvent.click(
      screen.getByRole('menuitem', {name: '예배를 템플릿으로 저장…'}),
    );
    expect(await screen.findByText('템플릿으로 저장할 수 없음')).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
    expect(screen.queryByText('템플릿으로 저장할 수 없음')).toBeNull();
  });

  it.each([false, true])(
    'opens text import and reveals its unsaved editor with media view initially %s',
    async mediaOpen => {
      const edit = vi.fn();
      window.llp = fakeLlpApi({
        content: {edit},
        textImport: {
          read: async () => ({
            ok: true,
            value: {
              source: 'file',
              fileName: 'Invented.txt',
              text: 'Invented line',
            },
          }),
          preview: async request => convertTextImport(request),
        },
      });
      const session = createSession();
      render(
        <App
          columnWidthStore={createMemoryColumnWidthStore()}
          session={session}
        />,
      );
      if (mediaOpen) {
        fireEvent.click(screen.getByRole('tab', {name: '준비'}));
        fireEvent.click(screen.getByRole('button', {name: '미디어'}));
        expect(
          screen
            .getByRole('button', {name: '미디어'})
            .getAttribute('aria-pressed'),
        ).toBe('true');
      }
      await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
      await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
      await userEvent.click(
        await screen.findByRole('menuitem', {name: /^텍스트 파일/}),
      );
      await screen.findByText('슬라이드 1');
      fireEvent.click(screen.getByRole('button', {name: '편집'}));
      expect(
        await screen.findByRole('textbox', {name: '곡 제목'}),
      ).toHaveProperty('value', 'Invented');
      expect(screen.getByRole('button', {name: '저장'})).toBeDefined();
      expect(
        screen
          .getByRole('button', {name: '미디어'})
          .getAttribute('aria-pressed'),
      ).toBe(String(mediaOpen));
      expect(session.editor?.getSnapshot().imported).toBe(true);
      expect(edit).not.toHaveBeenCalled();
      if (mediaOpen) {
        await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
        await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
        await userEvent.click(
          await screen.findByRole('menuitem', {name: /^텍스트 파일/}),
        );
        expect(await screen.findByRole('alertdialog')).toHaveProperty(
          'textContent',
          expect.stringContaining('가져온 곡을 저장하지 않았습니다. 버릴까요?'),
        );
        fireEvent.click(screen.getByRole('button', {name: '취소'}));
        expect(session.editor?.getSnapshot().imported).toBe(true);
        expect(screen.getByRole('button', {name: '저장'})).toBeDefined();
      }
      fireEvent.click(screen.getByRole('button', {name: '버리기'}));
      expect(session.editor?.getSnapshot().session).toBeNull();
      expect(
        screen
          .getByRole('button', {name: '미디어'})
          .getAttribute('aria-pressed'),
      ).toBe(String(mediaOpen));
    },
  );
  it('hosts and closes service edit warnings in the shared notice stack', async () => {
    window.llp = fakeLlpApi();
    applyService({
      ...sampleService,
      id: createServiceId('00000000-0000-4000-8000-000000000001'),
      rows: [
        {
          kind: 'song',
          title: 'Invented row',
          id: createServiceItemId('10000000-0000-4000-8000-000000000001'),
        },
      ],
    });
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    fireEvent.contextMenu(screen.getByRole('option', {name: 'Invented row'}));
    fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    expect(await screen.findByText('예배 순서 변경 실패')).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
    expect(screen.queryByText('예배 순서 변경 실패')).toBeNull();
    expect(screen.getByRole('option', {name: 'Invented row'})).toBeDefined();
  });

  it('shows the name of the open service and follows a change of it', () => {
    seedSampleService();
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    expect(titleOfMenuBar()).toBe('주일 예배');
    act(() => applyService({...sampleService, revision: 2, name: '수요 예배'}));
    expect(titleOfMenuBar()).toBe('수요 예배');
  });

  it('shows no name while no service is open', () => {
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    expect(titleOfMenuBar()).toBe('');
    expect(screen.queryByText('LoveLight Presenter')).toBeNull();
  });
});

describe('App clear keys', () => {
  it('clears with F2 in 진행 but never undoes a clear with Ctrl Z', () => {
    const sent: LiveCommand[] = [];
    window.llp = fakeLlpApi({live: {send: command => sent.push(command)}});
    const base = emptyLiveState();
    useLive.setState({
      state: {
        ...base,
        canUndo: true,
        layers: {
          ...base.layers,
          slide: {itemId: 'song', position: 0, label: null, lines: ['x']},
        },
      },
    });
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    fireEvent.keyDown(document.body, {code: 'KeyZ', ctrlKey: true});
    expect(sent).toEqual([]);
    fireEvent.keyDown(document.body, {code: 'F2'});
    expect(sent).toEqual([{type: 'layer.clear.toggle', target: 'slide'}]);
  });
});

describe('App UI zoom', () => {
  it('keeps zoom active in all workspaces without dispatching a live command', () => {
    const changeZoom = vi.fn(() => Promise.resolve(100));
    const send = vi.fn();
    window.llp = fakeLlpApi({ui: {changeZoom}, live: {send}});
    render(
      <App
        session={createSession()}
        columnWidthStore={createMemoryColumnWidthStore()}
      />,
    );
    for (const workspace of ['진행', '준비', '화면 설정']) {
      fireEvent.click(screen.getByRole('tab', {name: workspace}));
      fireEvent.keyDown(document.body, {code: 'Equal', ctrlKey: true});
      fireEvent.keyDown(document.body, {code: 'Minus', ctrlKey: true});
      fireEvent.keyDown(document.body, {code: 'Digit0', ctrlKey: true});
    }
    expect(changeZoom.mock.calls).toEqual(
      Array.from({length: 3}, () => [
        [{type: 'ui.zoomIn'}],
        [{type: 'ui.zoomOut'}],
        [{type: 'ui.zoomReset'}],
      ]).flat(),
    );
    expect(send).not.toHaveBeenCalled();
  });

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
