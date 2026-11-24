import {createContext, useEffect, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {ScreenFrames} from '@renderer/rendering/screenFrames';

type ErrorReport = (message: string, error: unknown) => void;

interface Kept {
  readonly frames: ScreenFrames;
  readonly listeners: Set<() => void>;
}

/**
 * The frames of every screen of the preview panel, kept following their
 * settings, fonts and timers while the panel is open. A screen whose output
 * turns off then draws its picture in the first frame, not one frame later.
 */
export class KeptScreenFrames {
  private readonly kept = new Map<string, Kept>();

  constructor(
    private readonly api: LlpApi,
    private readonly onError: ErrorReport,
  ) {}

  /** Follows the screens `screenIds` and lets go of the others. */
  keep(screenIds: readonly string[]): void {
    const {api, onError} = this;
    for (const screenId of screenIds) {
      if (this.kept.has(screenId)) continue;
      const listeners = new Set<() => void>();
      const frames = new ScreenFrames({
        fonts: api.fonts,
        settings: api.settings,
        clock: () => api.live.clock(),
        wallClock: api.live,
        screenId,
        onChange: () => {
          for (const listener of listeners) listener();
        },
        onError,
      });
      this.kept.set(screenId, {frames, listeners});
    }
    for (const [screenId, kept] of this.kept) {
      if (screenIds.includes(screenId)) continue;
      kept.frames.dispose();
      this.kept.delete(screenId);
    }
  }

  /**
   * The frames of `screenId`, calling `onChange` when they change until the
   * returned `stop`; null for a screen not kept.
   */
  follow(
    screenId: string,
    onChange: () => void,
  ): {readonly frames: ScreenFrames; readonly stop: () => void} | null {
    const kept = this.kept.get(screenId);
    if (kept === undefined) return null;
    kept.listeners.add(onChange);
    return {
      frames: kept.frames,
      stop: () => {
        kept.listeners.delete(onChange);
      },
    };
  }

  dispose(): void {
    for (const kept of this.kept.values()) kept.frames.dispose();
    this.kept.clear();
  }
}

/** The kept frames of the preview panel around a screen preview, if any. */
export const KeptFramesContext = createContext<KeptScreenFrames | null>(null);

/** Keeps the frames of `screenIds` ready for as long as the caller is open. */
export function useKeptScreenFrames(
  screenIds: readonly string[],
  onError: ErrorReport,
): KeptScreenFrames | null {
  const [kept] = useState(() =>
    window.llp === undefined ? null : new KeptScreenFrames(window.llp, onError),
  );
  const ids = screenIds.join('\n');
  useEffect(() => {
    kept?.keep(ids === '' ? [] : ids.split('\n'));
  }, [kept, ids]);
  useEffect(() => () => kept?.dispose(), [kept]);
  return kept;
}
