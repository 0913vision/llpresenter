/** What a log line needs of a window's contents: its id and its page. */
interface LoggedContents {
  readonly id?: number;
  readonly getURL?: () => string;
  readonly isDestroyed?: () => boolean;
}

/**
 * The id and page of a window's contents for a log line. It never throws: a
 * closed window, or one without a page, gives what is known.
 */
export function contentsForLog(contents: LoggedContents): {
  readonly id: number | null;
  readonly url: string | null;
} {
  const id = typeof contents.id === 'number' ? contents.id : null;
  try {
    if (contents.isDestroyed?.() === true) return {id, url: null};
    return {id, url: contents.getURL?.() ?? null};
  } catch {
    return {id, url: null};
  }
}
