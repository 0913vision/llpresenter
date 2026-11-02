import type {Screen} from '../schema/screens';

/** The most the 가장자리 여백 may be, in percent (spec 10, "Screens"). */
export const EDGE_MARGIN_MAX = 20;

/** How far the 위치 미세 조정 may move the picture each way, in pixels. */
export const OFFSET_LIMIT = 200;

/** The sizes a capture window offers. */
export const CAPTURE_RESOLUTIONS = [
  {width: 1920, height: 1080},
  {width: 1280, height: 720},
  {width: 3840, height: 2160},
] as const;

export type ScreenChange = Partial<
  Omit<Screen, 'id' | 'offset' | 'messageStyleId'>
> & {
  readonly offset?: Partial<NonNullable<Screen['offset']>>;
  /** `null` returns the screen to the built-in 기본 style. */
  readonly messageStyleId?: NonNullable<Screen['messageStyleId']> | null;
};

/** Why a screen name can't be saved, or `undefined` when it can. */
export type NameProblem = 'empty' | 'taken';

function withMessageStyle(
  screen: Screen,
  messageStyleId: ScreenChange['messageStyleId'],
): Screen {
  if (messageStyleId === undefined) return screen;
  const {messageStyleId: _replaced, ...others} = screen;
  return messageStyleId === null ? others : {...others, messageStyleId};
}

const KIND_NAMES = {
  audience: '청중',
  broadcast: '방송',
  stage: '무대',
} as const;

/** The name a new screen of this kind gets, with a number when it is taken. */
export function defaultScreenName(
  kind: Screen['kind'],
  screens: ReadonlyArray<Pick<Screen, 'name'>>,
): string {
  const base = `새 ${KIND_NAMES[kind]} 화면`;
  const names = new Set(screens.map(screen => screen.name.trim()));
  let name = base;
  for (let suffix = 2; names.has(name); suffix++) name = `${base} (${suffix})`;
  return name;
}

function isDefaultName(kind: Screen['kind'], name: string): boolean {
  const base = `새 ${KIND_NAMES[kind]} 화면`;
  const trimmed = name.trim();
  return (
    trimmed.startsWith(base) && /^( \(\d+\))?$/.test(trimmed.slice(base.length))
  );
}

/**
 * The screens with the change applied to the screen with this id. Other
 * screens and unknown fields stay as they are.
 */
export function changeScreen(
  screens: readonly Screen[],
  id: string,
  change: ScreenChange,
): readonly Screen[] {
  return screens.map(screen => {
    if (screen.id !== id) return screen;
    const {offset, messageStyleId, ...fields} = change;
    const kind = fields.kind;
    const renamed =
      kind !== undefined &&
      kind !== screen.kind &&
      fields.name === undefined &&
      isDefaultName(screen.kind, screen.name);
    const updated = {
      ...withMessageStyle(screen, messageStyleId),
      ...fields,
      ...(renamed
        ? {
            name: defaultScreenName(
              kind,
              screens.filter(other => other.id !== id),
            ),
          }
        : {}),
    };
    return offset === undefined
      ? updated
      : {...updated, offset: {x: 0, y: 0, ...screen.offset, ...offset}};
  });
}

/** A name must not be empty and must not be another item's name. */
export function nameProblem(
  name: string,
  items: ReadonlyArray<{readonly id: string; readonly name: string}>,
  id: string,
): NameProblem | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return 'empty';
  const taken = items.some(
    screen => screen.id !== id && screen.name.trim() === trimmed,
  );
  return taken ? 'taken' : undefined;
}

/** 항상 위 defaults off when the screen has no explicit setting. */
export function alwaysOnTopOf(screen: Screen): boolean {
  return screen.alwaysOnTop ?? false;
}

/** 연결이 끊기면 when the screen sets none. */
export function onDisconnectOf(screen: Screen): 'window' | 'off' {
  return screen.onDisconnect ?? 'window';
}
