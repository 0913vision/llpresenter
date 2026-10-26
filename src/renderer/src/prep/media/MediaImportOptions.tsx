import {useEffect, useRef, useState, type JSX} from 'react';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/screens/useSettingsDocument';
import {IconButton, Menu} from '@renderer/ui';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {noticeTime, type Notice} from '@renderer/ui/notices';

const TITLE = '가져오기 설정';

/** The bin's shared preference for the next import, separate from opening files. */
export function MediaImportOptions({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [pending, setPending] = useState(false);
  const writing = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const reason =
    window.llp === undefined
      ? '설정을 불러올 수 없음'
      : pending
        ? '설정을 저장하는 중'
        : undefined;
  const reportFailure = (): void => {
    if (active.current) {
      onProblem({
        key: 'media:import-options',
        kind: 'warning',
        icon: 'warning',
        title: '가져오기 설정을 저장하지 못함',
        time: noticeTime(),
      });
    }
  };
  const change = async (
    document: NamedDocument<'preferences'>,
  ): Promise<void> => {
    const api = window.llp;
    if (
      api === undefined ||
      document.access !== 'editable' ||
      writing.current
    ) {
      return;
    }
    writing.current = true;
    setPending(true);
    try {
      const result = await api.settings.edit({
        type: 'settings.update',
        name: 'preferences',
        baseRevision: document.revision,
        value: {
          ...document.value,
          media: {
            ...document.value.media,
            copyOnImport: !(document.value.media?.copyOnImport ?? false),
          },
        },
      });
      if (!result.ok) reportFailure();
    } catch (cause: unknown) {
      console.error('Could not save media import options:', cause);
      reportFailure();
    } finally {
      writing.current = false;
      if (active.current) setPending(false);
    }
  };
  return (
    <>
      <IconButton
        icon="sliders"
        label={TITLE}
        menu
        expanded={anchor !== null}
        disabled={reason !== undefined}
        title={reason}
        onClick={event =>
          setAnchor(anchor === null ? event.currentTarget : null)
        }
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded: anchor !== null,
            disabled: reason !== undefined,
            onExpandedChange: next =>
              setAnchor(next ? event.currentTarget : null),
          })
        }
      />
      {anchor !== null ? (
        <ImportOptionsMenu
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onProblem={onProblem}
          onChange={document => {
            change(document).catch((cause: unknown) => {
              console.error('Media import option action failed:', cause);
            });
          }}
        />
      ) : null}
    </>
  );
}

function ImportOptionsMenu({
  anchor,
  onClose,
  onProblem,
  onChange,
}: {
  readonly anchor: HTMLButtonElement;
  readonly onClose: () => void;
  readonly onProblem: (notice: Notice) => void;
  readonly onChange: (document: NamedDocument<'preferences'>) => void;
}): JSX.Element {
  const document = useSettingsDocument('preferences', TITLE, onProblem);
  const reason =
    document === null
      ? '설정을 불러오는 중'
      : document.access !== 'editable'
        ? '읽기 전용 설정'
        : undefined;
  return (
    <Menu
      label={TITLE}
      anchor={{kind: 'element', element: anchor}}
      onClose={onClose}
      entries={[
        {
          kind: 'item',
          id: 'copy-on-import',
          label: '미디어 폴더로 복사',
          check: 'checkbox',
          checked: document?.value.media?.copyOnImport ?? false,
          disabled: reason !== undefined,
          title: reason,
          onSelect: () => {
            if (document !== null) onChange(document);
          },
        },
      ]}
    />
  );
}
