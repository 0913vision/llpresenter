import type {Ref} from 'react';
import {
  LabelManager,
  type LabelManagerHandle,
} from '../songs/editor/LabelManager';
import type {SongEditorStore} from '../songs/editor/songEditorStore';

/** 이름표: the same catalog editor as 이름표 관리. */
export function LabelsPage({
  store,
  managerRef,
}: {
  readonly store: SongEditorStore | undefined;
  readonly managerRef?: Ref<LabelManagerHandle> | undefined;
}) {
  return store === undefined ? null : (
    <LabelManager ref={managerRef} store={store} placement="page" />
  );
}
