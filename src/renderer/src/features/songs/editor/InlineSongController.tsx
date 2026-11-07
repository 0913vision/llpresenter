import {useLayoutEffect, useRef, type RefObject, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongEditorTarget} from '@core/schema/ipcPayloads';
import type {Notice} from '@renderer/ui/notices';
import {SongSaveDialogs} from './SongSaveDialogs';
import type {SongEditorStore} from './songEditorStore';
import {
  useSongEditorWindow,
  type SongEditorWindowModel,
} from './useSongEditorWindow';

/** Keeps save questions and external editor requests alive across workspaces. */
export function InlineSongController({
  store,
  api,
  report,
  controls: controlsRef,
  onOpen,
}: {
  readonly store: SongEditorStore;
  readonly api: LlpApi;
  readonly report: (notice: Notice) => void;
  readonly controls: RefObject<SongEditorWindowModel | null>;
  readonly onOpen: (target: SongEditorTarget) => void;
}): JSX.Element {
  const open = useRef(onOpen);
  useLayoutEffect(() => {
    open.current = onOpen;
  }, [onOpen]);
  const model = useSongEditorWindow(store, api, {
    report,
    onOpened: target => open.current(target),
  });
  useLayoutEffect(() => {
    controlsRef.current = model;
  });
  return <SongSaveDialogs model={model} />;
}
