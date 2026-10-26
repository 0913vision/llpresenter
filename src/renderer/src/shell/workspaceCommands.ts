import {isInTextEntry} from '@renderer/ui/textEntry';
import type {MenuEntry} from '@renderer/ui/menuModel';
import type {Workspace} from './Toolbar';
import type {WindowShortcut} from './windowShortcuts';

interface WorkspaceActions {
  readonly onWorkspace: (workspace: Workspace) => void;
  readonly onMedia: () => void;
  readonly imported: boolean;
}

/** Decided ProPresenter workspace defaults, with imported-save precedence. */
export function workspaceShortcuts({
  onWorkspace,
  onMedia,
  imported,
}: WorkspaceActions): readonly WindowShortcut[] {
  return [
    {
      code: 'KeyS',
      ctrl: true,
      when: () => !imported,
      run: () => onWorkspace('show'),
    },
    ...['KeyE', 'KeyR'].map(code => ({
      code,
      ctrl: true,
      run: () => onWorkspace('prep'),
    })),
    {code: 'Digit1', ctrl: true, alt: true, run: () => onWorkspace('screens')},
    {
      code: 'KeyV',
      ctrl: true,
      shift: true,
      when: event => !isInTextEntry(event.target),
      run: onMedia,
    },
  ];
}

/** The same existing workspace actions shown in the 보기 menu. */
export function workspaceMenu({
  onWorkspace,
  onMedia,
}: {
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
  readonly onMedia: (() => void) | undefined;
}): readonly MenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'workspace.show',
      label: '진행',
      meta: 'Ctrl S',
      disabled: onWorkspace === undefined,
      onSelect: () => onWorkspace?.('show'),
    },
    {
      kind: 'item',
      id: 'workspace.prep',
      label: '준비',
      meta: 'Ctrl E / Ctrl R',
      disabled: onWorkspace === undefined,
      onSelect: () => onWorkspace?.('prep'),
    },
    {
      kind: 'item',
      id: 'workspace.screens',
      label: '화면 설정',
      meta: 'Ctrl Alt 1',
      disabled: onWorkspace === undefined,
      onSelect: () => onWorkspace?.('screens'),
    },
    {
      kind: 'item',
      id: 'workspace.media',
      label: '미디어',
      meta: 'Ctrl Shift V',
      disabled: onMedia === undefined,
      onSelect: onMedia,
    },
  ];
}
