import {act, renderHook, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {OutputStatuses} from '@core/schema/outputStatus';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {
  outputNoticeChanges,
  type NoticeChange,
} from '@renderer/app/notifications/outputNotices';
import {
  useOutputNotices,
  type NoticeTarget,
} from '@renderer/app/notifications/useOutputNotices';
import {useOutputWarnings} from '@renderer/platform/outputWarnings';
import type {Notice} from '@renderer/ui/notices';

vi.mock('@renderer/app/notifications/outputNotices', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@renderer/app/notifications/outputNotices')
  >()),
  outputNoticeChanges: vi.fn(() => []),
}));

const STAGE_LOST: OutputStatuses = {
  stage: {
    placement: 'monitorMissing',
    renderer: 'running',
    fps: 60,
    fpsLow: false,
    monitor: 3,
  },
};

function lostCard(onSelect = vi.fn()): Notice {
  return {
    key: 'screen:stage',
    kind: 'warning',
    icon: 'plug',
    title: '무대 모니터 연결 끊김',
    time: '11:24',
    actions: [{icon: 'refresh', label: '모니터 다시 찾기', onSelect}],
  };
}

function setup(initial: OutputStatuses = {}) {
  let push: (statuses: OutputStatuses) => void = () => undefined;
  const findMonitors = vi.fn<LlpApi['output']['findMonitors']>();
  const showWindow = vi.fn<LlpApi['output']['showWindow']>();
  const retry = vi.fn<LlpApi['output']['retry']>();
  const api = mockLlpApi({
    output: {
      getStatus: () => Promise.resolve(initial),
      subscribeStatus: listener => {
        push = listener;
        return () => undefined;
      },
      findMonitors,
      showWindow,
      retry,
    },
  });
  const showing: Notice[] = [];
  const target: NoticeTarget = {
    report: vi.fn((notice: Notice) => {
      showing.push(notice);
    }),
    dismiss: vi.fn(),
    getNotices: () => showing,
  };
  renderHook(() => useOutputNotices(api, target));
  return {
    target,
    showing,
    findMonitors,
    showWindow,
    retry,
    push: (statuses: OutputStatuses, changes: readonly NoticeChange[]) => {
      vi.mocked(outputNoticeChanges).mockReturnValueOnce(changes);
      act(() => push(statuses));
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useOutputWarnings.setState({warnings: new Map()});
});

describe('useOutputNotices', () => {
  it('shows a warning card and keeps it for the 출력 menu under the full screen name', () => {
    const {target, push} = setup();
    const card = lostCard();

    push(STAGE_LOST, [{kind: 'show', screenId: 'stage', notice: card}]);

    expect(target.report).toHaveBeenCalledOnce();
    expect(useOutputWarnings.getState().warnings.get(card.key)).toMatchObject({
      screenId: 'stage',
      screenName: '무대 화면',
    });
  });

  it('shows the card again right after its action while the warning still holds', () => {
    const {target, push} = setup();
    const onSelect = vi.fn();
    push(STAGE_LOST, [
      {kind: 'show', screenId: 'stage', notice: lostCard(onSelect)},
    ]);
    const shown = vi.mocked(target.report).mock.lastCall?.[0];

    act(() => shown?.actions?.[0]?.onSelect());
    expect(onSelect).toHaveBeenCalledOnce();
    expect(target.report).toHaveBeenCalledTimes(2);
    push({}, [{kind: 'dismiss', key: 'screen:stage'}]);
    act(() => shown?.actions?.[0]?.onSelect());

    expect(target.report).toHaveBeenCalledTimes(2);
  });

  it('drops the warning and closes its card when it resolves', () => {
    const {target, push} = setup();
    push(STAGE_LOST, [{kind: 'show', screenId: 'stage', notice: lostCard()}]);

    push({}, [{kind: 'dismiss', key: 'screen:stage'}]);

    expect(target.dismiss).toHaveBeenCalledExactlyOnceWith('screen:stage');
    expect(useOutputWarnings.getState().warnings.size).toBe(0);
  });

  it('updates a warning card only while it shows, and keeps the update for the 출력 menu', () => {
    const {target, showing, push} = setup();
    push(STAGE_LOST, [{kind: 'show', screenId: 'stage', notice: lostCard()}]);
    const off = {...lostCard(), meta: ['모니터 3', '출력 꺼짐']};

    push({}, [{kind: 'update', screenId: 'stage', notice: off}]);
    expect(target.report).toHaveBeenCalledTimes(2);
    showing.length = 0;
    push({}, [{kind: 'update', screenId: 'stage', notice: off}]);

    expect(target.report).toHaveBeenCalledTimes(2);
    expect(
      useOutputWarnings.getState().warnings.get('screen:stage')?.notice.meta,
    ).toEqual(['모니터 3', '출력 꺼짐']);
  });

  it('reads the first status only when no push came before it, and passes the output actions on', async () => {
    const {findMonitors, showWindow, retry} = setup(STAGE_LOST);

    await waitFor(() => expect(outputNoticeChanges).toHaveBeenCalledOnce());
    const input = vi.mocked(outputNoticeChanges).mock.lastCall?.[0];
    expect(input?.previous).toEqual({});
    expect(input?.next).toEqual(STAGE_LOST);
    input?.actions.findMonitors();
    input?.actions.showWindow('stage');
    input?.actions.retry('main');

    expect(findMonitors).toHaveBeenCalledOnce();
    expect(showWindow).toHaveBeenCalledWith('stage');
    expect(retry).toHaveBeenCalledWith('main');
  });

  it('ignores the first status read after a push', async () => {
    const {push} = setup(STAGE_LOST);

    push({}, []);
    await act(() => Promise.resolve());

    expect(outputNoticeChanges).toHaveBeenCalledOnce();
    expect(vi.mocked(outputNoticeChanges).mock.lastCall?.[0].next).toEqual({});
  });
});
