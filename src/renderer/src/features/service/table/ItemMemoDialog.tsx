import {useRef, useState, type JSX} from 'react';
import {Dialog} from '@renderer/ui/Dialog';
import {TextArea} from '@renderer/ui/TextArea';

export function ItemMemoDialog({
  memo,
  title,
  save,
  onClose,
}: {
  readonly memo: string;
  readonly title: string;
  readonly save: (memo: string) => Promise<boolean>;
  readonly onClose: () => void;
}): JSX.Element {
  const [value, setValue] = useState(memo);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  const commit = (): void => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    save(value)
      .then(
        saved => {
          if (saved) onClose();
          else setFailed(true);
        },
        (error: unknown) => {
          console.error('Could not save item memo', error);
          setFailed(true);
        },
      )
      .finally(() => {
        pending.current = false;
        setBusy(false);
      });
  };
  return (
    <Dialog
      title="메모"
      subtitle={{text: title}}
      size="s"
      onCancel={() => {
        if (!pending.current) onClose();
      }}
      primary={{label: '저장', disabled: busy, onSelect: commit}}
    >
      <TextArea
        autoFocus
        aria-label="메모"
        value={value}
        onChange={setValue}
        readOnly={busy}
        invalid={failed}
        invalidReason={failed ? '메모 저장 실패' : undefined}
      />
    </Dialog>
  );
}
