import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useLive} from '@renderer/state/live';
import {applyService} from '@renderer/state/show';
import {
  sampleService,
  seedSampleService,
} from '@renderer/show/testing/sampleService';
import {App} from './App';

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

beforeEach(() => {
  applyService(null);
});

afterEach(() => {
  cleanup();
  applyService(null);
  useLive.setState({state: null});
  delete window.llp;
});

describe('App menu bar title', () => {
  it('shows the name of the open service and follows a change of it', () => {
    seedSampleService();
    render(<App columnWidthStore={createMemoryColumnWidthStore()} />);
    expect(titleOfMenuBar()).toBe('주일 예배');
    act(() => applyService({...sampleService, revision: 2, name: '수요 예배'}));
    expect(titleOfMenuBar()).toBe('수요 예배');
  });

  it('shows no name while no service is open', () => {
    render(<App columnWidthStore={createMemoryColumnWidthStore()} />);
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
    render(<App columnWidthStore={createMemoryColumnWidthStore()} />);
    fireEvent.keyDown(document.body, {code: 'KeyZ', ctrlKey: true});
    expect(sent).toEqual([]);
    fireEvent.keyDown(document.body, {code: 'F2'});
    expect(sent).toEqual([{type: 'layer.clear', target: 'slide'}]);
  });
});
