import {act, cleanup, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {
  APP_PROBLEM_LIMITS,
  fileSkippedProblem,
  macroDroppedProblem,
  saveFailedProblem,
  type AppProblem,
} from '@core/schema/appProblem';
import {parseMacroId} from '@core/schema/ids';
import {expectSuccess} from '@core/schema/testHelpers';
import {editorFixture} from '@renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/platform/live';
import {applyService} from '@renderer/features/presentation/state/show';
import {App} from '../App';
import {ControlSession} from '../controlSession';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];
const MACRO_ID = expectSuccess(
  parseMacroId('c63a2e74-9a31-4c4d-8e5f-607182930415'),
);

function setup(
  listed: readonly AppProblem[] | Promise<readonly AppProblem[]> = [],
) {
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 1080);
  const {api} = editorFixture();
  let push: (problem: AppProblem) => void = () => undefined;
  const stop = vi.fn();
  vi.spyOn(api.problems, 'list').mockImplementation(() =>
    Promise.resolve(listed),
  );
  const retrySaves = vi.spyOn(api.problems, 'retrySaves');
  vi.spyOn(api.problems, 'subscribe').mockImplementation(listener => {
    push = listener;
    return stop;
  });
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  const view = render(
    <App session={session} columnWidthStore={createMemoryColumnWidthStore()} />,
  );
  return {
    push: (problem: AppProblem): void => {
      act(() => push(problem));
    },
    stop,
    retrySaves,
    view,
  };
}

function skippedCard() {
  return screen.getByRole('alert', {name: '파일을 읽을 수 없음'});
}

beforeEach(() => {
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it('shows the files skipped before the window loaded as one card', async () => {
  setup([
    fileSkippedProblem(1, 'D:/data/settings/looks.json'),
    fileSkippedProblem(2, 'D:/data/Songs/a1.llsong'),
  ]);
  const card = await screen.findByRole('alert', {name: '파일을 읽을 수 없음'});
  expect(within(card).getByText('looks.json 외 1개')).toBeDefined();
  expect(within(card).getByText('건너뜀')).toBeDefined();
});

it('counts a file that arrives by push and by the list only once', async () => {
  const {push} = setup([fileSkippedProblem(1, 'D:/data/settings/looks.json')]);
  await screen.findByRole('alert', {name: '파일을 읽을 수 없음'});
  push(fileSkippedProblem(1, 'D:/data/settings/looks.json'));
  expect(within(skippedCard()).getByText('looks.json')).toBeDefined();
  push(fileSkippedProblem(2, 'D:/data/Songs/a1.llsong'));
  expect(within(skippedCard()).getByText('looks.json 외 1개')).toBeDefined();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});

it('counts at most the listed limit of skipped files', () => {
  const {push} = setup();
  for (let index = 0; index < APP_PROBLEM_LIMITS.listed + 5; index += 1) {
    push(fileSkippedProblem(index + 1, `D:/data/Songs/${index}.llsong`));
  }
  expect(
    within(skippedCard()).getByText(
      `0.llsong 외 ${APP_PROBLEM_LIMITS.listed - 1}개`,
    ),
  ).toBeDefined();
});

it('counts two skipped files that share a file name as two', () => {
  const {push} = setup();
  push(fileSkippedProblem(1, 'D:/data/Songs/a1.llsong'));
  push(fileSkippedProblem(2, 'D:/backup/Songs/a1.llsong'));
  expect(within(skippedCard()).getByText('a1.llsong 외 1개')).toBeDefined();
});

it('counts two skipped files whose long names clip to the same text as two', () => {
  const {push} = setup();
  const stem = '가'.repeat(APP_PROBLEM_LIMITS.nameCharacters);
  push(fileSkippedProblem(1, `D:/data/Songs/${stem}1.llsong`));
  push(fileSkippedProblem(2, `D:/data/Songs/${stem}2.llsong`));
  expect(within(skippedCard()).getByText(`${stem} 외 1개`)).toBeDefined();
});

it('keeps a pushed save change over an older one in a list that arrives late', async () => {
  let finishList: (problems: readonly AppProblem[]) => void = () => undefined;
  const lateList = new Promise<readonly AppProblem[]>(resolve => {
    finishList = resolve;
  });
  const {push} = setup(lateList);
  push(saveFailedProblem('주일 예배', 1));
  push({kind: 'save-recovered'});
  await act(async () => {
    finishList([saveFailedProblem('주일 예배', 1)]);
    await lateList;
  });
  expect(screen.queryByRole('alert', {name: '저장할 수 없음'})).toBeNull();
});

it('warns that a 매크로 was not applied', () => {
  const {push} = setup();
  push(macroDroppedProblem(MACRO_ID, '예배 시작'));
  const card = screen.getByRole('alert', {name: '매크로 적용 실패'});
  expect(within(card).getByText('예배 시작')).toBeDefined();
  push(macroDroppedProblem(MACRO_ID, '예배 시작'));
  expect(screen.getAllByRole('alert', {name: '매크로 적용 실패'})).toHaveLength(
    1,
  );
});

it('shows 저장할 수 없음 with 다시 시도 and closes it when every file is saved', () => {
  const {push, retrySaves} = setup();
  push(saveFailedProblem('주일 예배', 1));
  const card = screen.getByRole('alert', {name: '저장할 수 없음'});
  expect(within(card).getByText('주일 예배')).toBeDefined();
  push(saveFailedProblem('주일 예배', 2));
  expect(
    within(screen.getByRole('alert', {name: '저장할 수 없음'})).getByText(
      '주일 예배 외 1개',
    ),
  ).toBeDefined();
  act(() =>
    within(screen.getByRole('alert', {name: '저장할 수 없음'}))
      .getByRole('button', {name: '다시 시도'})
      .click(),
  );
  expect(retrySaves).toHaveBeenCalledOnce();
  push(saveFailedProblem('주일 예배', 2));
  expect(screen.getByRole('alert', {name: '저장할 수 없음'})).toBeDefined();
  push({kind: 'save-recovered'});
  expect(screen.queryByRole('alert', {name: '저장할 수 없음'})).toBeNull();
});

it('shows files still waiting to be saved when the window loads', async () => {
  setup([saveFailedProblem('주일 예배', 1)]);
  expect(
    await screen.findByRole('alert', {name: '저장할 수 없음'}),
  ).toBeDefined();
});

it('releases the problem listener when the app unmounts', () => {
  const {stop, view} = setup();
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
it('keeps status text in step with save failure and recovery pushes', () => {
  const {push, view} = setup();
  const bar = view.container.querySelector('footer[role="status"]');
  expect(bar?.textContent).toBe('');
  push(saveFailedProblem('service', 1));
  expect(bar?.textContent).toBe('\uC800\uC7A5\uD558\uC9C0 \uBABB\uD568');
  push({kind: 'save-recovered'});
  expect(bar?.textContent).toBe('');
});
