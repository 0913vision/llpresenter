import {describe, expect, it} from 'vitest';
import type {OutputStatuses} from '@core/schema/outputStatus';
import {screenGroups} from '@core/screens/screenRows';
import type {MonitorList} from '@core/schema/monitors';
import {
  CAPTIONS_ID,
  MAIN_ID,
  STAGE_ID,
  screensDocument,
} from '@fixtures/core/screenDocuments';

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value.screens;
}

const running = {
  placement: 'fullscreen',
  renderer: 'running',
  fps: 60,
  fpsLow: false,
} as const;

function mainRow(
  statuses: OutputStatuses,
  on = true,
  monitors: MonitorList = [],
) {
  const row = screenGroups(screens(), {
    statuses,
    outputs: {[MAIN_ID]: on},
    monitors,
  }).audience[0];
  if (row === undefined) throw new Error('Missing the main row');
  return row;
}

describe('screenGroups', () => {
  it.each([true, false])(
    'uses the matched current number even when output on is %s',
    on => {
      const monitors: MonitorList = [
        {
          id: 22,
          number: 1,
          name: 'Current',
          bounds: {x: 0, y: 0, width: 1920, height: 1080},
          scaleFactor: 1,
          refreshRate: 60,
          hasMainWindow: true,
          screenIds: [MAIN_ID],
        },
      ];
      expect(
        mainRow(
          {[MAIN_ID]: {...running, controlConflict: true, monitor: 2}},
          on,
          monitors,
        ).target,
      ).toBe('모니터 1');
    },
  );
  it('marks the current control-conflict target amber without calling it disconnected', () => {
    const status = {
      ...running,
      placement: 'window',
      controlConflict: true,
      monitor: 3,
    } as const;
    const monitors: MonitorList = [
      {
        id: 22,
        number: 3,
        name: 'Current',
        bounds: {x: 0, y: 0, width: 1920, height: 1080},
        scaleFactor: 1,
        refreshRate: 60,
        hasMainWindow: true,
        screenIds: [MAIN_ID],
      },
    ];
    expect(mainRow({[MAIN_ID]: status}, true, monitors)).toMatchObject({
      target: '모니터 3',
      health: 'warning',
      problem: '모니터 3에 컨트롤 창이 있어 창으로 표시 중',
    });
  });
  it('splits 청중, 방송, and 무대 in file order with icon and target', () => {
    const groups = screenGroups(screens(), {
      statuses: {},
      outputs: {},
      monitors: [],
    });
    expect(groups.audience.map(row => [row.id, row.icon, row.target])).toEqual([
      [MAIN_ID, 'monitor', '모니터 2'],
    ]);
    expect(groups.broadcast.map(row => [row.id, row.icon, row.target])).toEqual(
      [[CAPTIONS_ID, 'capture', '캡처용 창']],
    );
    expect(groups.stage.map(row => [row.id, row.icon, row.target])).toEqual([
      [STAGE_ID, 'monitor', '모니터 미지정'],
    ]);
  });

  it('ignores a stale status number when the saved monitor is missing', () => {
    const statuses = {[MAIN_ID]: {...running, monitor: 3}};
    expect(mainRow(statuses).target).toBe('모니터 2');
  });

  it('uses the saved number while the monitor is missing', () => {
    const status = {
      ...running,
      placement: 'monitorMissing',
      monitor: 3,
    } as const;
    expect(mainRow({[MAIN_ID]: status}).target).toBe('모니터 2');
  });

  it('uses the current assignment while the output is off', () => {
    const statuses = {[MAIN_ID]: {...running, monitor: 3}};
    expect(mainRow(statuses, false).target).toBe('모니터 2');
  });

  it('shows the unassigned target when the assignment is removed', () => {
    const statuses = {
      [STAGE_ID]: {...running, placement: 'off', monitor: 3} as const,
    };
    const row = screenGroups(screens(), {
      statuses,
      outputs: {[STAGE_ID]: true},
      monitors: [],
    }).stage[0];
    expect(row?.target).toBe('모니터 미지정');
  });

  it('shows the unassigned target for a cleared assignment that stays on', () => {
    const status = {
      ...running,
      placement: 'monitorMissing',
      monitor: 2,
    } as const;
    const cleared = screens().map(screen => {
      if (screen.id !== MAIN_ID) return screen;
      const {display: _removed, ...rest} = screen;
      return rest;
    });

    const row = screenGroups(cleared, {
      statuses: {[MAIN_ID]: status},
      outputs: {[MAIN_ID]: true},
      monitors: [],
    }).audience[0];

    expect(row?.target).toBe('모니터 미지정');
  });

  it('keeps the dot unknown until a frame rate is reported', () => {
    expect(mainRow({[MAIN_ID]: {...running, fps: null}}).health).toBe('none');
  });

  it('keeps an explicit warning before a frame rate is reported', () => {
    const status = {...running, fps: null, renderer: 'restarting'} as const;
    expect(mainRow({[MAIN_ID]: status})).toMatchObject({health: 'warning'});
  });

  it('shows no dot while the output is off or has no status yet', () => {
    expect(mainRow({[MAIN_ID]: running}, false).health).toBe('none');
    expect(mainRow({}).health).toBe('none');
  });

  it('shows the ok dot while the output runs at its frame rate', () => {
    expect(mainRow({[MAIN_ID]: running})).toMatchObject({health: 'ok'});
  });

  it.each([
    [{placement: 'monitorMissing'}, '모니터를 찾을 수 없습니다'],
    [{renderer: 'restarting'}, '출력 창 다시 시작 중'],
    [{renderer: 'limited'}, '다시 시작을 더는 시도하지 않습니다'],
    [{fpsLow: true}, '프레임 속도가 낮습니다'],
  ] as const)(
    'shows the amber dot with the reason for %j',
    (change, problem) => {
      expect(mainRow({[MAIN_ID]: {...running, ...change}})).toMatchObject({
        health: 'warning',
        problem,
      });
    },
  );
});
