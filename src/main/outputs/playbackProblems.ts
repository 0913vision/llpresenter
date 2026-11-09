import type {WebContents} from 'electron';
import {outputEndpoints} from '@contracts/ipc/output';
import {
  PLAYBACK_PROBLEM_LIMITS,
  parsePlaybackProblemReport,
  parsePlaybackRetry,
  type PlaybackProblemKind,
  type PlaybackProblems,
} from '@core/schema/playbackProblems';
import {answerWindows, listenToWindows, sendToWindows} from '../ipc';
import type {Logger} from '../log';
import type {RendererState} from './rendererRecovery';

interface Source {
  readonly source: string;
  readonly name: () => string;
  readonly retry: () => void;
}

interface Entry extends Source {
  kinds: readonly PlaybackProblemKind[];
  renderer: RendererState;
}

/** Owns current playback problems across control reloads, keyed by registered senders. */
export class PlaybackProblemBoard {
  private readonly entries = new Map<number, Entry>();
  private previous = '';

  constructor(
    private readonly enabled: (source: string) => boolean,
    private readonly changed: (problems: PlaybackProblems) => void,
  ) {}

  register(sender: number, source: Source): () => void {
    if (this.entries.size >= PLAYBACK_PROBLEM_LIMITS.sources) {
      throw new Error('Too many playback problem sources');
    }
    const entry: Entry = {...source, kinds: [], renderer: 'running'};
    this.entries.set(sender, entry);
    return () => {
      if (this.entries.get(sender) !== entry) return;
      this.entries.delete(sender);
      this.refresh();
    };
  }

  report(sender: number, kinds: readonly PlaybackProblemKind[]): void {
    const entry = this.entries.get(sender);
    if (entry === undefined) return;
    entry.kinds = kinds;
    this.refresh();
  }

  renderer(sender: number, state: RendererState): void {
    const entry = this.entries.get(sender);
    if (entry === undefined) return;
    entry.renderer = state;
    this.refresh();
  }

  retry(source: string): void {
    for (const entry of this.entries.values()) {
      if (entry.source === source && this.enabled(source)) entry.retry();
    }
  }

  snapshot(): PlaybackProblems {
    return [...this.entries.values()]
      .filter(
        entry =>
          this.enabled(entry.source) &&
          (entry.kinds.length > 0 || entry.renderer !== 'running'),
      )
      .map(entry => ({
        source: entry.source,
        name:
          entry.name().slice(0, PLAYBACK_PROBLEM_LIMITS.name) || entry.source,
        kinds: [...entry.kinds],
        renderer: entry.renderer,
      }));
  }

  refresh(): void {
    const next = this.snapshot();
    const key = JSON.stringify(next);
    if (key === this.previous) return;
    this.previous = key;
    this.changed(next);
  }
}

/** Binds the lifetime of a problem source to its actual output web contents. */
export function watchPlaybackProblems(
  board: Pick<PlaybackProblemBoard, 'register'>,
  contents: WebContents,
  source: Source,
): () => void {
  const release = board.register(contents.id, source);
  contents.once('destroyed', release);
  return () => {
    contents.removeListener('destroyed', release);
    release();
  };
}

export function registerPlaybackProblems({
  log,
  enabled,
  subscribe,
}: {
  readonly log: Logger;
  readonly enabled: (source: string) => boolean;
  readonly subscribe: (changed: () => void) => () => void;
}) {
  const board = new PlaybackProblemBoard(enabled, next =>
    sendToWindows(outputEndpoints.playbackChanged.channel, next, log),
  );
  const stops = [
    answerWindows(outputEndpoints.playbackProblems.channel, () =>
      board.snapshot(),
    ),
    listenToWindows(outputEndpoints.playbackReport.channel, (value, sender) => {
      const parsed = parsePlaybackProblemReport(value);
      if (parsed.ok) board.report(sender, parsed.value);
      else log.warn('invalid playback problem report', parsed.error);
    }),
    listenToWindows(outputEndpoints.playbackRetry.channel, value => {
      const parsed = parsePlaybackRetry(value);
      if (parsed.ok) board.retry(parsed.value.source);
      else log.warn('invalid playback retry', parsed.error);
    }),
    subscribe(() => board.refresh()),
  ];
  return {board, stop: () => stops.forEach(stop => stop())};
}
