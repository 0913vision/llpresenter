import type {JSX} from 'react';
import type {ServiceItem} from '@core/schema/service';
import type {ThemesFile} from '@core/schema/themes';
import type {ThemeId} from '@core/schema/ids';
import {itemThemeCell} from '@core/themes/itemThemeCell';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {themeRequest} from '../items/itemAppearanceCommands';
import type {ItemTarget, ServiceItemStore} from '../items/serviceItemStore';
import {CellMenu} from './CellMenu';
import styles from './ServiceTable.module.css';

const DEFAULT_THEME = '기본';
const DEFAULT_THEME_ID = 'default';

function themeEntries({
  item,
  followsDefault,
  themes,
  choose,
}: {
  readonly item: ServiceItem;
  readonly followsDefault: boolean;
  readonly themes: ThemesFile | null;
  readonly choose: (theme: ThemeId | undefined) => void;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: DEFAULT_THEME_ID,
      label: DEFAULT_THEME,
      check: 'radio',
      checked: followsDefault,
      onSelect: () => choose(undefined),
    },
    ...(themes?.themes ?? []).map((theme): MenuEntry => ({
      kind: 'item',
      id: theme.id,
      label: theme.name,
      check: 'radio',
      checked: !followsDefault && item.theme === theme.id,
      onSelect: () => choose(theme.id),
    })),
  ];
}

/** The same item theme choices in the order and the song design ribbon. */
export function ThemeCell({
  item,
  themes,
  target,
  items,
  label,
  reason,
  presentation = 'cell',
}: {
  readonly item: ServiceItem;
  readonly themes: ThemesFile | null;
  readonly target: ItemTarget | null;
  readonly items: Pick<ServiceItemStore, 'submitItemEdit'>;
  readonly label: string;
  readonly reason: string | undefined;
  readonly presentation?: 'cell' | 'ribbon';
}): JSX.Element {
  const theme = itemThemeCell(item, themes);
  if (theme === undefined) {
    return <span className={`${styles.cell} ${styles.theme}`} />;
  }
  return (
    <CellMenu
      label={label}
      text={theme.name}
      dim={theme.followsDefault}
      width={styles.theme}
      reason={reason}
      hint={presentation === 'ribbon' ? theme.name : undefined}
      presentation={presentation}
      entries={themeEntries({
        item,
        followsDefault: theme.followsDefault,
        themes,
        choose: value =>
          editorTask(items.submitItemEdit(themeRequest(target, value))),
      })}
    />
  );
}
