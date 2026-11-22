import type {Ref} from 'react';
import {LabelManager, type LabelManagerHandle} from './LabelManager';
import type {LabelCatalog} from './labelCatalog';

/** 이름표: the same catalog editor as 이름표 관리. */
export function LabelsPage({
  store,
  managerRef,
}: {
  readonly store: LabelCatalog | undefined;
  readonly managerRef?: Ref<LabelManagerHandle> | undefined;
}) {
  return store === undefined ? null : (
    <LabelManager ref={managerRef} store={store} placement="page" />
  );
}
