import type {JSX} from 'react';
import {searchMatchRange, searchSnippet} from '@core/search';
import styles from './MatchedText.module.css';

/**
 * A search result's text with the part that matches the query marked, as a
 * web search marks it (USER Nov 25). A long line shows the part around the
 * match, with "…" where it was cut.
 */
export function MatchedText({
  text,
  query,
  className,
}: {
  readonly text: string;
  readonly query: string;
  readonly className?: string | undefined;
}): JSX.Element {
  const match = searchMatchRange(text, query);
  if (match === null) return <span className={className}>{text}</span>;
  const shown = searchSnippet(text, match);
  return (
    <span className={className}>
      {shown.text.slice(0, shown.match.start)}
      <mark className={styles.match}>
        {shown.text.slice(shown.match.start, shown.match.end)}
      </mark>
      {shown.text.slice(shown.match.end)}
    </span>
  );
}
