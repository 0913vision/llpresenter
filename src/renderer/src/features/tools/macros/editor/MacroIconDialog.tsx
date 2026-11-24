import {useRef, useState, type JSX, type KeyboardEvent} from 'react';
import {Dialog} from '@renderer/ui/popups/Dialog';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import styles from './MacroIconDialog.module.css';

const names = Object.keys(import.meta.glob('../../../../ui/icons/*.svg'))
  .map(path => path.slice(path.lastIndexOf('/') + 1, -4))
  .sort();
const columns = 8;

export function MacroIconDialog({
  value,
  locked,
  close,
  save,
}: {
  readonly value: string;
  readonly locked: boolean;
  readonly close: () => void;
  readonly save: (icon: string) => void;
}): JSX.Element {
  const [focused, setFocused] = useState(Math.max(0, names.indexOf(value)));
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const move = (event: KeyboardEvent, index: number): void => {
    const step =
      event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowDown'
            ? columns
            : event.key === 'ArrowUp'
              ? -columns
              : 0;
    if (
      !step ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    const next = Math.max(0, Math.min(names.length - 1, index + step));
    setFocused(next);
    buttons.current[next]?.focus();
  };
  return (
    <Dialog
      title={'아이콘 바꾸기'}
      size="s"
      onCancel={close}
      primary={{label: '닫기', onSelect: close}}
    >
      <div className={styles.grid} role="group" aria-label={'아이콘'}>
        {names.map((name, index) => (
          <IconButton
            key={name}
            ref={element => {
              buttons.current[index] = element;
            }}
            icon={name}
            label={`아이콘 ${name}`}
            pressed={name === value}
            disabled={locked}
            tabIndex={index === focused ? 0 : -1}
            onFocus={() => setFocused(index)}
            onKeyDown={event => move(event, index)}
            onClick={() => save(name)}
          />
        ))}
      </div>
    </Dialog>
  );
}
