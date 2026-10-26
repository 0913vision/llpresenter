import {
  APP_PROBLEM_LIMITS,
  fileSkippedProblem,
  type AppProblem,
} from '@shared/schema/appProblem';
import type {Logger} from '../log';

/** A data file that couldn't be read, by its path. */
export interface SkippedFile {
  readonly file: string;
}

/**
 * The data files skipped at startup, a standing problem until the app
 * restarts, so windows that load later list them. At most
 * `APP_PROBLEM_LIMITS.listed` are kept; the rest are logged once.
 */
export class SkippedFiles {
  private readonly problems = new Map<string, AppProblem>();
  private overflowLogged = false;

  constructor(private readonly log: Logger) {}

  /** Keeps a skipped file once; returns its problem when it is new and fits. */
  addSkippedFile(file: string): AppProblem | null {
    if (this.problems.has(file)) return null;
    if (this.problems.size >= APP_PROBLEM_LIMITS.listed) {
      if (!this.overflowLogged) {
        this.overflowLogged = true;
        this.log.warn('too many skipped data files to list', {file});
      }
      return null;
    }
    const problem = fileSkippedProblem(file);
    this.problems.set(file, problem);
    return problem;
  }

  list(): readonly AppProblem[] {
    return [...this.problems.values()];
  }
}

/** Where the skipped data files come from. */
export interface SkippedFileSources {
  /** The settings and media files, replayed to a new listener. */
  readonly settings: (listener: (skipped: SkippedFile) => void) => () => void;
  /** The songs, 예배 순서, 틀, labels, and preferences read at startup. */
  readonly content: Promise<readonly SkippedFile[]>;
}

/**
 * Lists each skipped data file and announces it to the open windows once.
 *
 * @returns A function that stops listening.
 */
export function startSkippedFileProblems({
  skipped,
  sources,
  announce,
  log,
}: {
  readonly skipped: SkippedFiles;
  readonly sources: SkippedFileSources;
  readonly announce: (problem: AppProblem) => void;
  readonly log: Logger;
}): () => void {
  let stopped = false;
  const add = ({file}: SkippedFile): void => {
    if (stopped) return;
    const problem = skipped.addSkippedFile(file);
    if (problem !== null) announce(problem);
  };
  const stopSettings = sources.settings(add);
  sources.content.then(
    skipped => {
      for (const file of skipped) add(file);
    },
    (error: unknown) =>
      log.error('could not list the skipped data files', error),
  );
  return () => {
    stopped = true;
    stopSettings();
  };
}
