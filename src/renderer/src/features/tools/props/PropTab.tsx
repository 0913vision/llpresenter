import {NAME_LIMIT} from '@core/schema/common/primitives';
import {RenameDialog} from '@renderer/ui/popups/RenameDialog';
import {useScreenList} from '@renderer/platform/screens/useScreenList';
import {PanelAction} from '@renderer/ui/panels/PanelActionSlot';
import {useLayoutEffect, useRef, useState, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {createPropId} from '@core/schema/common/ids';
import type {Prop} from '@core/schema/tools/props';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {Menu} from '@renderer/ui/menus/Menu';
import {useMenuHandoff} from '@renderer/ui/menus/useMenuHandoff';
import {deleteSelection} from '@renderer/ui/lists/deleteSelection';
import type {Notice} from '@renderer/ui/popups/notices';
import {PropDialog} from './PropDialog';
import {PropGrid} from './PropGrid';
import {MAX_PROPS, savePropEdit, type PropEdit} from './propEdits';
import {useMediaDocument} from '../useMediaDocument';
import {
  focusedOptionIndex,
  useDuplicateShortcut,
} from '../useDuplicateShortcut';
import {useToolEditing} from '../useToolEditing';
import {useUndoKeys} from '@renderer/platform/undo/useUndoKeys';
import {focusHistorySurface} from '@renderer/ui/lists/focusHistorySurface';
import {useReflow} from '@renderer/ui/panels/useReflow';
import styles from './PropGrid.module.css';
import {menuAvailability, type MenuAnchor} from '@renderer/ui/menus/menuModel';
import {propMenuEntries, toolMenuReason} from '../toolMenuEntries';

type Editor = {kind: 'add'} | {kind: 'edit'; prop: Prop};

/** The 그래픽 tab of the 진행 tools. */
export function PropTab({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const document = useSettingsDocument('props', '그래픽', onProblem);
  const screens = useScreenList(onProblem);
  const media = useMediaDocument(onProblem, 'prop');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [menu, setMenu] = useState<{
    prop: Prop;
    anchor: MenuAnchor;
    activate: () => void;
    reason: string | undefined;
  } | null>(null);
  const editing = useToolEditing({
    api: window.llp,
    write: savePropEdit,
    onProblem,
    area: {
      key: 'props',
      label: '그래픽',
      log: 'Could not edit props',
      history: 'props',
    },
  });
  const {busy, run} = editing;
  const [renaming, setRenaming] = useState<Prop | null>(null);
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
  useUndoKeys(root);
  const props = document?.value.props ?? [];
  useLayoutEffect(() => {
    root.current
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      .forEach((option, index) => {
        const id = props[index]?.id;
        if (id === undefined) option.removeAttribute('data-reflow-id');
        else option.setAttribute('data-reflow-id', id);
      });
  });
  useReflow(root, {
    ids: props.map(prop => prop.id),
    selector: '[data-reflow-id]',
    attribute: 'data-reflow-id',
    scope: 'props',
  });
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
  const renameAfterMenu = useMenuHandoff<Prop>(menu !== null, setRenaming);
  const deleteAfterMenu = useMenuHandoff<Prop>(menu !== null, prop => {
    deleteSelection(
      1,
      () => !locked && document.value.props.some(row => row.id === prop.id),
      () => {
        focusHistorySurface(root.current);
        save({kind: 'delete', id: prop.id});
      },
    );
  });
  return (
    <div className={styles.root} ref={root}>
      <PanelAction>
        <IconButton
          icon="plus"
          label="그래픽 추가"
          disabled={locked || document.value.props.length >= MAX_PROPS}
          onClick={() => setEditor({kind: 'add'})}
        />
      </PanelAction>
      <PropGrid
        props={document?.value.props ?? []}
        screens={screens ?? []}
        media={media?.value.items}
        onMenu={(prop, anchor, action) => {
          setMenu({prop, anchor, ...action});
        }}
      />
      {menu ? (
        <Menu
          context
          label="그래픽"
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          entries={[
            {
              kind: 'item',
              id: 'output',
              contextGroup: 'default',
              label: '출력 전환',
              ...menuAvailability(menu.reason),
              onSelect: menu.activate,
            },
            ...propMenuEntries({
              reason: toolMenuReason(locked, busy),
              edit: () => setEditor({kind: 'edit', prop: menu.prop}),
              rename: () => renameAfterMenu(menu.prop),
              duplicate: () => duplicate(menu.prop),
              duplicateReason,
              remove: () => {
                deleteAfterMenu(menu.prop);
                setMenu(null);
              },
            }),
          ]}
        />
      ) : null}
      {renaming ? (
        <RenameDialog
          name={renaming.name}
          title="그래픽 이름 바꾸기"
          locked={locked}
          rename={{
            maxLength: NAME_LIMIT,
            onCommit: name =>
              run({kind: 'update', prop: {...renaming, name: name.trim()}}),
            onClose: () => setRenaming(null),
          }}
        />
      ) : null}
      {editor ? (
        <PropDialog
          initial={editor.kind === 'edit' ? editor.prop : undefined}
          screens={screens ?? []}
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
