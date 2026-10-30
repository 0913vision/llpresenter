import type {JSX} from 'react';
import type {StageLayout} from '@core/schema/stageLayouts';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {menuSeparator} from '@renderer/ui/menuRows';
import styles from './StageLayoutPicker.module.css';

function LayoutThumbnail({
  layout,
}: {
  readonly layout: StageLayout;
}): JSX.Element {
  return (
    <svg
      className={styles.thumbnail}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      aria-hidden="true"
      focusable="false"
    >
      {layout.elements.map(element => (
        <rect
          key={element.id}
          x={element.frame.x}
          y={element.frame.y}
          width={element.frame.w}
          height={element.frame.h}
        />
      ))}
    </svg>
  );
}

/** The stage layout picker, with editing first and a preview for each layout. */
export function stageLayoutMenuEntries({
  layouts,
  value,
  onChange,
  onEdit,
}: {
  readonly layouts: readonly StageLayout[];
  readonly value: StageLayout['id'] | undefined;
  readonly onChange: (id: StageLayout['id']) => void;
  readonly onEdit: (() => void) | undefined;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'edit',
      label: '선택한 배치 편집…',
      disabled:
        onEdit === undefined || !layouts.some(layout => layout.id === value),
      onSelect: onEdit,
    },
    menuSeparator('layouts'),
    ...layouts.map((layout): MenuEntry => ({
      kind: 'item',
      id: layout.id,
      label: layout.name || '이름 없음',
      preview: <LayoutThumbnail layout={layout} />,
      check: 'radio',
      checked: layout.id === value,
      onSelect: () => onChange(layout.id),
    })),
  ];
}
