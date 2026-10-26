import type {OutputStatuses} from '@shared/schema/outputStatus';
import type {Screen} from '@shared/schema/screens';

/** A screen row's health dot: none while the output is off. */
export type ScreenHealth = 'ok' | 'warning' | 'none';

export interface ScreenRow {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly target: string;
  readonly health: ScreenHealth;
  /** Why the dot is amber; set only with `warning`. */
  readonly problem?: string | undefined;
}

export interface ScreenGroups {
  readonly audience: readonly ScreenRow[];
  readonly stage: readonly ScreenRow[];
}

type ScreenStatus = OutputStatuses[string];

const MONITOR_ICON = 'monitor';
const CAPTURE_ICON = 'capture';
export const UNASSIGNED_TARGET = '모니터 미지정';
export const targetByMethod = {
  window: '창',
  capture: '캡처용 창',
  ndi: 'NDI',
} as const;

function showsOnMonitor(status: ScreenStatus | undefined, on: boolean) {
  return (
    on &&
    (status?.placement === 'fullscreen' ||
      status?.placement === 'monitorMissing')
  );
}

function monitorNumber(
  screen: Screen,
  status: ScreenStatus | undefined,
  on: boolean,
): number | undefined {
  if (screen.display === undefined) return undefined;
  const shown = showsOnMonitor(status, on) ? status?.monitor : undefined;
  return shown ?? screen.display.number;
}

function targetOf(
  screen: Screen,
  status: ScreenStatus | undefined,
  on: boolean,
): string {
  if (screen.method !== 'fullscreen') return targetByMethod[screen.method];
  const number = monitorNumber(screen, status, on);
  return number === undefined ? UNASSIGNED_TARGET : `모니터 ${number}`;
}

function iconOf(screen: Screen): string {
  return screen.method === 'capture' || screen.method === 'ndi'
    ? CAPTURE_ICON
    : MONITOR_ICON;
}

function problemOf(status: ScreenStatus): string | undefined {
  if (status.placement === 'monitorMissing') return '모니터를 찾을 수 없음';
  if (status.renderer === 'restarting') return '출력 창을 다시 시작하는 중';
  if (status.renderer === 'limited') return '다시 시작 한도에 도달함';
  return status.fpsLow ? '프레임 속도가 낮음' : undefined;
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
  statuses: OutputStatuses,
  outputs: Readonly<Record<string, boolean>>,
): ScreenRow {
  const status = statuses[screen.id];
  const on = outputs[screen.id] === true;
  return {
    id: screen.id,
    name: screen.name,
    icon: iconOf(screen),
    target: targetOf(screen, status, on),
    ...healthOf(on, status),
  };
}

/** The 청중 and 무대 groups of the screen list, each in file order. */
export function screenGroups(
  screens: readonly Screen[],
  statuses: OutputStatuses,
  outputs: Readonly<Record<string, boolean>>,
): ScreenGroups {
  const rows = screens.map(screen => ({
    kind: screen.kind,
    row: rowOf(screen, statuses, outputs),
  }));
  const of = (kind: Screen['kind']): readonly ScreenRow[] =>
    rows.filter(entry => entry.kind === kind).map(entry => entry.row);
  return {audience: of('audience'), stage: of('stage')};
}
