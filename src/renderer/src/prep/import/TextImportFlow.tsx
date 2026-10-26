import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {TextImportSource} from '@shared/schema/textImport';
import type {Preferences} from '@shared/schema/preferences';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SongEditorStore} from '../editor/songEditorStore';
import {TextImportDialog} from './TextImportDialog';

async function read(api: LlpApi, source: 'file' | 'clipboard') {
  const defaults = (await api.preferences.get()).import.txt;
  return {
    defaults,
    result: await api.textImport.read({source, encoding: defaults.encoding}),
  };
}

export function TextImportFlow({
  api,
  store,
  source,
  onDone,
  onEdit,
  onProblem,
}: {
  readonly api: LlpApi;
  readonly store: SongEditorStore;
  readonly source: 'file' | 'clipboard';
  readonly onDone: () => void;
  readonly onEdit: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element | null {
  const pending = useRef<ReturnType<typeof read> | null>(null);
  const [input, setInput] = useState<{
    source: TextImportSource;
    defaults: Preferences['import']['txt'];
  } | null>(null);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    let active = true;
    const isActive = (): boolean => active;
    const failed = (): void => {
      onProblem({
        key: 'text-import:read',
        kind: 'warning',
        icon: 'warning',
        title: '텍스트 가져오기 실패',
        time: noticeTime(),
      });
      onDone();
    };
    pending.current ??= read(api, source);
    pending.current
      .then(({defaults, result}) => {
        if (!isActive()) return;
        if (!result.ok) failed();
        else if (result.value === null) onDone();
        else setInput({source: result.value, defaults});
      })
      .catch((error: unknown) => {
        console.error('Text import read failed', error);
        if (isActive()) failed();
      });
    return () => {
      active = false;
    };
  }, [api, source, onDone, onProblem]);
  return input === null ? null : (
    <TextImportDialog
      api={api.textImport}
      source={input.source}
      defaults={input.defaults}
      labels={state.labels?.value.labels ?? []}
      library={state.library}
      onProblem={onProblem}
      onDiscard={onDone}
      onEdit={draft => {
        store.openImported(draft);
        onEdit();
        onDone();
      }}
    />
  );
}
