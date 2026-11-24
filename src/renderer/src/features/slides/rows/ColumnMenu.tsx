import {useState, type JSX} from 'react';
import type {ShowTile} from '@core/schema/services/showService';
import {boxesOf} from '@core/slides';
import {themeOf} from '@core/theme';
import {useThemes} from '@renderer/platform/documents/themes';
import {Button} from '@renderer/ui/buttons/Button';
import {Menu} from '@renderer/ui/menus/Menu';
import {menuButtonProps} from '@renderer/ui/menus/menuButton';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import {shownColumns, toggleColumn, useSlideColumns} from './slideColumns';

/** Chooses which texts of the slides have a column in the list. */
export function ColumnMenu({
  tiles,
}: {
  readonly tiles: readonly ShowTile[];
}): JSX.Element {
  const themes = useThemes(view => view.themes);
  const columns = useSlideColumns();
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const used = [...new Set(tiles.map(tile => tile.slide.theme))].flatMap(
    id => themeOf(themes, id) ?? [],
  );
  const entries = used.flatMap((theme): MenuEntry[] => {
    const shown = new Set(shownColumns(theme, columns));
    return [
      {kind: 'group', id: theme.id, label: theme.name},
      ...boxesOf(theme).map((box): MenuEntry => ({
        kind: 'item',
        id: `${theme.id}:${box}`,
        label: box,
        check: 'checkbox',
        checked: shown.has(box),
        keepsOpen: true,
        onSelect: () => toggleColumn(theme, box),
      })),
    ];
  });
  return (
    <>
      <Button
        ref={setTrigger}
        variant="ghost"
        disabled={used.length === 0}
        {...menuButtonProps({expanded: open, onExpandedChange: setOpen})}
      >
        열
      </Button>
      {open && trigger !== null ? (
        <Menu
          label="열"
          anchor={{kind: 'element', element: trigger}}
          entries={entries}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
