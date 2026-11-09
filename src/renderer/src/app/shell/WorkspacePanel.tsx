import type {JSX, ReactNode} from 'react';
import type {PanelRowId} from '@core/schema/panelRows';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/notices';
import styles from './Workspace.module.css';

/** What a panel shows, by part. A workspace fills only the parts it needs. */
export interface PanelParts {
  readonly embedded?: ReactNode;
  // NOTE(0913vision): `bare` draws its content without the panel around it,
  // as the 지우기 row does.
  readonly bare?: ReactNode;
  // NOTE(0913vision): `content` sizes the panel to its content and never
  // shrinks; `fit` sizes it to its content too, but shrinks before `rest` does,
  // so the picture inside gets smaller instead of the 진행 도구 panel. `rest` keeps
  // the height of the 진행 도구 and never grows or shrinks, so a fold of the
  // 미디어 panel does not resize it. `list` keeps the height of one full row of
  // 슬라이드 with their 오버레이 clips, and `settings` takes what is left but
  // never less than a few rows, so the panel below the slides is the one that
  // scrolls.
  readonly size?: 'content' | 'fit' | 'rest' | 'list' | 'settings';
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
    size === 'fit' && styles.fit,
    size === 'rest' && styles.rest,
    size === 'list' && styles.list,
    size === 'settings' && styles.settings,
  );
}

/** One panel of a workspace column. */
export function Panel({
  title,
  parts,
  rowId,
  editorEscapeZone = false,
}: {
  readonly title: string;
  readonly parts: PanelParts;
  readonly rowId?: PanelRowId | undefined;
  readonly editorEscapeZone?: boolean | undefined;
}): JSX.Element {
  if (parts.embedded) {
    return (
      <div
        data-panel={title}
        data-editor-escape-zone={editorEscapeZone ? '' : undefined}
        data-resize-panel={rowId ?? ''}
        className={sizedClass(styles.embedded, parts.size)}
      >
        {parts.embedded}
      </div>
    );
  }
  if (parts.bare) {
    return (
      <div
        data-panel={title}
        data-editor-escape-zone={editorEscapeZone ? '' : undefined}
        data-resize-panel=""
        data-resize-fixed
        className={styles.bare}
      >
        {parts.bare}
      </div>
    );
  }
  return (
    <section
      data-panel={title}
      data-editor-escape-zone={editorEscapeZone ? '' : undefined}
      data-resize-panel={rowId ?? ''}
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
      {parts.footer}
    </section>
  );
}
