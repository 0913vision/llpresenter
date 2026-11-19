import {useState, type JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {TextField} from '@renderer/ui/TextField';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import {contextMenuAnchor, openMenuFromKey} from '@renderer/ui/contextMenu';
import {editorTask} from '@renderer/features/songs/editor/editorTask';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import styles from './PrepPalette.module.css';

interface CustomSection {
  readonly id: string;
  readonly name: string;
  readonly english: string;
}

/** Reusable section names are stored with the app's theme settings. */
export function CustomSections(): JSX.Element {
  const document = useSettingsDocument('themes', '테마', undefined);
  const sections = document?.value.customSections ?? [];
  const [editing, setEditing] = useState<CustomSection | null>(null);
  const [menu, setMenu] = useState<{
    section: CustomSection;
    anchor: MenuAnchor;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (
    section: CustomSection | null,
    id: string,
  ): Promise<void> => {
    const api = window.llp;
    if (api === undefined || busy) return;
    setBusy(true);
    setError('');
    try {
      const latest = await api.settings.get({name: 'themes'});
      if (latest.name !== 'themes') throw new Error('Unexpected settings');
      const current = latest.value.customSections ?? [];
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
        value: {...latest.value, customSections: next},
      });
      if (!result.ok) throw new Error(result.error.message);
      setEditing(null);
      setMenu(null);
    } catch {
      setError('제목을 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {SUNDAY_SECTIONS.map(section => (
        <span key={section.name} className={styles.chip}>
          {section.name}
        </span>
      ))}
      {sections.map(section => (
        <button
          key={section.id}
          type="button"
          className={styles.chip}
          onContextMenu={event => {
            event.preventDefault();
            setMenu({section, anchor: contextMenuAnchor(event)});
          }}
          onKeyDown={event => {
            if (openMenuFromKey(event, anchor => setMenu({section, anchor}))) {
              return;
            }
          }}
        >
          {section.name}
        </button>
      ))}
      <button
        type="button"
        className={styles.chip}
        disabled={document === null || sections.length >= 200}
        onClick={() => {
          setError('');
          setEditing({id: crypto.randomUUID(), name: '', english: ''});
        }}
      >
        + 제목
      </button>
      {error && editing === null ? <span role="alert">{error}</span> : null}
      {menu ? (
        <Menu
          context
          label="제목 관리"
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
          title="제목"
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
