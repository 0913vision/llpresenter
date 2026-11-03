import {useRef, useState, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {createPropId} from '@core/schema/ids';
import type {Prop} from '@core/schema/props';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {AlertDialog, IconButton, Menu} from '@renderer/ui';
import type {MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {PropDialog} from './PropDialog';
import {PropGrid} from './PropGrid';
import {MAX_PROPS, savePropEdit, type PropEdit} from './propEdits';
import {useAudioMedia} from './useAudioMedia';
import {focusedOptionIndex, useDuplicateShortcut} from './useDuplicateShortcut';
import {useToolEditing} from './useToolEditing';
import styles from './PropGrid.module.css';
import {propMenuEntries, toolMenuReason} from './toolMenuEntries';

type Editor = {kind: 'add'} | {kind: 'edit' | 'delete'; prop: Prop};

export function PropTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('props', '그래픽', onProblem);
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
    area: {key: 'props', label: '그래픽', log: 'Could not edit props'},
  });
  const locked = busy || document?.access !== 'editable' || !screens || !media;
  const full = (document?.value.props.length ?? 0) >= MAX_PROPS;
  const duplicateReason = locked
    ? toolMenuReason(locked, busy)
    : full
      ? limitReason('그래픽', MAX_PROPS)
      : undefined;
  const duplicate = (prop: Prop): void =>
    save({
      kind: 'duplicate',
      id: prop.id,
      copyId: createPropId(crypto.randomUUID()),
    });
  const root = useRef<HTMLDivElement>(null);
  useDuplicateShortcut({
    itemAt: event => {
      const at = focusedOptionIndex(root.current, event.target);
      return at === undefined ? undefined : document?.value.props[at];
    },
    reason: duplicateReason,
    run: duplicate,
  });
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
    <div className={styles.root} ref={root}>
      <div className={styles.tools}>
        <IconButton
          icon="plus"
          label="그래픽 추가"
          disabled={locked || document.value.props.length >= MAX_PROPS}
          onClick={() => setEditor({kind: 'add'})}
        />
      </div>
      <PropGrid
        props={document?.value.props ?? []}
        screens={screens?.value.screens ?? []}
        media={media?.value.items}
        onMenu={(prop, anchor) => {
          setMenu({prop, anchor});
        }}
      />
      {menu ? (
        <Menu
          label="그래픽"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={propMenuEntries({
            reason: toolMenuReason(locked, busy),
            edit: () => setEditor({kind: 'edit', prop: menu.prop}),
            duplicate: () => duplicate(menu.prop),
            duplicateReason,
            remove: () => setEditor({kind: 'delete', prop: menu.prop}),
          })}
        />
      ) : null}
      {editor?.kind === 'delete' ? (
        <AlertDialog
          icon="component"
          title={`‘${editor.prop.name}’ 그래픽을 삭제할까요?`}
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
