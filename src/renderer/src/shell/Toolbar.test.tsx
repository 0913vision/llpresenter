import {act, cleanup, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {Toolbar} from './Toolbar';
import {renderWithScreenSummaries as render} from '@renderer/shell/testing/screenSummaries';
import {ScreenSummariesContext} from './ScreenSummaries';
import type {ScreenSummary} from './screens';

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
  vi.unstubAllGlobals();
});

const manyScreens: readonly ScreenSummary[] = Array.from(
  {length: 8},
  (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    icon: 'mplay',
    toolbarLabel: `아주 긴 검증용 화면 이름 ${index + 1}을 끝까지 확인합니다`,
    statusLabel: `아주 긴 검증용 화면 이름 ${index + 1}을 끝까지 확인합니다`,
    target: '창',
    targetKind: 'window',
    chroma: false,
  }),
);

describe('saved output overflow', () => {
  it('keeps three inline outputs at 1280 and exposes all additional long names with live toggles', async () => {
    vi.stubGlobal('innerWidth', 1280);
    const send = vi.fn();
    installApi(send);
    render(
      <ScreenSummariesContext value={manyScreens}>
        <Toolbar sizeClass="narrow" workspace="show" onWorkspace={vi.fn()} />
      </ScreenSummariesContext>,
    );
    const group = screen.getByRole('group', {name: '화면 출력'});
    const last = manyScreens[7];
    if (last === undefined) throw new Error('Missing fixture screen');
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    expect(
      within(group).queryByRole('button', {name: last.toolbarLabel}),
    ).toBeNull();
    await userEvent.click(
      within(group).getByRole('button', {name: '다른 화면'}),
    );
    const menu = screen.getByRole('menu', {name: '다른 화면 출력'});
    expect(
      within(menu)
        .getAllByRole('menuitemcheckbox')
        .map(item => item.textContent),
    ).toEqual(manyScreens.slice(3).map(item => item.statusLabel));
    await userEvent.click(
      within(menu).getByRole('menuitemcheckbox', {name: last.statusLabel}),
    );
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'output.set',
      screenId: last.id,
      on: true,
    });
    act(() =>
      useLive.setState({
        state: {...emptyLiveState(), outputs: {[last.id]: true}},
      }),
    );
    await userEvent.click(
      within(group).getByRole('button', {name: '다른 화면'}),
    );
    const checked = screen.getByRole('menuitemcheckbox', {
      name: last.statusLabel,
    });
    expect(checked.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(checked);
    expect(send).toHaveBeenLastCalledWith({
      type: 'output.set',
      screenId: last.id,
      on: false,
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('combobox', {name: '검색'})).toBeTruthy();
  });

  it('removes the open overflow when its last hidden choices disappear', async () => {
    const content = (screens: readonly ScreenSummary[]) => (
      <ScreenSummariesContext value={screens}>
        <Toolbar sizeClass="narrow" workspace="show" onWorkspace={vi.fn()} />
      </ScreenSummariesContext>
    );
    const view = render(content(manyScreens));
    await userEvent.click(screen.getByRole('button', {name: '다른 화면'}));
    expect(screen.getByRole('menu', {name: '다른 화면 출력'})).toBeTruthy();
    view.rerender(content(manyScreens.slice(0, 2)));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('button', {name: '다른 화면'})).toBeNull();
    expect(
      within(screen.getByRole('group', {name: '화면 출력'})).getAllByRole(
        'button',
      ),
    ).toHaveLength(2);
  });
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
  it.each([
    ['normal', 'show'],
    ['narrow', 'prep'],
  ] as const)(
    'keeps the %s media toggle separate from the %s workspace',
    async (sizeClass, workspace) => {
      const onWorkspace = vi.fn();
      const onMediaOpenChange = vi.fn();
      const {rerender} = render(
        <Toolbar
          sizeClass={sizeClass}
          workspace={workspace}
          onWorkspace={onWorkspace}
          mediaOpen={false}
          onMediaOpenChange={onMediaOpenChange}
        />,
      );
      const media = screen.getByRole('button', {name: '미디어'});
      expect(media.textContent).toBe('미디어');
      expect(
        screen.getByRole('tablist', {name: '작업 공간'}).contains(media),
      ).toBe(false);
      media.focus();
      await userEvent.keyboard('{Enter}');
      expect(onMediaOpenChange).toHaveBeenCalledExactlyOnceWith(true);
      rerender(
        <Toolbar
          sizeClass={sizeClass}
          workspace={workspace}
          onWorkspace={onWorkspace}
          mediaOpen
          onMediaOpenChange={onMediaOpenChange}
        />,
      );
      expect(media.getAttribute('aria-pressed')).toBe('true');
      await userEvent.keyboard(' ');
      expect(onMediaOpenChange.mock.calls).toEqual([[true], [false]]);
      expect(onWorkspace).not.toHaveBeenCalled();
      expect((await hoverForTooltip(media))?.textContent).toBe('미디어 닫기');
    },
  );

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
      screen.getByRole('button', {name: 'Look'}).getAttribute('aria-haspopup'),
    ).toBe('menu');
  });

  it('says what an output click does in its tooltip', async () => {
    render(
      <Toolbar sizeClass="normal" workspace="show" onWorkspace={() => {}} />,
    );
    const stage = screen.getByRole('button', {name: '무대'});
    expect((await hoverForTooltip(stage))?.textContent).toBe(
      '무대 화면 출력 켜기 (창)',
    );
  });
});
