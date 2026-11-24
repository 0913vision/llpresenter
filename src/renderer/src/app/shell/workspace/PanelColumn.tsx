import {Fragment, useRef, useState} from 'react';
import {PreviewSizingContext} from '@renderer/ui/previews/PreviewSizingContext';
import type {PanelRowId} from '@core/schema/app/panelRows';
import {ResizeGap} from '@renderer/ui/panels/ResizeGap';
import {useRowLayout} from '@renderer/ui/lists/useRowLayout';
import {
  clampPreviewRatio,
  DEFAULT_PREVIEW_RATIO,
} from '@renderer/ui/previews/previewRatio';
import type {SizeClass} from '@renderer/ui/panels/sizeClass';
import type {ColumnWidthStore} from '../columns/columnWidthStore';
import {Panel, type WorkspacePanels} from './WorkspacePanel';
import styles from './Workspace.module.css';
import type {Workspace} from '../../../platform/WorkspaceNavigation';

function rowId(
  workspace: Workspace,
  title: string,
  draft: boolean,
): PanelRowId | undefined {
  if (workspace === 'show') {
    if (title === '예배 순서') return 'show.order';
    if (title === '빠른 실행') return 'show.quick';
    if (title === '미리보기') return 'show.preview';
    if (title === '진행 도구') return 'show.tools';
  }
  if (workspace === 'prep') {
    if (title === '미리보기') return draft ? 'draft.preview' : 'prep.preview';
    if (title === '슬라이드') return draft ? 'draft.slides' : 'prep.slides';
    if (title === '항목 설정') return 'prep.settings';
  }
  return undefined;
}

/** A workspace column with shared drag borders between its stacked panels. */
export function PanelColumn({
  workspace,
  titles,
  partsOf,
  store,
  sizeClass,
  draft,
  warningHeight,
}: {
  readonly workspace: Workspace;
  readonly titles: readonly string[];
  readonly partsOf: WorkspacePanels['partsOf'];
  readonly store: ColumnWidthStore;
  readonly sizeClass: SizeClass;
  readonly draft: boolean;
  readonly warningHeight: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [savedRatio, setSavedRatio] = useState(() => ({
    sizeClass,
    value: clampPreviewRatio(
      (store.loadRows?.(sizeClass)?.['show.previewRatio'] ?? 667) / 1000,
    ),
  }));
  const ratio =
    savedRatio.sizeClass === sizeClass
      ? savedRatio.value
      : clampPreviewRatio(
          (store.loadRows?.(sizeClass)?.['show.previewRatio'] ?? 667) / 1000,
        );
  const savePreviewRatio = (value: number): void => {
    const safe = clampPreviewRatio(value);
    setSavedRatio({sizeClass, value: safe});
    store.saveRows?.(sizeClass, {'show.previewRatio': Math.round(safe * 1000)});
  };
  const drag = useRowLayout({
    container,
    store,
    sizeClass,
    layoutKey: `${workspace}:${titles.join()}`,
    fill: workspace === 'show' && titles[0] === '예배 순서' ? 'first' : 'last',
    preserveCollapsed: workspace === 'show' && titles[0] === '미리보기',
  });
  return (
    <div
      ref={container}
      className={styles.column}
      style={
        warningHeight > 0
          ? {paddingTop: `calc(${warningHeight}px + var(--panel-gap))`}
          : undefined
      }
    >
      {titles.map((title, index) => (
        <Fragment key={title}>
          <PreviewSizingContext.Provider
            value={
              workspace === 'show' && title === '미리보기'
                ? {
                    ratio,
                    save: savePreviewRatio,
                  }
                : null
            }
          >
            <Panel
              title={title}
              parts={partsOf(title)}
              rowId={rowId(workspace, title, draft)}
              editorEscapeZone={workspace === 'prep' && draft}
            />
          </PreviewSizingContext.Provider>
          {index < titles.length - 1 ? (
            <ResizeGap
              axis="row"
              name={`${workspace}.${title}`}
              begin={() => drag.begin(index)}
              onReset={() => {
                if (workspace === 'show' && title === '미리보기') {
                  drag.reset();
                  savePreviewRatio(DEFAULT_PREVIEW_RATIO);
                }
              }}
              disabled={!drag.canResize(index)}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
