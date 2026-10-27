import {useEffect, useRef, useState} from 'react';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {GroupRename} from '@renderer/ui/ListRow';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {useScreensSelection} from './selection';
import type {NamedDocument} from './useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';
import type {ScreenRenameProblem} from './screenEditor';
import {nameProblem} from './screenEdits';

const PROBLEMS: Readonly<Record<ScreenRenameProblem, string>> = {
  empty: '이름이 비어 있음',
  taken: '같은 이름의 화면이 있음',
  missing: '화면을 찾을 수 없음',
};

/** Exposes row rename and confirmed removal through the same screen settings queue. */
export function useScreenRowActions(
  document: NamedDocument<'screens'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const editor = useScreenEditor(document, onProblem);
  const [menu, setMenu] = useState<{id: string; anchor: MenuAnchor} | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const pendingAction = useRef<{kind: 'rename' | 'delete'; id: string} | null>(
    null,
  );
  const select = useScreensSelection(view => view.select);
  const reason =
    document === null
      ? '설정을 불러오는 중'
      : document.access === 'readOnly'
        ? '새 버전에서 만든 설정이므로 변경할 수 없음'
        : undefined;
  const target = document?.value.screens.find(screen => screen.id === menu?.id);
  const confirmedTarget = document?.value.screens.find(
    screen => screen.id === confirming,
  );
  // NOTE(0913vision): Mount the field or confirmation after menu focus
  // restoration so cleanup cannot blur the field or leave the confirmation.
  useEffect(() => {
    if (menu !== null || pendingAction.current === null) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action.kind === 'rename') {
      select('screen', action.id);
      setRenaming(action.id);
    } else setConfirming(action.id);
  }, [menu, select]);
  const report = (title: string): void =>
    onProblem?.({
      key: 'screens:row',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
    });
  const failed = (cause: unknown): void => {
    window.llp?.log.write({
      level: 'error',
      message: 'Could not edit a screen row',
      detail: String(cause),
    });
    report('화면 설정 저장 실패');
  };
  const renameFor = (id: string): GroupRename | undefined =>
    renaming !== id || reason !== undefined
      ? undefined
      : {
          validate: name => {
            const problem = nameProblem(
              name,
              document?.value.screens ?? [],
              id,
            );
            return problem === undefined ? undefined : PROBLEMS[problem];
          },
          onCommit: name => {
            setRenaming(null);
            editor
              .rename(id, name)
              .then(result => {
                if (!result.ok) report(PROBLEMS[result.error]);
              })
              .catch(failed);
          },
          onCancel: () => setRenaming(null),
        };
  return {
    open: (id: string, anchor: MenuAnchor): void => setMenu({id, anchor}),
    renameFor,
    overlays: (
      <>
        {menu === null || target === undefined ? null : (
          <Menu
            label="화면 메뉴"
            anchor={menu.anchor}
            onClose={() => setMenu(null)}
            entries={[
              {
                kind: 'item',
                id: 'rename',
                label: '이름 변경',
                disabled: reason !== undefined,
                title: reason,
                onSelect: () => {
                  pendingAction.current = {kind: 'rename', id: target.id};
                },
              },
              {
                kind: 'item',
                id: 'delete',
                label: '삭제',
                danger: true,
                disabled: reason !== undefined,
                title: reason,
                onSelect: () => {
                  pendingAction.current = {kind: 'delete', id: target.id};
                },
              },
            ]}
          />
        )}
        {confirmedTarget === undefined ? null : (
          <AlertDialog
            icon="trash"
            title={`‘${confirmedTarget.name}’ 화면을 삭제할까요?`}
            onCancel={() => setConfirming(null)}
            actions={[
              {
                label: '삭제',
                primary: true,
                disabled: reason !== undefined,
                title: reason,
                onSelect: () => {
                  const id = confirmedTarget.id;
                  setConfirming(null);
                  editor.remove(id).catch(failed);
                },
              },
            ]}
          />
        )}
      </>
    ),
  };
}
