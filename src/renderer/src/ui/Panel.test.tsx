import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSwitch,
  PanelTabs,
  PanelTitle,
  type PanelTab,
} from './Panel';
import {TruncatedText} from './TruncatedText';
import {pointAway, hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

type Tool = 'showing' | 'audio' | 'stage';

const tools: ReadonlyArray<PanelTab<Tool>> = [
  {value: 'showing', label: '표시 중', count: 3},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
];

function ShowTools(): JSX.Element {
  const [tool, setTool] = useState<Tool>('showing');
  return (
    <Panel label="진행 도구">
      <PanelHeader>
        <PanelTabs tabs={tools} value={tool} onChange={setTool} />
      </PanelHeader>
      <PanelBody variant="list" tab={tool}>
        <span>{tool}</span>
      </PanelBody>
    </Panel>
  );
}

function selectedTab(): string | null {
  return screen.getByRole('tab', {selected: true}).textContent;
}

describe('Panel', () => {
  it('is a section named by its label', () => {
    render(<ShowTools />);
    expect(screen.getByRole('region', {name: '진행 도구'})).toBeDefined();
  });

  it('names a tab with its count and labels the body by the selected tab', () => {
    render(<ShowTools />);
    const showing = screen.getByRole('tab', {name: '표시 중 3개'});
    expect(showing.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel', {name: '표시 중 3개'})).toBeDefined();
  });

  it('selects tabs on click and with the arrow keys', async () => {
    render(<ShowTools />);
    await userEvent.click(screen.getByRole('tab', {name: '오디오'}));
    expect(selectedTab()).toBe('오디오');
    expect(screen.getByRole('tabpanel', {name: '오디오'})).toBeDefined();
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedTab()).toBe('무대');
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedTab()).toBe('표시 중3');
  });

  it('stops Tab only on the selected tab', async () => {
    render(<ShowTools />);
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true');
    await userEvent.tab();
    expect(document.activeElement?.getAttribute('role')).not.toBe('tab');
  });
});

type NarrowTool = 'showing' | 'stage' | 'audio' | 'message';

function NarrowTools({
  more = [
    {value: 'audio', label: '오디오'},
    {value: 'message', label: '메시지', disabled: true, title: '메시지 없음'},
  ],
}: {
  readonly more?: ReadonlyArray<PanelTab<NarrowTool>>;
}): JSX.Element {
  const [tool, setTool] = useState<NarrowTool>('showing');
  return (
    <Panel label="진행 도구">
      <PanelHeader>
        <PanelTabs
          tabs={[
            {value: 'showing', label: '표시 중'},
            {value: 'stage', label: '무대'},
          ]}
          value={tool}
          onChange={setTool}
          more={{label: '더 보기', tabs: more}}
        />
      </PanelHeader>
      <PanelBody variant="flush" tab={tool}>
        <span>{tool}</span>
      </PanelBody>
    </Panel>
  );
}

describe('PanelTabs with a 더 보기 group', () => {
  it('leaves modified Space to its owner without opening 더 보기', () => {
    render(<NarrowTools />);
    const more = screen.getByRole('button', {name: '더 보기'});
    const key = new KeyboardEvent('keydown', {
      key: ' ',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(more, key);
    expect(key.defaultPrevented).toBe(false);
    fireEvent.keyUp(more, {key: ' '});
    fireEvent.click(more, {detail: 0});
    expect(more.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the rest of the tabs as a menu from a button after the tabs', async () => {
    Element.prototype.scrollIntoView = () => undefined;
    render(<NarrowTools />);
    const more = screen.getByRole('button', {name: '더 보기'});
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    expect(screen.getByRole('tablist').contains(more)).toBe(false);
    more.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(
      screen
        .getByRole('menuitemradio', {name: '메시지'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('menuitemradio', {name: '오디오'}));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.queryByRole('tab', {selected: true})).toBeNull();
    expect(more.hasAttribute('data-active')).toBe(true);
    await userEvent.click(more);
    expect(
      screen
        .getByRole('menuitemradio', {name: '오디오'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('tab', {name: '무대'}));
    expect(selectedTab()).toBe('무대');
    expect(more.hasAttribute('data-active')).toBe(false);
  });

  it('names the body after a tab chosen from 더 보기', async () => {
    Element.prototype.scrollIntoView = () => undefined;
    render(<NarrowTools />);
    expect(screen.getByRole('tabpanel', {name: '표시 중'})).toBeDefined();
    await userEvent.click(screen.getByRole('button', {name: '더 보기'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '오디오'}));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('tabpanel', {name: '오디오'}).textContent).toBe(
      'audio',
    );
  });

  it('draws no button when no tab is left over', () => {
    render(<NarrowTools more={[]} />);
    expect(screen.queryByRole('button', {name: '더 보기'})).toBeNull();
  });
});

function Switcher({
  onExpandedChange = () => {},
  disabled = false,
}: {
  readonly onExpandedChange?: (expanded: boolean) => void;
  readonly disabled?: boolean;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  return (
    <PanelSwitch
      value="주일 예배"
      expanded={expanded}
      disabled={disabled}
      onExpandedChange={next => {
        setExpanded(next);
        onExpandedChange(next);
      }}
    />
  );
}

describe('PanelSwitch', () => {
  it('opens the service list on click and with the down arrow', async () => {
    const onExpandedChange = vi.fn();
    render(<Switcher onExpandedChange={onExpandedChange} />);
    const button = screen.getByRole('button', {name: '주일 예배'});
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    await userEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(button);
    await userEvent.keyboard('{ArrowDown}');
    expect(onExpandedChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('ignores presses while disabled', async () => {
    const onExpandedChange = vi.fn();
    render(<Switcher onExpandedChange={onExpandedChange} disabled />);
    await userEvent.click(screen.getByRole('button', {name: '주일 예배'}));
    await userEvent.keyboard('{ArrowDown}');
    expect(onExpandedChange).not.toHaveBeenCalled();
  });
});

describe('PanelTitle and PanelFooter', () => {
  it('shows a title with its position, actions, and footer parts', () => {
    render(
      <Panel label="슬라이드">
        <PanelHeader>
          <PanelTitle title="만복의 근원 하나님" meta="2 / 9" />
          <PanelActions>
            <button type="button">배경</button>
          </PanelActions>
        </PanelHeader>
        <PanelBody>
          <span>슬라이드 목록</span>
        </PanelBody>
        <PanelFooter end={<span>크기</span>}>슬라이드 9개</PanelFooter>
      </Panel>,
    );
    expect(screen.getByText('만복의 근원 하나님')).toBeDefined();
    expect(screen.getByText('2 / 9')).toBeDefined();
    expect(screen.getByText('슬라이드 9개')).toBeDefined();
    expect(screen.getByText('크기')).toBeDefined();
  });
});

describe('TruncatedText', () => {
  function stubWidths(scrollWidth: number, clientWidth: number): () => void {
    const scroll = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(scrollWidth);
    const client = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(clientWidth);
    return () => {
      scroll.mockRestore();
      client.mockRestore();
    };
  }

  it('shows the full text in a tooltip only when it is cut off', async () => {
    render(<TruncatedText text="주 하나님 지으신 모든 세계" />);
    const text = screen.getByText('주 하나님 지으신 모든 세계');

    const restoreFits = stubWidths(100, 100);
    expect(await hoverForTooltip(text)).toBeNull();
    pointAway(text);
    restoreFits();

    const restoreCut = stubWidths(300, 100);
    const tooltip = await hoverForTooltip(text);
    restoreCut();
    expect(tooltip?.textContent).toBe('주 하나님 지으신 모든 세계');
  });
});
