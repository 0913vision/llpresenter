import {ipcMain} from 'electron';
import {appEndpoints} from '@contracts/ipc/app';
import {APP_PROBLEM_LIMITS, type AppProblem} from '@core/schema/appProblem';
import {sendToWindows} from './ipc';
import type {LiveStore} from './live/store';
import type {Logger} from './log';

/** How many one-shot problems wait for a window that loads after them. */
export const MAX_UNREAD_PROBLEMS = 16;

/** A source of standing problems, such as the files that wait for a save. */
export type StandingProblems = () => readonly AppProblem[];

/** The app's one way to the windows' problem cards. */
export interface ProblemFeed {
  /**
   * A problem that happens once, such as a dropped 매크로: pushed now, and
   * kept until a window next reads the list, so a window that loads late, or
   * subscribes after a startup 매크로, still shows it.
   */
  report(problem: AppProblem): void;
  /** A change of a standing problem, which its source lists from now on. */
  push(problem: AppProblem): void;
  /**
   * Lists a source's problems before the unread one-shot problems.
   *
   * @returns A function that removes the source.
   */
  addStanding(source: StandingProblems): () => void;
}

class WindowProblemFeed implements ProblemFeed {
  private unread: readonly AppProblem[] = [];
  private readonly standing = new Set<StandingProblems>();

  constructor(private readonly log: Logger) {}

  report(problem: AppProblem): void {
    this.push(problem);
    this.unread = [...this.unread, problem].slice(-MAX_UNREAD_PROBLEMS);
  }

  push(problem: AppProblem): void {
    sendToWindows(appEndpoints.problems.channel, problem, this.log);
  }

  addStanding(source: StandingProblems): () => void {
    this.standing.add(source);
    return () => {
      this.standing.delete(source);
    };
  }

  /**
   * The standing problems, then the unread ones, which this read clears. The
   * unread ones always fit: the standing ones get the rest of the list's room,
   * and a standing problem left out is listed again on the next read.
   */
  list(): readonly AppProblem[] {
    const unread = this.unread;
    this.unread = [];
    const standing = [...this.standing]
      .flatMap(source => this.problemsOf(source))
      .slice(0, APP_PROBLEM_LIMITS.listed - unread.length);
    return [...standing, ...unread];
  }

  private problemsOf(source: StandingProblems): readonly AppProblem[] {
    try {
      return source();
    } catch (error: unknown) {
      this.log.error('could not list standing problems', error);
      return [];
    }
  }
}

/** The arguments of {@link registerProblemFeed}. */
export interface ProblemFeedRegistration {
  readonly store: Pick<LiveStore, 'subscribeProblems'>;
  readonly log: Logger;
}

/**
 * Answers `app:problem:list` and reports the live store's problems, such as a
 * dropped 매크로, on `app:problem`.
 *
 * @returns The feed, and a function that removes the handler and the
 * subscription.
 */
export function registerProblemFeed({store, log}: ProblemFeedRegistration): {
  readonly feed: ProblemFeed;
  readonly dispose: () => void;
} {
  const feed = new WindowProblemFeed(log);
  ipcMain.handle(appEndpoints.problemList.channel, () => feed.list());
  const stopLive = store.subscribeProblems(problem => {
    feed.report(problem);
  });
  return {
    feed,
    dispose: () => {
      stopLive();
      ipcMain.removeHandler(appEndpoints.problemList.channel);
    },
  };
}
