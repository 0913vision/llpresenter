import {
  menuAvailability,
  type MenuEntry,
  type MenuItem,
} from '@renderer/ui/menus/menuModel';
import type {JSX} from 'react';
import type {MonitorInfo, MonitorList} from '@core/schema/screens/monitors';
import type {Screen} from '@core/schema/screens/screens';
import {Menu, type MenuProps} from '@renderer/ui/menus/Menu';
import type {NewScreen} from '../addScreen';
import {monitorPixelSize, pixelSizeText} from '../displaySizes';
import {displayLayout} from '../layout/layoutBoxes';
import {MonitorThumbnail} from '../layout/MonitorThumbnail';

/**
 * The menu for adding a screen: a row per monitor for a full screen one, then 새
 * 창 and 새 캡처 창; all are disabled with `reason` when it is given.
 */
export function screenAddMenuEntries({
  monitors,
  reason,
  add,
}: {
  readonly kind: Screen['kind'];
  readonly monitors: MonitorList;
  readonly reason: string | undefined;
  readonly add: (method: NewScreen['method'], monitor?: MonitorInfo) => void;
}): readonly MenuEntry[] {
  const layout = displayLayout(monitors, [], undefined);
  return [
    {kind: 'group', id: 'monitors', label: '모니터'},
    ...monitors.map((monitor): MenuItem => {
      const unavailable =
        reason ??
        (monitor.hasMainWindow
          ? '제어 화면에는 출력할 수 없습니다.'
          : monitor.id === undefined
            ? '모니터를 지정할 수 없습니다.'
            : undefined);
      return {
        kind: 'item',
        id: `monitor-${monitor.number}`,
        label: `모니터 ${monitor.number}`,
        meta: `(${pixelSizeText(monitorPixelSize(monitor))})`,
        preview: <MonitorThumbnail layout={layout} number={monitor.number} />,
        ...menuAvailability(unavailable),
        onSelect: () => add('fullscreen', monitor),
      };
    }),
    {kind: 'group', id: 'windows', label: '창'},
    {
      kind: 'item',
      id: 'window',
      label: '새 창',
      ...menuAvailability(reason),
      onSelect: () => add('window'),
    },
    {
      kind: 'item',
      id: 'capture',
      label: '새 캡처 창',
      ...menuAvailability(reason),
      onSelect: () => add('capture'),
    },
  ];
}

interface ScreenMenuActions {
  /** Why the screen can't be deleted, shown on the disabled 삭제 row. */
  readonly deleteReason: string | undefined;
  readonly on: boolean;
  readonly reason: string | undefined;
  readonly outputReason: string | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
  readonly toggle: () => void;
}

/** The context menu of a screen in the list, built from `actions`. */
export function screenMenuEntries(
  actions: ScreenMenuActions,
): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      ...menuAvailability(actions.reason),
      onSelect: actions.rename,
    },
    {
      kind: 'item',
      id: 'delete',
      contextGroup: 'delete',
      label: '삭제',
      ...menuAvailability(actions.reason ?? actions.deleteReason),
      onSelect: actions.remove,
    },
    {
      kind: 'item',
      id: 'toggle',
      contextGroup: 'hide',
      label: actions.on ? '사용 안 함' : '사용',
      ...menuAvailability(actions.outputReason),
      onSelect: actions.toggle,
    },
  ];
}

/** The context menu of a screen in the list, drawn from `actions`. */
export function ScreenContextMenu({
  actions,
  ...props
}: Omit<MenuProps, 'entries'> & {
  readonly actions: ScreenMenuActions;
}): JSX.Element {
  return <Menu context {...props} entries={screenMenuEntries(actions)} />;
}
