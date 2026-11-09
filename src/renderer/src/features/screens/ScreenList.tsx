import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {limitReason} from '@core/common/limitReason';
import {contextMenuTarget, openMenuFromKey} from '@renderer/ui/contextMenu';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {
  ListBox,
  ListDragGhost,
  ListGroup,
  ListRow,
  StatusDot,
} from '@renderer/ui';
import type {Screen} from '@core/schema/screens';
import {SCREEN_KIND_ORDER} from '@core/screens/screens';
import {sendLive, useOutputs} from '@renderer/session/live';
import type {Notice} from '@renderer/ui/notices';
import {MAX_TARGET_SCREENS} from '@core/schema/overlayState';
import {useScreenCreation} from './useScreenCreation';
import {ScreenGroupActions} from './ScreenGroupActions';
import {screenGroups, type ScreenRow} from '@core/screens/screenRows';
import {selectedScreenIn, useScreensSelection} from './selection';
import {useOutputStatuses} from './useOutputStatuses';
import {useSettingsDocument} from '../../platform/useSettingsDocument';
import {SCREEN_DRAG_MIME} from './screenDrag';
import styles from './ScreenList.module.css';
import {useDragClickGuard} from '@renderer/ui/useDragClickGuard';
import type {GroupRename} from '@renderer/ui/ListRow';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {useScreenRowActions} from './useScreenRowActions';
import {useScreenListWindow} from './useScreenListWindow';
import {useMonitors} from './useMonitors';

const LIST_LABEL = '화면';
const GROUP_LABELS = {audience: '청중', stage: '무대', broadcast: '방송'};
const LOAD_TITLE = '화면';
const noScreens: readonly Screen[] = [];

function RowView({
  row,
  canDrag,
  rename,
  onMenu,
}: {
  readonly row: ScreenRow;
  readonly canDrag: boolean;
  readonly rename: GroupRename | undefined;
  readonly onMenu: (id: string, anchor: MenuAnchor) => void;
}): JSX.Element {
  const ghost = useRef<HTMLDivElement>(null);
  return (
    <div
      draggable={canDrag && rename === undefined}
      onContextMenu={event => {
        event.preventDefault();
        onMenu(row.id, {
          kind: 'point',
          target: contextMenuTarget(event),
          point: {x: event.clientX, y: event.clientY},
        });
      }}
      onKeyDown={event => {
        openMenuFromKey(event, anchor => onMenu(row.id, anchor));
      }}
      onDragStart={event => {
        if (!canDrag || rename !== undefined) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(SCREEN_DRAG_MIME, row.id);
        if (ghost.current !== null) {
          event.dataTransfer.setDragImage(ghost.current, 0, 0);
        }
      }}
    >
      <div ref={ghost} className={styles.ghost} aria-hidden="true">
        <ListDragGhost icon={row.icon} title={row.name} />
      </div>
      <ListRow
        value={row.id}
        title={row.name}
        rename={rename}
        icon={row.icon}
        meta={row.target}
        reason={row.problem}
        end={
          row.health === 'none' ? undefined : (
            <StatusDot tone={row.health === 'ok' ? 'ok' : 'warning'} />
          )
        }
      />
    </div>
  );
}

/**
 * The 화면 list: the 청중 and 무대 groups, each row with its target and a
 * health dot. Selecting a row selects that screen for the editors beside it.
 */
