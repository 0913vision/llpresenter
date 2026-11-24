import {useState, type JSX} from 'react';
import type {SavedTitle} from '@core/schema/screens/themes';
import {useThemes} from '@renderer/platform/themes';
import {Dialog, DialogField} from '@renderer/ui/popups/Dialog';
import {TextField} from '@renderer/ui/fields/TextField';
import {Menu, type MenuAnchor} from '@renderer/ui/menus/Menu';
import {
  contextMenuAnchor,
  openMenuFromKey,
} from '@renderer/ui/menus/contextMenu';
import {editorTask} from '@renderer/platform/editorTask';
import {ELEMENT_DRAG_MIME, ownTitleKey} from './newItems';
import styles from './PrepPalette.module.css';

const NO_TITLES: readonly SavedTitle[] = [];

/** The titles the operator keeps, stored with the themes. */
export function OwnTitles({
  disabled,
  insert,
}: {
  readonly disabled: boolean;
  readonly insert: (key: string) => void;
}): JSX.Element {
  const ready = useThemes(view => view.themes !== null);
  const sections = useThemes(view => view.themes?.titles ?? NO_TITLES);
  const [editing, setEditing] = useState<SavedTitle | null>(null);
  const [menu, setMenu] = useState<{
    section: SavedTitle;
    anchor: MenuAnchor;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (
    section: SavedTitle | null,
    id: string,
  ): Promise<void> => {
    const api = window.llp;
    if (api === undefined || busy) return;
    setBusy(true);
    setError('');
    try {
      const latest = await api.settings.get({name: 'themes'});
      if (latest.name !== 'themes') throw new Error('Unexpected settings');
      const current = latest.value.titles;
      const next =
        section === null
          ? current.filter(entry => entry.id !== id)
          : current.some(entry => entry.id === id)
            ? current.map(entry => (entry.id === id ? section : entry))
            : [...current, section];
      const result = await api.settings.edit({
        type: 'settings.update',
        name: 'themes',
        baseRevision: latest.revision,
        value: {...latest.value, titles: next},
      });
      if (!result.ok) throw new Error(result.error.message);
      setEditing(null);
      setMenu(null);
    } catch {
      setError('타이틀을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {sections.map(section => (
        <button
          key={section.id}
          type="button"
          className={styles.chip}
          aria-disabled={disabled}
          draggable={!disabled}
          onDragStart={event => {
            event.dataTransfer.setData(
              ELEMENT_DRAG_MIME,
              ownTitleKey(section.id),
            );
            event.dataTransfer.effectAllowed = 'copy';
          }}
          onDoubleClick={() => {
            if (!disabled) insert(ownTitleKey(section.id));
          }}
          onContextMenu={event => {
            event.preventDefault();
            setMenu({section, anchor: contextMenuAnchor(event)});
          }}
          onKeyDown={event => {
            if (openMenuFromKey(event, anchor => setMenu({section, anchor}))) {
              return;
            }
            if (event.key === 'Enter' && !disabled) {
              event.preventDefault();
              insert(ownTitleKey(section.id));
            }
          }}
        >
          {section.name}
        </button>
      ))}
      <button
        type="button"
        className={styles.chip}
        disabled={!ready || sections.length >= 200}
        onClick={() => {
          setError('');
          setEditing({id: crypto.randomUUID(), name: '', english: ''});
        }}
      >
        + 타이틀
      </button>
      {error && editing === null ? <span role="alert">{error}</span> : null}
      {menu ? (
        <Menu
          context
          label="타이틀 관리"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'edit',
              label: '이름 수정',
              onSelect: () => {
                setEditing(menu.section);
                setMenu(null);
              },
            },
            {
              kind: 'item',
              id: 'delete',
              label: '삭제',
              onSelect: () => {
                editorTask(save(null, menu.section.id));
              },
            },
          ]}
        />
      ) : null}
      {editing ? (
        <Dialog
          title="타이틀"
          size="s"
          onCancel={() => setEditing(null)}
          primary={{
            label: '저장',
            disabled: busy || editing.name.trim() === '',
            onSelect: () => {
              editorTask(
                save(
                  {
                    ...editing,
                    name: editing.name.trim(),
                    english: editing.english.trim(),
                  },
                  editing.id,
                ),
              );
            },
          }}
        >
          <DialogField label="이름">
            <TextField
              aria-label="이름"
              block
              maxLength={128}
              value={editing.name}
              onChange={name => setEditing({...editing, name})}
            />
          </DialogField>
          <DialogField label="영어">
            <TextField
              aria-label="영어"
              block
              maxLength={256}
              value={editing.english}
              onChange={english => setEditing({...editing, english})}
            />
          </DialogField>
          {error ? <p role="alert">{error}</p> : null}
        </Dialog>
      ) : null}
    </>
  );
}
