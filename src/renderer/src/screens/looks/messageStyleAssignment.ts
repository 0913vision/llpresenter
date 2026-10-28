import type {LookId, MessageStyleId, ScreenId} from '@shared/schema/ids';
import {
  DEFAULT_MESSAGE_STYLE,
  MESSAGE_STYLE_LIMIT,
  type LooksFile,
  type MessageScreenLook,
} from '@shared/schema/looks';
import {LOOK_LAYERS} from './lookCardEdits';

/** Assigns a validated style only to the chosen screen of the chosen Look. */
export function assignMessageStyle(
  file: LooksFile,
  {
    lookId,
    screenId,
    styleId,
  }: {
    readonly lookId: LookId;
    readonly screenId: ScreenId;
    readonly styleId: MessageStyleId | null;
  },
): LooksFile {
  const look = file.looks.find(item => item.id === lookId);
  if (
    look === undefined ||
    (styleId !== null &&
      !file.messageStyles?.some(style => style.id === styleId))
  ) {
    return file;
  }
  const card = look.screens[screenId];
  if ((card?.messageStyle ?? null) === styleId) return file;
  const fallback: MessageScreenLook = {
    layers: Object.fromEntries(LOOK_LAYERS.map(layer => [layer, true])),
  };
  const {messageStyle: _removed, ...rest} = card ?? fallback;
  const next = styleId === null ? rest : {...rest, messageStyle: styleId};
  return {
    ...file,
    looks: file.looks.map(item =>
      item.id === lookId
        ? {...item, screens: {...item.screens, [screenId]: next}}
        : item,
    ),
  };
}

/** Creates a copy and assigns it atomically to one screen of one Look. */
export function createAndAssignMessageStyle(
  file: LooksFile,
  {
    lookId,
    screenId,
    styleId,
  }: {
    readonly lookId: LookId;
    readonly screenId: ScreenId;
    readonly styleId: MessageStyleId;
  },
): LooksFile {
  const look = file.looks.find(item => item.id === lookId);
  const styles = file.messageStyles ?? [];
  if (
    look === undefined ||
    styles.length >= MESSAGE_STYLE_LIMIT ||
    styles.some(style => style.id === styleId)
  ) {
    return file;
  }
  const selected = look.screens[screenId]?.messageStyle;
  const source =
    styles.find(style => style.id === selected) ?? DEFAULT_MESSAGE_STYLE;
  const names = new Set(styles.map(style => style.name.trim()));
  let name = '새 메시지 스타일';
  for (let suffix = 2; names.has(name); suffix++) {
    name = `새 메시지 스타일 ${suffix}`;
  }
  const withStyle = {
    ...file,
    messageStyles: [...styles, {...source, id: styleId, name}],
  };
  return assignMessageStyle(withStyle, {lookId, screenId, styleId});
}
