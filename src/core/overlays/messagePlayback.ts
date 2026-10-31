import type {MessageLayer} from '../live/state';

export interface MessagePlaybackItem {
  readonly messageId: string;
  readonly text: string;
  readonly expiresAt: number | null;
}

/** The active messages, retaining support for older single-message layers. */
export function liveMessages(
  layer: MessageLayer | null | undefined,
  now: number,
): readonly MessagePlaybackItem[] {
  if (layer == null) return [];
  if (!layer.items?.length) return [{...layer, expiresAt: null}];
  return layer.items.filter(
    item => item.expiresAt === null || item.expiresAt > now,
  );
}

export function messageTimeLeft(
  expiresAt: number | null,
  now: number,
): string | undefined {
  if (expiresAt === null) return undefined;
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
