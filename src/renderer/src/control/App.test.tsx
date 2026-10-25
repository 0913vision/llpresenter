import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
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
