import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import {createServiceId, createServiceItemId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import userEvent from '@testing-library/user-event';
import {convertTextImport} from '../../../main/import/convert';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useLive} from '@renderer/state/live';
import {applyService} from '@renderer/state/show';
import {
  sampleService,
  seedSampleService,
} from '@renderer/show/testing/sampleService';
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
  const session = new ControlSession(window.llp);
  sessions.push(session);
  return session;
}

beforeEach(() => {
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
      screen.getByRole('menuitem', {name: '지금 예배를 틀로 저장'}),
    );
    expect(await screen.findByText('틀로 저장할 수 없음')).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
    expect(screen.queryByText('틀로 저장할 수 없음')).toBeNull();
  });

  it('opens text import from File and hands it to the unsaved song editor', async () => {
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
    await userEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    await userEvent.click(
      await screen.findByRole('menuitem', {name: '텍스트 파일'}),
    );
    await screen.findByText('슬라이드 1');
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(
      await screen.findByRole('textbox', {name: '곡 제목'}),
    ).toHaveProperty('value', 'Invented');
    expect(screen.getByRole('button', {name: '저장'})).toBeDefined();
    expect(session.editor?.getSnapshot().imported).toBe(true);
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '버리기'}));
    expect(session.editor?.getSnapshot().session).toBeNull();
  });
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
    expect(sent).toEqual([{type: 'layer.clear', target: 'slide'}]);
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
