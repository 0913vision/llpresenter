import {useState, type JSX, type ReactNode} from 'react';
import type {NoticeSet} from '@core/schema/notices';
import type {Screen} from '@core/schema/screens';
import {Button, Dialog, TextField} from '@renderer/ui';
import type {NoticeChanges} from './noticeEdits';
import styles from './NoticeSettings.module.css';

function IntervalDialog({
  item,
  locked,
  save,
  close,
}: {
  readonly item: NoticeSet;
  readonly locked: boolean;
  readonly save: (changes: NoticeChanges) => Promise<boolean>;
  readonly close: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState(String(item.interval));
  const seconds = Number(draft);
  const valid =
    /^(?:\d+\.?\d*|\.\d+)$/u.test(draft) &&
    Number.isFinite(seconds) &&
    seconds > 0;
  return (
    <Dialog
      title="공지 간격"
      size="s"
      onCancel={close}
      primary={{
        label: '저장',
        disabled: locked || !valid,
        title: valid ? undefined : '0보다 큰 초를 입력하세요',
        onSelect: () => {
          save({interval: seconds}).then(
            saved => {
              if (saved) close();
            },
            (cause: unknown) =>
              console.error('Notice interval callback failed', cause),
          );
        },
      }}
    >
      <TextField
        aria-label="간격 (초)"
        autoFocus
        value={draft}
        onChange={setDraft}
        inputMode="decimal"
        invalid={!valid}
        invalidReason={valid ? undefined : '0보다 큰 초를 입력하세요'}
        readOnly={locked}
      />
    </Dialog>
  );
}

export function NoticeSettings({
  item,
  screens,
  locked,
  save,
  children,
}: {
  readonly item: NoticeSet;
  readonly screens: readonly Screen[];
  readonly locked: boolean;
  readonly save: (changes: NoticeChanges) => Promise<boolean>;
  readonly children?: ReactNode;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const change = (changes: NoticeChanges): void => {
    save(changes).then(
      () => undefined,
      (cause: unknown) =>
        console.error('Notice setting callback failed', cause),
    );
  };
  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <Button
          disabled={locked}
          onClick={() => setEditing(true)}
        >{`${item.interval}초`}</Button>
        <Button
          disabled={locked}
          aria-pressed={item.loop}
          onClick={() => change({loop: !item.loop})}
        >
          반복
        </Button>
      </div>
      {children}
      <div role="group" aria-label="보낼 화면" className={styles.targets}>
        {screens.map(screen => {
          const on = item.targets.includes(screen.id);
          const last = on && item.targets.length === 1;
          return (
            <Button
              key={screen.id}
              disabled={locked || last}
              title={last ? '화면을 하나 이상 선택하세요' : undefined}
              aria-pressed={on}
              onClick={() =>
                change({
                  targets: on
                    ? item.targets.filter(id => id !== screen.id)
                    : [...item.targets, screen.id],
                })
              }
            >
              {screen.name || '이름 없음'}
            </Button>
          );
        })}
      </div>
      {editing ? (
        <IntervalDialog
          item={item}
          locked={locked}
          save={save}
          close={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
