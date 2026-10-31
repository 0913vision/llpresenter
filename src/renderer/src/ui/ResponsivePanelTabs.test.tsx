import {useState} from 'react';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it} from 'vitest';
import {Panel, PanelHeader, PanelBody} from './Panel';
import {ResponsivePanelTabs} from './ResponsivePanelTabs';
import {mockPanelTabWidths} from './responsiveTabTesting';

afterEach(cleanup);

const tabs = [
  {value: 'showing', label: '표시 중', count: 2},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
  {value: 'macro', label: '매크로'},
];

function Fixture() {
  const [value, setValue] = useState('showing');
  return (
    <Panel label="진행 도구">
      <PanelHeader>
        <ResponsivePanelTabs
          tabs={tabs}
          value={value}
          onChange={setValue}
          moreLabel="더 보기"
        />
      </PanelHeader>
      <PanelBody tab={value}>{value}</PanelBody>
    </Panel>
  );
}

const visible = () => screen.getAllByRole('tab').map(tab => tab.textContent);

it('fits tabs on resize and promotes the selected overflow tab to the last slot', async () => {
  const widths = mockPanelTabWidths(1000);
  render(<Fixture />);
  expect(visible()).toEqual(['표시 중2', '오디오', '무대', '매크로']);
  expect(screen.queryByRole('button', {name: '더 보기'})).toBeNull();
  widths.resize(180);
  expect(visible()).toEqual(['표시 중2', '오디오']);
  await userEvent.click(screen.getByRole('button', {name: '더 보기'}));
  const menu = screen.getByRole('menu', {name: '더 보기'});
  expect(
    within(menu)
      .getAllByRole('menuitemradio')
      .map(row => row.textContent),
  ).toEqual(['무대', '매크로']);
  await userEvent.click(
    within(menu).getByRole('menuitemradio', {name: '매크로'}),
  );
  expect(visible()).toEqual(['표시 중2', '매크로']);
  expect(
    screen.getByRole('tab', {name: '매크로'}).getAttribute('aria-selected'),
  ).toBe('true');
  expect(screen.getByRole('tabpanel', {name: '매크로'})).toBeDefined();
  widths.resize(120);
  expect(visible()).toEqual(['매크로']);
  widths.resize(1000);
  expect(visible()).toEqual(['표시 중2', '오디오', '무대', '매크로']);
  expect(screen.queryByRole('button', {name: '더 보기'})).toBeNull();
});

it('keeps measurements outside keyboard navigation and releases the observer', () => {
  const widths = mockPanelTabWidths(1000);
  const view = render(<Fixture />);
  expect(widths.active()).toBe(1);
  expect(screen.getAllByRole('tab', {hidden: true})).toHaveLength(4);
  const ids = Array.from(
    view.container.querySelectorAll('[id]'),
    item => item.id,
  );
  expect(new Set(ids).size).toBe(ids.length);
  const measured = view.container.querySelector('[inert]');
  expect(measured?.getAttribute('aria-hidden')).toBe('true');
  expect(measured?.querySelector('[tabindex]')).toBeNull();
  view.unmount();
  expect(widths.active()).toBe(0);
  expect(widths.disconnect).toHaveBeenCalledOnce();
});
