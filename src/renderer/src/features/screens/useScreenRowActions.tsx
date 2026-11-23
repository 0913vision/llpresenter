import {
  NOT_IN_THIS_WINDOW,
  NEWER_FILE_REASON,
} from '@renderer/platform/problemReasons';
import {useMenuHandoff} from '@renderer/ui/useMenuHandoff';
import {useState} from 'react';
import {deleteSelection} from '@renderer/ui/deleteSelection';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {sendLive, useOutputs} from '@renderer/session/live';
import type {GroupRename} from '@renderer/ui/ListRow';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {useScreensSelection} from './selection';
import type {NamedDocument} from '../../platform/useSettingsDocument';
import {useScreenEditor} from './useScreenEditor';
import type {ScreenRenameProblem} from './screenEditor';
import {lastOfKind, nameProblem} from '@core/screens';
import {ScreenContextMenu} from './screenMenuEntries';

const PROBLEMS: Readonly<Record<ScreenRenameProblem, string>> = {
  empty: '이름을 적어야 저장할 수 있습니다',
  taken: '같은 이름의 화면이 있습니다',
  missing: '화면을 찾을 수 없음',
};

/** Exposes row rename and confirmed removal through the same screen settings queue. */
export function useScreenRowActions(
  document: NamedDocument<'screens'> | null,
  onProblem: ((notice: Notice) => void) | undefined,
  {
    onDeleted,
    focusList,
  }: {onDeleted: (revision: number) => void; focusList: () => void},
) {
  const editor = useScreenEditor(document, onProblem);
  const outputs = useOutputs();
  const [menu, setMenu] = useState<{id: string; anchor: MenuAnchor} | null>(
    null,
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const select = useScreensSelection(view => view.select);
  const reason =
    document === null
      ? '설정을 불러오는 중'
      : document.access === 'readOnly'
        ? NEWER_FILE_REASON
        : undefined;
  const target = document?.value.screens.find(screen => screen.id === menu?.id);
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
  const handoff = useMenuHandoff<{kind: 'rename' | 'delete'; id: string}>(
    menu !== null,
    action => {
      if (action.kind === 'rename') {
        select(action.id);
        setRenaming(action.id);
      } else {
        const screen = document?.value.screens.find(
          value => value.id === action.id,
        );
        deleteSelection(
          screen ? 1 : 0,
          () =>
            reason === undefined &&
            screen !== undefined &&
            lastOfKind(document?.value.screens ?? [], screen) === undefined,
          () => {
            focusList();
            editor.remove(action.id, onDeleted).catch(failed);
          },
        );
      }
    },
  );
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
    open: (id: string, anchor: MenuAnchor): void => {
      select(id);
      setMenu({id, anchor});
    },
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
                window.llp === undefined ? NOT_IN_THIS_WINDOW : undefined,
              deleteReason: lastOfKind(document?.value.screens ?? [], target),
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
      </>
    ),
  };
}
