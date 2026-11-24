import type {OutputStatuses} from '@core/schema/live/outputStatus';
import type {Screen} from '@core/schema/screens/screens';
import type {MonitorList} from '@core/schema/screens/monitors';
import {monitorAssignment} from './monitorAssignment';

/** A screen row's health dot: none while the output is off. */
export type ScreenHealth = 'ok' | 'warning' | 'none';

/**
 * One row of the 화면 list: its name, icon, where it shows and its health dot.
 */
export interface ScreenRow {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly target: string;
  readonly health: ScreenHealth;
  /** Why the dot is amber; set only with `warning`. */
  readonly problem?: string | undefined;
}

/** The rows of the 화면 list for 청중, 방송 and 무대. */
export interface ScreenGroups {
  readonly audience: readonly ScreenRow[];
  readonly broadcast: readonly ScreenRow[];
  readonly stage: readonly ScreenRow[];
}

type ScreenStatus = OutputStatuses[string];

const MONITOR_ICON = 'monitor';
const CAPTURE_ICON = 'capture';
/** What a row shows as its destination when a full-screen 화면 has no monitor. */
export const UNASSIGNED_TARGET = '모니터 미지정';
/**
 * What a row shows as its destination for each output method that needs no
 * monitor.
 */
export const targetByMethod = {
  window: '창',
  capture: '캡처용 창',
  ndi: 'NDI',
} as const;

function targetOf(screen: Screen, monitors: MonitorList): string {
  if (screen.method !== 'fullscreen') return targetByMethod[screen.method];
  const number =
    screen.display === undefined
      ? undefined
      : (monitorAssignment(monitors).get(screen.id)?.number ??
        screen.display.number);
  return number === undefined ? UNASSIGNED_TARGET : `모니터 ${number}`;
}

function iconOf(screen: Screen): string {
  return screen.method === 'capture' || screen.method === 'ndi'
    ? CAPTURE_ICON
    : MONITOR_ICON;
}

function problemOf(status: ScreenStatus): string | undefined {
  if (status.controlConflict) {
    return controlConflictReason(status.monitor);
  }
  if (status.placement === 'monitorMissing') {
    return '모니터를 찾을 수 없습니다.';
  }
  if (status.renderer === 'restarting') return '출력 창 다시 시작 중';
  if (status.renderer === 'limited') {
    return '다시 시작을 더는 시도하지 않습니다.';
  }
  return status.fpsLow ? '프레임 속도가 낮습니다.' : undefined;
}

function healthOf(
  on: boolean,
  status: ScreenStatus | undefined,
): Pick<ScreenRow, 'health' | 'problem'> {
  if (!on || status === undefined) return {health: 'none'};
  const problem = problemOf(status);
  if (problem !== undefined) return {health: 'warning', problem};
  return status.fps === null ? {health: 'none'} : {health: 'ok'};
}

function rowOf(
  screen: Screen,
  {statuses, outputs, monitors}: ScreenGroupsInput,
): ScreenRow {
  const status = statuses[screen.id];
  const on = outputs[screen.id] === true;
  return {
    id: screen.id,
    name: screen.name,
    icon: iconOf(screen),
    target: targetOf(screen, monitors),
    ...healthOf(on, status),
  };
}

interface ScreenGroupsInput {
  readonly statuses: OutputStatuses;
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly monitors: MonitorList;
}

/**
 * The warning shown when a 화면 meant for full screen shows in a window because
 * the control window is on that monitor. `number` is the monitor number, when
 * known.
 */
export function controlConflictReason(number: number | undefined): string {
  return `${number === undefined ? '모니터' : `모니터 ${number}`}에 컨트롤 창이 있어 창으로 표시 중`;
}

/** The 청중, 무대, and 방송 groups, with destinations from current assignments. */
export function screenGroups(
  screens: readonly Screen[],
  input: ScreenGroupsInput,
): ScreenGroups {
  const rows = screens.map(screen => ({
    kind: screen.kind,
    row: rowOf(screen, input),
  }));
  const of = (kind: Screen['kind']): readonly ScreenRow[] =>
    rows.filter(entry => entry.kind === kind).map(entry => entry.row);
  return {
    audience: of('audience'),
    broadcast: of('broadcast'),
    stage: of('stage'),
  };
}
