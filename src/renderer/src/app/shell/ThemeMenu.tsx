import {useRef, useState, type JSX} from 'react';
import {Menu, ToolbarButton} from '@renderer/ui';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import type {Notice} from '@renderer/ui/notices';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useLive} from '@renderer/session/live';
import {sendThemeChange} from '@renderer/features/screens/themeActions';
import {liveThemeName, themeMenuEntries} from './themeMenuEntries';
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
  const document = useSettingsDocument('themes', '테마', onProblem);
  const currentId = useLive(view => view.state?.themeOutput?.themeId);
  const file = document?.value;
  const name = liveThemeName(file, currentId);
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
        aria-label={`테마 바꾸기: ${name}`}
        title="테마 바꾸기"
        compact={compact}
        menu
        expanded={open}
        disabled={disabled}
        aria-busy={file === undefined}
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
            themes: file?.themes ?? [],
            current: currentId,
            choose: themeId => sendThemeChange(themeId, onProblem),
            edit: onEdit,
          })}
        />
      ) : null}
    </>
  );
}
