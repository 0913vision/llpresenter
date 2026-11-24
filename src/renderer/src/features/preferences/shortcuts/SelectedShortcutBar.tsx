import type {JSX} from 'react';
import {Button} from '@renderer/ui/buttons/Button';
import {KeyCombo, KeyList} from '@renderer/ui/keys/KeyCap';
import {keysOf} from './CommandRow';
import {CLEAR_BUTTON_LABEL, RESET_LABEL} from './shortcutRowMenu';
import type {ShortcutCommand} from '@core/shortcuts';
import type {ShortcutRow} from './shortcutsModel';
import styles from './ShortcutsPage.module.css';

const NO_DEFAULT = '기본값 없음';

/** The bar under the 단축키 list: the chosen command, its default keys, and its buttons. */
export function SelectedShortcutBar({
  row: selected,
  lockedReason,
  onReset,
  onClear,
}: {
  readonly row: ShortcutRow | undefined;
  readonly lockedReason: string | undefined;
  readonly onReset: (id: string) => void;
  readonly onClear: (command: ShortcutCommand) => void;
}): JSX.Element {
  const locked = lockedReason !== undefined;
  return (
    <footer className={styles.bar}>
      {selected === undefined ? null : (
        <>
          <span className={styles.barName}>{selected.command.name}</span>
          <span className={styles.barDefault}>
            {selected.command.defaults.length === 0 ? (
              NO_DEFAULT
            ) : (
              <>
                기본값
                <KeyList>
                  {selected.command.defaults.map(binding => (
                    <KeyCombo
                      key={keysOf(binding).join('+')}
                      keys={keysOf(binding)}
                    />
                  ))}
                </KeyList>
              </>
            )}
          </span>
          <Button
            disabled={locked || !selected.changed}
            title={lockedReason}
            onClick={() => onReset(selected.command.id)}
          >
            {RESET_LABEL}
          </Button>
          <Button
            disabled={locked || selected.bindings.length === 0}
            title={lockedReason}
            onClick={() => onClear(selected.command)}
          >
            {CLEAR_BUTTON_LABEL}
          </Button>
        </>
      )}
    </footer>
  );
}
