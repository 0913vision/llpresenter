import type {JSX, ReactNode} from 'react';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/notices';
import styles from './Workspace.module.css';

/** What a panel shows, by part. A workspace fills only the parts it needs. */
export interface PanelParts {
  readonly embedded?: ReactNode;
  // NOTE(0913vision): `bare` draws its content without the panel around it,
  // as the 지우기 row does.
  readonly bare?: ReactNode;
  // NOTE(0913vision): `content` sizes the panel to its content, and it shrinks
  // before `rest` does. `rest` takes the height that is left, at least the
  // height of the 진행 도구.
  readonly size?: 'content' | 'rest';
  readonly header?: ReactNode;
  readonly body?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  // NOTE(0913vision): A body whose content sizes itself from the body width
  // keeps room for the scrollbar, so a scrollbar that appears doesn't narrow
  // the content, which would make it shorter and hide the scrollbar again.
  readonly stableScrollbar?: boolean;
}

/** One workspace's panels: their titles by column, and each one's parts. */
export interface WorkspacePanels {
  readonly columns: ReadonlyArray<readonly string[]>;
  readonly partsOf: (title: string) => PanelParts;
}

/** Logs a panel problem when the workspace has no notification handler. */
export function logPanelProblem(notice: Notice): void {
  console.error('Workspace panel failed:', notice.key);
}

function sizedClass(
  base: string | undefined,
  size: PanelParts['size'],
): string {
  return classNames(
    base,
    size === 'content' && styles.content,
    size === 'rest' && styles.rest,
  );
}

/** One panel of a workspace column. */
export function Panel({
  title,
  parts,
}: {
  readonly title: string;
  readonly parts: PanelParts;
}): JSX.Element {
  if (parts.embedded) {
    return (
      <div className={sizedClass(styles.embedded, parts.size)}>
        {parts.embedded}
      </div>
    );
  }
  if (parts.bare) return <div className={styles.bare}>{parts.bare}</div>;
  return (
    <section
      className={sizedClass(styles.panel, parts.size)}
      aria-label={title}
    >
      <div className={styles.header}>
        {parts.header ?? <span className={styles.tab}>{title}</span>}
        {parts.meta}
        {parts.actions ? (
          <div className={styles.actions}>{parts.actions}</div>
        ) : null}
      </div>
      <div
        className={
          parts.stableScrollbar
            ? `${styles.body} ${styles.stableScrollbar}`
            : styles.body
        }
      >
        {parts.body}
      </div>
      {parts.footer ? (
        <div className={styles.footer}>{parts.footer}</div>
      ) : null}
    </section>
  );
}