export function ScreenList({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('screens', LOAD_TITLE, onProblem);
  const create = useScreenCreation(document, onProblem, screenId =>
    sendLive({type: 'output.set', screenId, on: true}),
  );
  const actions = useScreenRowActions(document, onProblem);
  const click = useDragClickGuard();
  const statuses = useOutputStatuses();
  const outputs = useOutputs();
  const monitors = useMonitors();
  const selection = useScreensSelection(view => view.selection);
  const select = useScreensSelection(view => view.select);
  const screens = document?.value.screens ?? noScreens;
  const groups = useMemo(
    () => screenGroups(screens, {statuses, outputs, monitors}),
    [screens, statuses, outputs, monitors],
  );
  const selected = selectedScreenIn(selection, screens)?.id;
  const sections = useMemo(
    () =>
      SCREEN_KIND_ORDER.map(kind => ({
        kind,
        label: GROUP_LABELS[kind],
        rows: groups[kind],
      })),
    [groups],
  );
  const listRoot = useRef<HTMLDivElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const selectScreen = useCallback((id: string) => select(id), [select]);
  const windowed = useScreenListWindow({
    root: listRoot,
    sections,
    selected,
    select: selectScreen,
  });
  const creationReason =
    document === null
      ? '설정을 불러오는 중'
      : document.access !== 'editable'
        ? NEWER_FILE_REASON
        : screens.length >= MAX_TARGET_SCREENS
          ? limitReason('화면', MAX_TARGET_SCREENS)
          : undefined;
  const groupOutputs = (kind: Screen['kind']) =>
    screens.filter(screen => screen.kind === kind && screen.method !== 'ndi');
  return (
    <div
      {...click.props}
      ref={listRoot}
      onKeyDownCapture={windowed.navigate}
      onFocusCapture={event => {
        const option = event.target.closest<HTMLElement>(
          '[role="option"][data-value]',
        );
        setFocusedId(option?.dataset['value'] ?? null);
      }}
      onBlurCapture={event => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setFocusedId(null);
        }
      }}
    >
      <ListBox
        label={LIST_LABEL}
        selected={selected}
        onSelect={id => select(id)}
      >
        {sections.map(section => {
          const outputsInGroup = groupOutputs(section.kind);
          const range = windowed.ranges[section.kind];
          const rows: ReactNode[] = [];
          let nextIndex = 0;
          section.rows.forEach((row, index) => {
            if (
              (index < range.start || index >= range.end) &&
              row.id !== focusedId
            ) {
              return;
            }
            if (index > nextIndex) {
              rows.push(
                <div
                  key={`gap:${index}`}
                  aria-hidden="true"
                  style={{
                    height: `calc(var(--size-row) * ${index - nextIndex})`,
                  }}
                />,
              );
            }
            rows.push(
              <RowView
                key={`row:${row.id}`}
                row={row}
                canDrag={document?.access === 'editable'}
                rename={actions.renameFor(row.id)}
                onMenu={actions.open}
              />,
            );
            nextIndex = index + 1;
          });
          if (nextIndex < section.rows.length) {
            rows.push(
              <div
                key="gap:end"
                aria-hidden="true"
                style={{
                  height: `calc(var(--size-row) * ${section.rows.length - nextIndex})`,
                }}
              />,
            );
          }
          return (
            <ListGroup
              key={section.label}
              label={section.label}
              actions={
                <ScreenGroupActions
                  kind={section.kind}
                  monitors={monitors}
                  label={section.label}
                  reason={creationReason}
                  outputReason={
                    outputsInGroup.length === 0 ? '화면 없음' : undefined
                  }
                  on={outputsInGroup.some(
                    screen => outputs[screen.id] === true,
                  )}
                  add={(kind, method, monitor) =>
                    create(kind, method, {
                      monitor,
                      groupOn: outputsInGroup.some(
                        screen => outputs[screen.id] === true,
                      ),
                    })
                  }
                  toggle={on =>
                    sendLive({
                      type: 'live.batch',
                      commands: outputsInGroup.map(screen => ({
                        type: 'output.set',
                        screenId: screen.id,
                        on,
                      })),
                    })
                  }
                />
              }
            >
              {section.rows.length === 0 ? (
                <div className={styles.empty}>화면 없음</div>
              ) : null}
              <div ref={element => windowed.setAnchor(section.kind, element)}>
                {rows}
              </div>
            </ListGroup>
          );
        })}
      </ListBox>
      {actions.overlays}
    </div>
  );
}
