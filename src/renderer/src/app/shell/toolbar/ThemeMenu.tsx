import {useRef, useState, type JSX} from 'react';
import {Menu} from '@renderer/ui/menus/Menu';
import {ToolbarButton} from '@renderer/ui/buttons/ToolbarButton';
import {openOnArrowDown} from '@renderer/ui/menus/menuButton';
import type {Notice} from '@renderer/ui/popups/notices';
import {useThemes} from '@renderer/platform/documents/themes';
import {useWindowShortcuts} from '@renderer/platform/shortcuts/windowShortcuts';
import {useLive} from '@renderer/session/live';
import {sendThemeChange} from '@renderer/features/screens/outputMenu/themeActions';
import {
  liveThemeName,
  themeMenuEntries,
  themesLike,
} from '@renderer/features/screens/outputMenu/themeMenuEntries';
import styles from './Toolbar.module.css';

function logProblem(notice: Notice): void {
  console.error('Toolbar theme failed:', notice.key);
}

/** Shows the confirmed live theme and opens the theme workspace. */
export function ThemeMenu({
  compact,
  onProblem = logProblem,
  onEdit,
}: {
  readonly compact: boolean;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onEdit?: (() => void) | undefined;
}): JSX.Element {
  const button = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const themes = useThemes(view => view.themes);
  const current = useLive(view => view.state?.themeOutput?.theme);
  const name = liveThemeName(current);
  const open = anchor !== null;
  const disabled = window.llp === undefined;
  const openMenu = (): void => {
    if (!disabled) setAnchor(button.current);
  };
  useWindowShortcuts([{id: 'theme.menu', run: openMenu}]);
  return (
    <>
      <ToolbarButton
        className={styles.theme}
        ref={button}
        icon="layers"
        label={name}
        aria-label={`테마: ${name}`}
        title="테마 바꾸기"
        compact={compact}
        menu
        expanded={open}
        disabled={disabled}
        aria-busy={themes === null}
        onClick={event => setAnchor(open ? null : event.currentTarget)}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: open,
            disabled,
            onExpandedChange: next =>
              setAnchor(next ? event.currentTarget : null),
          })
        }
      />
      {anchor ? (
        <Menu
          label="테마 바꾸기"
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={themeMenuEntries({
            themes: themesLike(themes, current),
            current: current?.id,
            choose: themeId => sendThemeChange(themeId, onProblem),
            edit: onEdit,
          })}
        />
      ) : null}
    </>
  );
}
