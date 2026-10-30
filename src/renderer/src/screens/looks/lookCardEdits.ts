import type {
  LookId,
  LyricStyleId,
  ScreenId,
  StageLayoutId,
} from '@core/schema/ids';
import type {Look, LooksFile, ScreenLook} from '@core/schema/looks';

/** The saved switches understood by the Look editor and output renderer. */
export const LOOK_LAYERS = [
  'media',
  'slide',
  'notice',
  'prop',
  'message',
  'clock',
  'stageMessage',
] as const;

export type LookCardChange =
  | {
      readonly kind: 'layer';
      readonly layer: (typeof LOOK_LAYERS)[number];
      readonly on: boolean;
    }
  | {readonly kind: 'lyricStyle'; readonly id: LyricStyleId | null}
  | {readonly kind: 'stageLayout'; readonly id: StageLayoutId | null}
  | {
      readonly kind: 'background';
      readonly value: NonNullable<ScreenLook['background']>;
    };

export interface LookCardEdit {
  readonly lookId: LookId;
  readonly screenId: ScreenId;
  readonly change: LookCardChange;
}

const allLayers: ScreenLook['layers'] = Object.fromEntries(
  LOOK_LAYERS.map(layer => [layer, true]),
);

/** Mirrors output's missing-card fallback without hiding other layers on first edit. */
export function screenCard(look: Look, screenId: ScreenId): ScreenLook {
  return look.screens[screenId] ?? {layers: allLayers};
}

function changeCard(card: ScreenLook, change: LookCardChange): ScreenLook {
  switch (change.kind) {
    case 'layer':
      return {...card, layers: {...card.layers, [change.layer]: change.on}};
    case 'lyricStyle': {
      const {lyricStyle, ...rest} = card;
      return change.id === null ? rest : {...rest, lyricStyle: change.id};
    }
    case 'stageLayout': {
      const {stageLayout, ...rest} = card;
      return change.id === null ? rest : {...rest, stageLayout: change.id};
    }
    case 'background':
      return {...card, background: {...card.background, ...change.value}};
  }
}

/** Changes one card against the latest file, preserving other cards and unknown fields. */
export function editLookCard(file: LooksFile, edit: LookCardEdit): LooksFile {
  const look = file.looks.find(look => look.id === edit.lookId);
  if (look === undefined) return file;
  const change = edit.change;
  if (
    change.kind === 'lyricStyle' &&
    change.id !== null &&
    !file.lyricStyles.some(style => style.id === change.id)
  ) {
    return file;
  }
  const card = changeCard(screenCard(look, edit.screenId), change);
  return {
    ...file,
    looks: file.looks.map(item =>
      item.id === look.id
        ? {...item, screens: {...item.screens, [edit.screenId]: card}}
        : item,
    ),
  };
}
