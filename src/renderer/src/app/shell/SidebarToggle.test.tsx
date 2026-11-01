import {cleanup, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import type {UiState} from '@core/schema/uiState';
import {seedSampleService} from '@renderer/session/testing/sampleService';
import type {SizeClass} from '../../ui/sizeClass';
import {renderWithScreenSummaries as render} from '../../platform/testing/screenSummaries';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {useSidebarCollapse} from './useSidebarCollapse';
import {Workspace} from './Workspace';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const COLLAPSE = '사이드바 접기';
const EXPAND = '사이드바 펼치기';

function mockUiApi() {
  const api = mockLlpApi();
  const setLayout = vi.spyOn(api.ui, 'setLayout');
  return {api, setLayout};
}

function Harness({
  sizeClass,
  layout,
  api,
}: {
  readonly sizeClass: SizeClass;
  readonly layout?: UiState['layout'];
  readonly api: Pick<LlpApi, 'ui' | 'log'>;
}): JSX.Element {
  const sidebar = useSidebarCollapse(sizeClass, layout, api);
  return (
    <Workspace
      id="show"
      sizeClass={sizeClass}
      store={createMemoryColumnWidthStore()}
      sidebar={sidebar}
    />
  );
}

const serviceOrder = () => screen.queryByRole('region', {name: '예배 순서'});
const collapseButton = () => screen.queryByRole('button', {name: COLLAPSE});
const expandButton = () => screen.queryByRole('button', {name: EXPAND});

beforeEach(() => {
  seedSampleService();
});

afterEach(cleanup);

it('collapses and expands the left column and saves each choice for narrow windows', async () => {
  const {api, setLayout} = mockUiApi();
  render(<Harness sizeClass="narrow" api={api} />);
  await userEvent.click(screen.getByRole('button', {name: COLLAPSE}));
  expect(serviceOrder()).toBeNull();
  expect(setLayout).toHaveBeenLastCalledWith({
    sizeClass: 'narrow',
    leftCollapsed: true,
  });
  await userEvent.click(screen.getByRole('button', {name: EXPAND}));
  expect(serviceOrder()).not.toBeNull();
  expect(setLayout).toHaveBeenLastCalledWith({
    sizeClass: 'narrow',
    leftCollapsed: false,
  });
  expect(setLayout).toHaveBeenCalledTimes(2);
});

it('starts collapsed from a saved narrow choice without saving it again', () => {
  const {api, setLayout} = mockUiApi();
  render(
    <Harness
      sizeClass="narrow"
      layout={{narrow: {leftCollapsed: true}}}
      api={api}
    />,
  );
  expect(serviceOrder()).toBeNull();
  expect(expandButton()).not.toBeNull();
  expect(setLayout).not.toHaveBeenCalled();
});

it.each(['normal', 'wide'] as const)(
  'keeps the left column without 사이드바 접기 at the %s size',
  sizeClass => {
    const {api} = mockUiApi();
    render(
      <Harness
        sizeClass={sizeClass}
        layout={{narrow: {leftCollapsed: true}, normal: {leftCollapsed: true}}}
        api={api}
      />,
    );
    expect(serviceOrder()).not.toBeNull();
    expect(collapseButton()).toBeNull();
    expect(expandButton()).toBeNull();
  },
);

it('hands the keyboard focus to the other sidebar button', async () => {
  const {api} = mockUiApi();
  render(<Harness sizeClass="narrow" api={api} />);
  collapseButton()?.focus();
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(expandButton());
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(collapseButton());
});

it('leaves the focus alone when it was outside the left column', async () => {
  const {api} = mockUiApi();
  render(<Harness sizeClass="narrow" api={api} />);
  const tabs = screen.getAllByRole('tab');
  const outside = tabs[0];
  outside?.focus();
  await userEvent.click(screen.getByRole('button', {name: COLLAPSE}));
  expect(document.activeElement).toBe(outside);
});
