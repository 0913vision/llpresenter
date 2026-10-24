import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import type {LlpApi} from '@shared/ipc';
import {useLive} from '@renderer/state/live';
import {Toolbar} from './Toolbar';

function installApi(send: (command: LiveCommand) => void): void {
  const api: LlpApi = {
    live: {
      get: async () => emptyLiveState(),
      send,
      subscribe: () => () => undefined,
    },
    window: {control: () => undefined},
  };
  window.llp = api;
}

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
});

describe('Toolbar', () => {
  it('marks the current workspace tab and reports clicks on the others', async () => {
    const onWorkspace = vi.fn();
    render(
      <Toolbar
        sizeClass="regular"
        workspace="show"
        onWorkspace={onWorkspace}
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(tab => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    await userEvent.click(screen.getByRole('tab', {name: '준비'}));
    expect(onWorkspace).toHaveBeenCalledWith('prep');
  });

  it('turns an output on through the live command channel', async () => {
    const send = vi.fn();
    installApi(send);
    render(
      <Toolbar sizeClass="regular" workspace="show" onWorkspace={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', {name: '무대'}));
    expect(send).toHaveBeenCalledWith({
      type: 'output.set',
      screenId: 'stage',
      on: true,
    });
  });

  it('shows an output as on when the live state says so', () => {
    useLive.setState({
      state: {...emptyLiveState(), outputs: {main: true}},
    });
    render(
      <Toolbar sizeClass="compact" workspace="show" onWorkspace={() => {}} />,
    );
    const main = screen.getByRole('button', {name: '본 화면'});
    expect(main.getAttribute('aria-pressed')).toBe('true');
    expect(main.getAttribute('data-state')).toBe('live');
  });
});
