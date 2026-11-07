import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {TextImportDraft, TextImportSource} from '@core/schema/textImport';
import {defaultPreferences, type Preferences} from '@core/schema/preferences';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import type {SongEditorStore} from '../editor/songEditorStore';
import {usePreferenceEdits} from '../../preferences/usePreferenceEdits';
import {TextImportDialog, type TextImportChoice} from './TextImportDialog';
import {TextImportEncodingDialog} from './TextImportEncodingDialog';
import type {TextEncoding} from './textEncodings';

function defaultsOf(
  retry: {readonly defaults: Preferences['import']['txt']} | null,
): Preferences['import']['txt'] {
  return retry?.defaults ?? defaultPreferences.import.txt;
}

async function read(api: LlpApi, source: 'file' | 'clipboard') {
  const defaults = (await api.preferences.get()).import.txt;
  return {
    defaults,
    result: await api.textImport.read({source, encoding: defaults.encoding}),
  };
}

/** Coordinates reading, options preview dialog, and imported draft handoff. */
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
  const [replacement, setReplacement] = useState<TextImportDraft | null>(null);
  const edit = (draft: TextImportDraft): void => {
    const previous = store.getSnapshot().session;
    store.openImported(draft);
    if (store.getSnapshot().session === previous) return;
    onEdit();
    onDone();
  };
  const preferences = usePreferenceEdits(onProblem);
  const remember = (choice: TextImportChoice): void =>
    preferences.change(stored => ({
      ...stored,
      import: {...stored.import, txt: {...stored.import?.txt, ...choice}},
    }));
  const [retry, setRetry] = useState<{
    fileName: string | null;
    defaults: Preferences['import']['txt'];
  } | null>(null);
  const [reading, setReading] = useState(false);
  const latestRead = useRef(0);
  useEffect(
    () => () => {
      latestRead.current = -1;
    },
    [],
  );
  const readFailed = (): void =>
    onProblem({
      key: 'text-import:read',
      kind: 'warning',
      icon: 'warning',
      title: '텍스트 가져오기 실패',
      time: noticeTime(),
    });
  const encode = (encoding: TextEncoding): void => {
    const ticket = ++latestRead.current;
    const isLatest = (): boolean => latestRead.current === ticket;
    setReading(true);
    api.textImport
      .read({source: 'file', encoding, again: true})
      .then(result => {
        if (!isLatest()) return;
        if (!result.ok || result.value === null) {
          throw new Error('The file could not be read again');
        }
        const next = result.value;
        remember({encoding});
        setRetry(null);
        setInput(current => ({
          source: next,
          defaults: {...(current?.defaults ?? defaultsOf(retry)), encoding},
        }));
      })
      .catch((error: unknown) => {
        console.error('Text import read failed', error);
        if (isLatest()) readFailed();
      })
      .finally(() => {
        if (isLatest()) setReading(false);
      });
  };
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
        if (
          !result.ok &&
          source === 'file' &&
          result.error.reason === 'decode-failed'
        ) {
          setRetry({fileName: null, defaults});
        } else if (!result.ok) failed();
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
  if (input === null) {
    return retry === null ? null : (
      <TextImportEncodingDialog
        fileName={retry.fileName}
        tried={retry.defaults.encoding}
        reading={reading}
        onRead={encode}
        onCancel={onDone}
      />
    );
  }
  return (
    <>
      <TextImportDialog
        api={api.textImport}
        source={input.source}
        defaults={input.defaults}
        labels={state.labels?.value.labels ?? []}
        library={state.library}
        onProblem={onProblem}
        onRemember={remember}
        onEncoding={encode}
        reading={reading}
        onDiscard={onDone}
        onEdit={draft => {
          if (latestRead.current >= 0 && reading) return;
          if (store.getSnapshot().imported) setReplacement(draft);
          else edit(draft);
        }}
      />
      {replacement === null ? null : (
        <AlertDialog
          icon="song"
          title="가져온 곡을 저장하지 않았습니다. 버릴까요?"
          onCancel={() => setReplacement(null)}
          actions={[
            {
              label: '저장 안 함',
              primary: true,
              onSelect: () => {
                if (store.getSnapshot().busy) return;
                store.discardImported();
                edit(replacement);
                setReplacement(null);
              },
            },
          ]}
        />
      )}
    </>
  );
}
