import {useState, type JSX} from 'react';
import type {MacroActionKind} from '@core/schema/macros';
import {Button, IconButton, TextField} from '@renderer/ui';
import {MACRO_ACTION_MIME, searchMacroPalette} from './macroPaletteCatalog';
import styles from './MacroPalette.module.css';

export function MacroPalette({
  onChoose,
  onClose,
}: {
  readonly onChoose: (kind: MacroActionKind) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const groups = searchMacroPalette(query);
  return (
    <section aria-label="동작 팔레트" className={styles.root}>
      <div className={styles.header}>
        <strong>동작 팔레트</strong>
        <IconButton icon="x" label="동작 팔레트 닫기" onClick={onClose} />
      </div>
      <TextField
        aria-label="동작 찾기"
        placeholder="동작 찾기"
        value={query}
        onChange={setQuery}
        block
        clearable
      />
      {groups.map(group => (
        <section
          key={group.label}
          aria-label={group.label}
          className={styles.group}
        >
          <strong>{group.label}</strong>
          {group.actions.map(action => (
            <Button
              key={action.kind}
              variant="ghost"
              draggable
              onDragStart={event => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData(MACRO_ACTION_MIME, action.kind);
              }}
              onClick={() => onChoose(action.kind)}
            >
              {action.label}
            </Button>
          ))}
        </section>
      ))}
    </section>
  );
}
