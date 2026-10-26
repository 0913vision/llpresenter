import {describe, expect, it} from 'vitest';
import type {OutputStatuses} from '@shared/schema/outputStatus';
import {screenGroups} from './screenRows';
import {
  CAPTIONS_ID,
  MAIN_ID,
  STAGE_ID,
  screensDocument,
} from './testing/documents';

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

function mainRow(statuses: OutputStatuses, on = true) {
  const row = screenGroups(screens(), statuses, {[MAIN_ID]: on}).audience[0];
  if (row === undefined) throw new Error('Missing the main row');
  return row;
}

describe('screenGroups', () => {
  it('splits 청중 and 무대 in file order with icon and target', () => {
    const groups = screenGroups(screens(), {}, {});
    expect(groups.audience.map(row => [row.id, row.icon, row.target])).toEqual([
      [MAIN_ID, 'monitor', '모니터 2'],
      [CAPTIONS_ID, 'capture', '캡처용 창'],
    ]);
    expect(groups.stage.map(row => [row.id, row.icon, row.target])).toEqual([
      [STAGE_ID, 'monitor', '모니터 미지정'],
    ]);
  });

  it('prefers the monitor the screen last showed on over the saved one', () => {
    const statuses = {[MAIN_ID]: {...running, monitor: 3}};
    expect(mainRow(statuses).target).toBe('모니터 3');
  });

  it('keeps the shown monitor while it is missing', () => {
    const status = {
      ...running,
      placement: 'monitorMissing',
      monitor: 3,
    } as const;
    expect(mainRow({[MAIN_ID]: status}).target).toBe('모니터 3');
  });

  it('uses the current assignment while the output is off', () => {
    const statuses = {[MAIN_ID]: {...running, monitor: 3}};
    expect(mainRow(statuses, false).target).toBe('모니터 2');
  });

  it('shows the unassigned target when the assignment is removed', () => {
    const statuses = {
      [STAGE_ID]: {...running, placement: 'off', monitor: 3} as const,
    };
    const row = screenGroups(screens(), statuses, {[STAGE_ID]: true}).stage[0];
    expect(row?.target).toBe('모니터 미지정');
  });

  it('shows the unassigned target for a cleared assignment that stays on', () => {
    const status = {
      ...running,
      placement: 'monitorMissing',
      monitor: 2,
    } as const;
    const cleared = screens().map(screen =>
      screen.id === MAIN_ID ? {...screen, display: undefined} : screen,
    );

    const row = screenGroups(cleared, {[MAIN_ID]: status}, {[MAIN_ID]: true})
      .audience[0];

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
    [{placement: 'monitorMissing'}, '모니터를 찾을 수 없음'],
    [{renderer: 'restarting'}, '출력 창을 다시 시작하는 중'],
    [{renderer: 'limited'}, '다시 시작 한도에 도달함'],
    [{fpsLow: true}, '프레임 속도가 낮음'],
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
