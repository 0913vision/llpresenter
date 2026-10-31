import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useState} from 'react';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {sendLive, useOutputs} from '@renderer/session/live';
import type {GroupRename} from '@renderer/ui/ListRow';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {useScreensSelection} from './selection';
import type {NamedDocument} from '../../platform/useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';
import type {ScreenRenameProblem} from './screenEditor';
import {nameProblem} from '@core/screens/screenEdits';
import {ScreenContextMenu} from './screenMenuEntries';
import {NOT_YET} from '@renderer/ui/menuRows';

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
  const outputs = useOutputs();
  const [menu, setMenu] = useState<{id: string; anchor: MenuAnchor} | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
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
  const handoff = useMenuHandoff<{kind: 'rename' | 'delete'; id: string}>(
    menu !== null,
    action => {
      if (action.kind === 'rename') {
        select('screen', action.id);
        setRenaming(action.id);
      } else setConfirming(action.id);
    },
  );
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
          onCommit: async name => {
            const result = await editor.rename(id, name);
            if (!result.ok) report(PROBLEMS[result.error]);
            return result.ok && result.value;
          },
          onClose: () => setRenaming(null),
        };
  return {
    open: (id: string, anchor: MenuAnchor): void => setMenu({id, anchor}),
    renameFor,
    overlays: (
      <>
        {menu === null || target === undefined ? null : (
          <ScreenContextMenu
            label="화면 메뉴"
            anchor={menu.anchor}
            onClose={() => setMenu(null)}
            actions={{
              reason,
              outputReason:
                window.llp === undefined
                  ? '출력에 연결되지 않음'
                  : target.method === 'ndi' && outputs[target.id] !== true
                    ? NOT_YET
                    : undefined,
              canDelete:
                (document?.value.screens.filter(
                  screen => screen.kind === target.kind,
                ).length ?? 0) > 1,
              on: outputs[target.id] === true,
              rename: () => {
                handoff({kind: 'rename', id: target.id});
              },
              remove: () => {
                handoff({kind: 'delete', id: target.id});
              },
              toggle: () => {
                try {
                  sendLive({
                    type: 'output.set',
                    screenId: target.id,
                    on: outputs[target.id] !== true,
                  });
                } catch (cause) {
                  window.llp?.log.write({
                    level: 'error',
                    message: 'Could not toggle a screen output',
                    detail: String(cause),
                  });
                  report('화면 출력 변경 실패');
                }
              },
            }}
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
