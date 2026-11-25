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

/**
 * The page a window shows, named by its file and query for a log line, such
 * as `output?screen=…&ndi=1`, or `#7` by its id when its page is unknown.
 */
export function pageForLog(contents: LoggedContents): string {
  const {id, url} = contentsForLog(contents);
  if (url !== null) {
    try {
      const parsed = new URL(url);
      const file = parsed.pathname.split('/').at(-1) ?? '';
      return `${file.replace(/\.html$/u, '')}${parsed.search}`;
    } catch {
      // NOTE(0913vision): A page address that is not a URL names nothing.
    }
  }
  return `#${id ?? '?'}`;
}
