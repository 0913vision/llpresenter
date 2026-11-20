import {Fragment, useRef, useState} from 'react';
import {PreviewSizingContext} from '@renderer/ui/PreviewSizingContext';
import type {PanelRowId} from '@core/schema/panelRows';
import {ResizeGap} from '@renderer/ui/ResizeGap';
import {useRowLayout} from '@renderer/ui/useRowLayout';
import type {SizeClass} from '@renderer/ui/sizeClass';
import type {ColumnWidthStore} from './columnWidthStore';
import {Panel, type WorkspacePanels} from './WorkspacePanel';
import type {Workspace} from './Toolbar';
import styles from './Workspace.module.css';

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
    value: (store.loadRows?.(sizeClass)?.['show.previewRatio'] ?? 667) / 1000,
  }));
  const ratio =
    savedRatio.sizeClass === sizeClass
      ? savedRatio.value
      : (store.loadRows?.(sizeClass)?.['show.previewRatio'] ?? 667) / 1000;
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
                    save: value => {
                      setSavedRatio({sizeClass, value});
                      store.saveRows?.(sizeClass, {
                        'show.previewRatio': Math.round(value * 1000),
                      });
                    },
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
                if (workspace === 'show' && title === '미리보기') drag.reset();
              }}
              disabled={!drag.canResize(index)}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
