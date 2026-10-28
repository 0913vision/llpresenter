import {useState, type JSX} from 'react';
import type {Screen} from '@shared/schema/screens';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu} from '@renderer/ui/Menu';
import {menuButtonProps} from '@renderer/ui/menuButton';
import {hasModifier} from '@renderer/ui/modifierKeys';
import type {NewScreen} from './addScreen';
import styles from './ScreenList.module.css';

const METHODS: ReadonlyArray<{method: NewScreen['method']; label: string}> = [
  {method: 'fullscreen', label: '전체 화면'},
  {method: 'window', label: '창'},
  {method: 'capture', label: '캡처 창'},
];

/** Screen Configuration group controls for local System outputs. */
export function ScreenGroupActions({
  kind,
  label,
  reason,
  outputReason,
  on,
  add,
  toggle,
}: {
  readonly kind: Screen['kind'];
  readonly label: string;
  readonly reason: string | undefined;
  readonly outputReason: string | undefined;
  readonly on: boolean;
  readonly add: (kind: Screen['kind'], method: NewScreen['method']) => void;
  readonly toggle: (on: boolean) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const open = anchor !== null;
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const changeOpen = (next: boolean): void => {
    setAnchor(next ? button : null);
  };
  return (
    <div
      className={styles.actions}
      onKeyDown={event => {
        if (
          !hasModifier(event) &&
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
        ) {
          event.stopPropagation();
        }
      }}
    >
      <IconButton
        icon="mplay"
        label={`${label} 출력`}
        size="sm"
        pressed={on}
        disabled={outputReason !== undefined}
        title={
          outputReason ??
          (on
            ? `${label} 시스템 화면 모두 끄기`
            : `${label} 시스템 화면 모두 켜기`)
        }
        onPressedChange={toggle}
      />
      <IconButton
        ref={setButton}
        icon="plus"
        label={`새 ${label} 화면`}
        size="sm"
        menu
        expanded={open}
        disabled={reason !== undefined}
        title={reason}
        {...menuButtonProps({
          expanded: open,
          onExpandedChange: changeOpen,
          disabled: reason !== undefined,
        })}
      />
      {anchor !== null ? (
        <Menu
          label={`${label} 화면 추가`}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={METHODS.map(({method, label}) => ({
            kind: 'item',
            id: method,
            label,
            disabled: reason !== undefined,
            title: reason,
            onSelect: () => add(kind, method),
          }))}
        />
      ) : null}
    </div>
  );
}
