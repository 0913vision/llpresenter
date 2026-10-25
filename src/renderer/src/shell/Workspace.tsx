import {Fragment, useSyncExternalStore, type JSX, type ReactNode} from 'react';
import type {LlpApi} from '@shared/ipc';
import {LibraryPanel} from '@renderer/prep/library/LibraryPanel';
import {SongEditor, type SongEditorStore} from '@renderer/prep/editor';
import {ClearRow} from '@renderer/show/ClearRow';
import {PreviewPanel} from '@renderer/show/PreviewPanel';
import {ServiceOrderHeader} from '@renderer/show/ServiceOrderHeader';
import {ServiceOrderList} from '@renderer/show/ServiceOrderList';
import {SongBackgroundControl} from '@renderer/show/SongBackgroundControl';
import {ReadOnlyMark} from '@renderer/show/ReadOnlyMark';
import {
  SlidePanelBody,
  SlidePanelMeta,
  SlideSizeControl,
} from '@renderer/show/SlidePanel';
import {useShowKeys} from '@renderer/show/shortcuts';
import type {Notice} from '@renderer/ui/notices';
import {ColumnGap} from './ColumnGap';
import type {ColumnWidthStore} from './columnWidthStore';
import type {SizeClass} from './sizeClass';
import type {Workspace as WorkspaceId} from './Toolbar';
import {useColumnLayout} from './useColumnLayout';
import styles from './Workspace.module.css';

type ColumnPanels = readonly string[];

const panelsByWorkspace: Readonly<
  Record<WorkspaceId, readonly [ColumnPanels, ColumnPanels, ColumnPanels]>
> = {
  show: [
    ['예배 순서', '퀵 실행'],
    ['슬라이드', '미디어'],
    ['미리보기', '지우기', '진행 도구'],
  ],
  prep: [['예배 순서', '라이브러리'], ['편집'], ['항목 설정']],
  screens: [['화면'], ['배치'], ['속성']],
};

interface PanelParts {
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
  readonly footer?: ReactNode;
  // NOTE(0913vision): A body whose content sizes itself from the body width
  // keeps room for the scrollbar, so a scrollbar that appears doesn't narrow
  // the content, which would make it shorter and hide the scrollbar again.
  readonly stableScrollbar?: boolean;
}

function panelClass(size: PanelParts['size']): string {
  if (size === 'content') return `${styles.panel} ${styles.content}`;
  if (size === 'rest') return `${styles.panel} ${styles.rest}`;
  return `${styles.panel}`;
}

function Panel({
  title,
  parts,
}: {
  readonly title: string;
  readonly parts: PanelParts;
}): JSX.Element {
  if (parts.embedded) {
    return <div className={styles.embedded}>{parts.embedded}</div>;
  }
  if (parts.bare) return <div className={styles.bare}>{parts.bare}</div>;
  return (
    <section className={panelClass(parts.size)} aria-label={title}>
      <div className={styles.header}>
        {parts.header ?? <span className={styles.tab}>{title}</span>}
        {parts.meta}
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

function ShowShortcuts(): null {
  useShowKeys();
  return null;
}

function showPanelParts(
  title: string,
  sizeClass: SizeClass,
  onProblem: ((notice: Notice) => void) | undefined,
): PanelParts {
  switch (title) {
    case '미리보기':
      return {
        size: 'content',
        body: <PreviewPanel compact={sizeClass === 'narrow'} />,
      };
    case '진행 도구':
      return {size: 'rest'};
    case '지우기':
      return {bare: <ClearRow compact={sizeClass === 'narrow'} />};
    case '슬라이드':
      return {
        body: <SlidePanelBody sizeClass={sizeClass} />,
        meta: (
          <>
            <SlidePanelMeta />
            <SongBackgroundControl onProblem={onProblem} />
          </>
        ),
        footer: <SlideSizeControl sizeClass={sizeClass} />,
        stableScrollbar: true,
      };
    default:
      return {};
  }
}

interface PrepBinding {
  readonly api: LlpApi;
  readonly editor: SongEditorStore;
}

const noSubscribe = (): (() => void) => () => undefined;
const ignoreProblem = (): void => undefined;

function prepPanelParts({
  title,
  prep,
  onProblem,
}: {
  readonly title: string;
  readonly prep: PrepBinding | undefined;
  readonly onProblem: ((notice: Notice) => void) | undefined;
}): PanelParts {
  if (!prep) return {};
  if (title === '라이브러리') {
    return {
      embedded: (
        <LibraryPanel
          api={prep.api}
          onProblem={onProblem ?? ignoreProblem}
          onOpenSong={selection => {
            prep.editor.open(selection.document, {
              focusTitle: selection.focusTitle,
            });
          }}
        />
      ),
    };
  }
  if (title === '편집') return {body: <SongEditor store={prep.editor} />};
  return {};
}

/** The three-column frame shared by all workspaces. */
export function Workspace({
  id,
  sizeClass,
  store,
  onProblem,
  onOpenPrep,
  prep,
  warningHeight = 0,
}: {
  readonly id: WorkspaceId;
  readonly sizeClass: SizeClass;
  readonly store: ColumnWidthStore;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
  readonly prep?: PrepBinding | undefined;
  readonly warningHeight?: number;
}): JSX.Element {
  const {gridRef, drag} = useColumnLayout(sizeClass, store);
  const hasSong = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => Boolean(prep?.editor.getSnapshot().session),
  );
  const columns =
    id === 'prep' && hasSong
      ? [['예배 순서', '라이브러리'], ['편집'], ['미리보기', '슬라이드']]
      : panelsByWorkspace[id];
  return (
    <main ref={gridRef} className={styles.columns}>
      {id === 'show' ? <ShowShortcuts /> : null}
      {columns.map((panels, column) => (
        <Fragment key={column}>
          {column > 0 && (
            <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
          )}
          <div
            className={styles.column}
            style={
              column === 2 && warningHeight > 0
                ? {paddingTop: `calc(${warningHeight}px + var(--panel-gap))`}
                : undefined
            }
          >
            {panels.map(title => (
              <Panel
                key={title}
                title={title}
                parts={
                  title === '예배 순서' && id !== 'screens'
                    ? {
                        header: <ServiceOrderHeader onProblem={onProblem} />,
                        body: (
                          <ServiceOrderList
                            workspace={id}
                            onProblem={onProblem}
                            onOpenPrep={onOpenPrep}
                            onOpenItem={
                              id === 'prep'
                                ? () => prep?.editor.open(null)
                                : undefined
                            }
                          />
                        ),
                        meta: <ReadOnlyMark />,
                      }
                    : id === 'show'
                      ? showPanelParts(title, sizeClass, onProblem)
                      : prepPanelParts({title, prep, onProblem})
                }
              />
            ))}
          </div>
        </Fragment>
      ))}
    </main>
  );
}
