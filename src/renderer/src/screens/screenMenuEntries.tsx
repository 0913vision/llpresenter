import type {JSX} from 'react';
import type {MonitorInfo, MonitorList} from '@shared/schema/monitors';
import type {Screen} from '@shared/schema/screens';
import {Menu, type MenuProps} from '@renderer/ui/Menu';
import type {MenuEntry, MenuItem} from '@renderer/ui/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menuRows';
import type {NewScreen} from './addScreen';
import {monitorPixelSize, sizeText} from './displaySizes';
import {displayLayout} from './layoutBoxes';
import {MonitorThumbnail} from './MonitorThumbnail';

export function screenAddMenuEntries({
  kind,
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
          ? '컨트롤 화면에는 출력할 수 없음'
          : monitor.id === undefined
            ? '모니터를 지정할 수 없음'
            : undefined);
      return {
        kind: 'item',
        id: `monitor-${monitor.number}`,
        label: `모니터 ${monitor.number}`,
        meta: `(${sizeText(monitorPixelSize(monitor))})`,
        preview: <MonitorThumbnail layout={layout} number={monitor.number} />,
        disabled: unavailable !== undefined,
        title: unavailable,
        onSelect: () => add('fullscreen', monitor),
      };
    }),
    {kind: 'group', id: 'windows', label: '창'},
    {
      kind: 'item',
      id: 'window',
      label: '새 창',
      disabled: reason !== undefined,
      title: reason,
      onSelect: () => add('window'),
    },
    {
      kind: 'item',
      id: 'capture',
      label: '새 캡처 창',
      disabled: reason !== undefined,
      title: reason,
      onSelect: () => add('capture'),
    },
    {kind: 'group', id: 'ndi', label: 'NDI'},
    laterRow('new-ndi', '새 NDI', {submenu: true}),
    {kind: 'group', id: 'placeholder', label: '자리 표시'},
    laterRow('new-placeholder', '새 자리 표시', {submenu: true}),
    ...(kind === 'audience'
      ? [
          menuSeparator('composite-separator'),
          laterRow('grouped', '묶음…'),
          laterRow('edge-blend', '가장자리 합성…'),
        ]
      : []),
  ];
}

interface ScreenMenuActions {
  readonly canDelete: boolean;
  readonly on: boolean;
  readonly reason: string | undefined;
  readonly outputReason: string | undefined;
  readonly rename: () => void;
  readonly remove: () => void;
  readonly toggle: () => void;
}

export function screenMenuEntries(
  actions: ScreenMenuActions,
): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'rename',
      label: '이름 바꾸기',
      disabled: actions.reason !== undefined,
      title: actions.reason,
      onSelect: actions.rename,
    },
    ...(actions.canDelete
      ? [
          {
            kind: 'item',
            id: 'delete',
            label: '삭제',
            disabled: actions.reason !== undefined,
            title: actions.reason,
            onSelect: actions.remove,
          } as const,
        ]
      : []),
    {
      kind: 'item',
      id: 'toggle',
      label: actions.on ? '사용 안 함' : '사용',
      disabled: actions.outputReason !== undefined,
      title: actions.outputReason,
      onSelect: actions.toggle,
    },
  ];
}

export function ScreenContextMenu({
  actions,
  ...props
}: Omit<MenuProps, 'entries'> & {
  readonly actions: ScreenMenuActions;
}): JSX.Element {
  return <Menu {...props} entries={screenMenuEntries(actions)} />;
}
