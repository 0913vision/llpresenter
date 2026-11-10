import {usePaletteEditing} from './PaletteEditing';
import {useState, type ReactNode} from 'react';
import {Panel, PanelHeader, PanelTabs, PanelBody} from '@renderer/ui/Panel';
import {Icon} from '@renderer/ui/Icon';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {contextMenuAnchor, openMenuFromKey} from '@renderer/ui/contextMenu';
import {
  ELEMENT_DRAG_MIME,
  PREP_PALETTE_LABEL,
  ORDER_ELEMENTS,
  PALETTE_SECTIONS,
} from './paletteItems';
import {usePaletteInsert} from './usePaletteInsert';
import styles from './PrepPalette.module.css';

export function PrepPalette({
  library,
  tab,
  onTabChange,
  navigating = false,
}: {
  readonly library: ReactNode;
  readonly tab: 'elements' | 'songs';
  readonly onTabChange: (tab: 'elements' | 'songs') => void;
  readonly navigating?: boolean;
}) {
  const [menu, setMenu] = useState<{id: string; anchor: MenuAnchor} | null>(
    null,
  );
  const editing = usePaletteEditing();
  const palette = usePaletteInsert(editing);
  const button = (id: string, label: string, icon?: string) => (
    <button
      type="button"
      key={id}
      className={icon ? styles.row : styles.chip}
      title={label}
      disabled={palette.disabled}
      draggable={!palette.disabled}
      onDragStart={event => {
        event.dataTransfer.setData(ELEMENT_DRAG_MIME, id);
        event.dataTransfer.effectAllowed = 'copy';
      }}
      onDoubleClick={() => palette.insert(id)}
      onContextMenu={event => {
        if (id !== 'creed' && id !== 'prayer') return;
        event.preventDefault();
        setMenu({id, anchor: contextMenuAnchor(event)});
      }}
      onKeyDown={event => {
        if (
          (id === 'creed' || id === 'prayer') &&
          openMenuFromKey(event, anchor => setMenu({id, anchor}))
        ) {
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          palette.insert(id);
        }
      }}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{label}</span>
    </button>
  );
  return (
    <Panel label={PREP_PALETTE_LABEL} className={styles.panel}>
      {!navigating ? (
        <PanelHeader>
          <PanelTabs
            tabs={[
              {value: 'elements', label: '예배 요소'},
              {value: 'songs', label: '곡'},
            ]}
            value={tab}
            onChange={onTabChange}
          />
        </PanelHeader>
      ) : null}
      {!navigating && tab === 'elements' ? (
        <PanelBody tab="elements" variant="flush" className={styles.body}>
          <div className={styles.group}>순서</div>
          {ORDER_ELEMENTS.map(item => button(item.id, item.label, item.icon))}
          <div className={styles.group}>구역 이름</div>
          <div className={styles.chips}>
            {PALETTE_SECTIONS.map(section =>
              button(`card:${section.name}`, section.name),
            )}
          </div>
        </PanelBody>
      ) : null}
      <div
        className={styles.libraryHost}
        hidden={!navigating && tab !== 'songs'}
      >
        <PanelBody
          tab={navigating ? undefined : 'songs'}
          variant="flush"
          className={styles.library}
        >
          {library}
        </PanelBody>
      </div>
      {menu ? (
        <Menu
          context
          label="번역 선택"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={['새 번역', '옛 번역'].map((label, index) => ({
            kind: 'item',
            id: `translation:${index}`,
            label,
            onSelect: () => {
              palette.insert(menu.id, undefined, index === 0 ? 'new' : 'old');
              setMenu(null);
            },
          }))}
        />
      ) : null}
      {palette.dialog}
    </Panel>
  );
}
