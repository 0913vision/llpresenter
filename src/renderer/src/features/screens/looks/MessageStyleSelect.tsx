import {useId, type JSX} from 'react';
import type {MessageStyleId, ScreenId} from '@core/schema/ids';
import type {LooksFile} from '@core/schema/looks';
import {MESSAGE_STYLE_LIMIT} from '@core/schema/looks';
import {IconButton} from '@renderer/ui/IconButton';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import styles from './MessageStyleSelect.module.css';

/** Selects a message style for one screen in one Look. */
export function MessageStyleSelect({
  file,
  look,
  screenId,
  screenName,
  reason,
  onChange,
  onCreate,
}: {
  readonly file: LooksFile;
  readonly look: LooksFile['looks'][number];
  readonly screenId: ScreenId;
  readonly screenName: string;
  readonly reason: string | undefined;
  readonly onChange: (id: MessageStyleId | null) => void;
  readonly onCreate: () => void;
}): JSX.Element {
  const warningId = useId();
  const items = file.messageStyles ?? [];
  const assigned = look.screens[screenId]?.messageStyle;
  const selected = items.find(style => style.id === assigned);
  const warning =
    assigned !== undefined && selected === undefined
      ? '메시지 스타일을 찾을 수 없어 기본값을 사용함'
      : undefined;
  const createReason =
    reason ??
    (items.length >= MESSAGE_STYLE_LIMIT
      ? '메시지 스타일은 1,000개까지 추가할 수 있음'
      : undefined);
  return (
    <span className={styles.row}>
      <SelectMenu
        aria-label={`${screenName} 메시지 스타일`}
        value={selected?.id ?? ''}
        valueText={selected?.name ?? '기본값'}
        lead={
          warning === undefined ? undefined : {kind: 'icon', icon: 'warning'}
        }
        aria-describedby={warning === undefined ? undefined : warningId}
        options={[
          {value: '', label: '기본값'},
          ...items.map(style => ({value: style.id, label: style.name})),
        ]}
        disabled={reason !== undefined}
        title={[reason, warning].filter(Boolean).join('\n') || undefined}
        onChange={value =>
          onChange(items.find(style => style.id === value)?.id ?? null)
        }
      />
      {warning === undefined ? null : (
        <span id={warningId} hidden>
          {warning}
        </span>
      )}
      <IconButton
        icon="plus"
        label={`${screenName} 메시지 스타일 추가`}
        disabled={createReason !== undefined}
        title={createReason}
        onClick={onCreate}
      />
    </span>
  );
}
