import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {Toolbar} from './Toolbar';

function installApi(send: (command: LiveCommand) => void): void {
  window.llp = fakeLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send,
      subscribe: () => () => undefined,
    },
  });
}

afterEach(() => {
  resetTooltips();
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
});

describe('Toolbar', () => {
  it('marks the current workspace tab and reports clicks on the others', async () => {
    const onWorkspace = vi.fn();
    render(
      <Toolbar sizeClass="normal" workspace="show" onWorkspace={onWorkspace} />,
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
      <Toolbar sizeClass="normal" workspace="show" onWorkspace={() => {}} />,
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
      <Toolbar sizeClass="narrow" workspace="show" onWorkspace={() => {}} />,
    );
    const main = screen.getByRole('button', {name: '본 화면'});
    expect(main.getAttribute('aria-pressed')).toBe('true');
    expect(main.getAttribute('data-state')).toBe('live');
  });
});

describe('Toolbar design system parts', () => {
  it('has the search field with its placeholder and name, and no toolbar role', () => {
    render(
      <Toolbar sizeClass="normal" workspace="show" onWorkspace={() => {}} />,
    );
    const search = screen.getByPlaceholderText('곡, 가사, 초성');
    expect(search.getAttribute('aria-label')).toBe('검색');
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('groups the workspace tabs and the screen outputs by name', () => {
    render(
      <Toolbar sizeClass="normal" workspace="show" onWorkspace={() => {}} />,
    );
    expect(screen.getByRole('tablist', {name: '작업 공간'})).toBeTruthy();
    const outputs = screen.getByRole('group', {name: '화면 출력'});
    expect(within(outputs).getAllByRole('button')).toHaveLength(3);
  });

  it.each(['normal', 'narrow'] as const)(
    'uses no native title tooltip in the %s form',
    sizeClass => {
      render(
        <Toolbar
          sizeClass={sizeClass}
          workspace="show"
          onWorkspace={() => {}}
        />,
      );
      expect(document.querySelectorAll('[title]')).toHaveLength(0);
    },
  );

  it('keeps the media button named in the narrow form and marks the Look menu', () => {
    render(
      <Toolbar sizeClass="narrow" workspace="show" onWorkspace={() => {}} />,
    );
    expect(screen.getByRole('button', {name: '미디어'})).toBeTruthy();
    expect(
      screen
        .getByRole('button', {name: '평상시'})
        .getAttribute('aria-haspopup'),
    ).toBe('menu');
  });

  it('says what an output click does in its tooltip', async () => {
    render(
      <Toolbar sizeClass="normal" workspace="show" onWorkspace={() => {}} />,
    );
    const stage = screen.getByRole('button', {name: '무대'});
    expect((await hoverForTooltip(stage))?.textContent).toBe(
      '무대 화면 출력 켜기 (모니터 3)',
    );
  });
});
