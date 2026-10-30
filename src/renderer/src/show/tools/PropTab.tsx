import {useState, type JSX} from 'react';
import type {Prop} from '@core/schema/props';
import {useSettingsDocument} from '@renderer/screens/useSettingsDocument';
import {AlertDialog, IconButton, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {PropDialog} from './PropDialog';
import {PropGrid} from './PropGrid';
import {MAX_PROPS, savePropEdit, type PropEdit} from './propEdits';
import {useAudioMedia} from './useAudioMedia';
import {useToolEditing} from './useToolEditing';
import styles from './PropGrid.module.css';
import {propMenuEntries, toolMenuReason} from './toolMenuEntries';

type Editor = {kind: 'add'} | {kind: 'edit' | 'delete'; prop: Prop};

export function PropTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('props', '소품', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const media = useAudioMedia(onProblem, 'prop');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [menu, setMenu] = useState<{prop: Prop; anchor: MenuAnchor} | null>(
    null,
  );
  const {busy, run} = useToolEditing({
    api: window.llp,
    write: savePropEdit,
    onProblem,
    area: {key: 'props', label: '소품', log: 'Could not edit props'},
  });
  const locked = busy || document?.access !== 'editable' || !screens || !media;
  const save = (edit: PropEdit): void => {
    run(edit).then(
      saved => {
        if (saved) setEditor(null);
      },
      (cause: unknown) =>
        window.llp?.log.write({
          level: 'error',
          message: 'Prop edit callback failed',
          detail: String(cause),
        }),
    );
  };
  return (
    <div className={styles.root}>
      <div className={styles.tools}>
        <IconButton
          icon="plus"
          label="소품 추가"
          disabled={locked || document.value.props.length >= MAX_PROPS}
          onClick={() => setEditor({kind: 'add'})}
        />
      </div>
      <PropGrid
        props={document?.value.props ?? []}
        screens={screens?.value.screens ?? []}
        onMenu={(prop, anchor) => {
          setMenu({prop, anchor});
        }}
      />
      {menu ? (
        <Menu
          label="소품"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={propMenuEntries({
            reason: toolMenuReason(locked, busy),
            edit: () => setEditor({kind: 'edit', prop: menu.prop}),
            remove: () => setEditor({kind: 'delete', prop: menu.prop}),
          })}
        />
      ) : null}
      {editor?.kind === 'delete' ? (
        <AlertDialog
          icon="component"
          title={`‘${editor.prop.name}’ 소품을 삭제할까요?`}
          onCancel={() => setEditor(null)}
          actions={[
            {
              label: '삭제',
              primary: true,
              disabled: locked,
              onSelect: () => save({kind: 'delete', id: editor.prop.id}),
            },
          ]}
        />
      ) : editor ? (
        <PropDialog
          initial={editor.kind === 'edit' ? editor.prop : undefined}
          screens={screens?.value.screens ?? []}
          media={media?.value.items ?? []}
          locked={locked}
          onCancel={() => setEditor(null)}
          onSave={prop =>
            save({kind: editor.kind === 'add' ? 'add' : 'update', prop})
          }
        />
      ) : null}
    </div>
  );
}
