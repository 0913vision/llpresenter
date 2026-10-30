import type {JSX} from 'react';
import {Menu, type MenuProps} from '@renderer/ui/Menu';
import {
  lookMenuEntries,
  lyricStyleMenuEntries,
  stageLayoutMenuEntries,
} from './settingsMenuEntries';

type ContextMenuProps<T> = Omit<MenuProps, 'entries'> & {readonly actions: T};

export function LookContextMenu({
  actions,
  ...props
}: ContextMenuProps<Parameters<typeof lookMenuEntries>[0]>): JSX.Element {
  return <Menu {...props} entries={lookMenuEntries(actions)} />;
}

export function LyricStyleContextMenu({
  actions,
  ...props
}: ContextMenuProps<Parameters<typeof lyricStyleMenuEntries>[0]>): JSX.Element {
  return <Menu {...props} entries={lyricStyleMenuEntries(actions)} />;
}

export function StageLayoutContextMenu({
  actions,
  ...props
}: ContextMenuProps<
  Parameters<typeof stageLayoutMenuEntries>[0]
>): JSX.Element {
  return <Menu {...props} entries={stageLayoutMenuEntries(actions)} />;
}
