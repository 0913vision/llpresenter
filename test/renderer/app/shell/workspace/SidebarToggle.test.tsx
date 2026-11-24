import {cleanup, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import type {UiState} from '@core/schema/app/uiState';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import type {SizeClass} from '@renderer/ui/panels/sizeClass';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columns/columnWidthStore';
import {useSidebarCollapse} from '@renderer/app/shell/workspace/useSidebarCollapse';
import {Workspace} from '@renderer/app/shell/workspace/Workspace';
import * as showState from '@renderer/session/show/show';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    ready = () => true;
    revealIncomplete = () => undefined;
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
  id = 'show',
  sizeClass,
  layout,
  api,
}: {
  readonly id?: 'show' | 'prep';
  readonly sizeClass: SizeClass;
  readonly layout?: UiState['layout'];
  readonly api: Pick<LlpApi, 'ui' | 'log'>;
}): JSX.Element {
  const sidebar = useSidebarCollapse(sizeClass, layout, api);
  return (
    <Workspace
      id={id}
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

it('returns to live keys when the already-focused sidebar toggle is clicked', async () => {
  const {api} = mockUiApi();
  const next = vi
    .spyOn(showState, 'outputNext')
    .mockImplementation(() => undefined);
  render(<Harness sizeClass="narrow" api={api} />);
  const toggle = screen.getByRole('button', {name: COLLAPSE});
  toggle.focus();
  await userEvent.click(toggle);
  const grid = screen.getByRole('listbox', {name: '슬라이드'});
  expect(document.activeElement).toBe(grid);
  await userEvent.keyboard(' ');
  expect(next).toHaveBeenCalledTimes(1);
  expect(expandButton()).not.toBeNull();
});

it('keeps the 준비 left column while 진행 has it collapsed', () => {
  const {api} = mockUiApi();
  const layout = {narrow: {leftCollapsed: true}};
  const view = render(
    <Harness id="prep" sizeClass="narrow" layout={layout} api={api} />,
  );
  expect(serviceOrder()).not.toBeNull();
  expect(collapseButton()).toBeNull();

  view.rerender(<Harness sizeClass="narrow" layout={layout} api={api} />);

  expect(serviceOrder()).toBeNull();
});
