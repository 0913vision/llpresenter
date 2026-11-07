import {useState, type JSX} from 'react';
import type {Preferences} from '@core/schema/preferences';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TEXT_ENCODINGS, type TextEncoding} from './textEncodings';

/**
 * Asks for another 글자 인코딩 after a file could not be read with the one it
 * was tried with, so the operator retries the same file instead of losing it.
 */
export function TextImportEncodingDialog({
  fileName,
  tried,
  reading,
  onRead,
  onCancel,
}: {
  readonly fileName: string | null;
  readonly tried: Preferences['import']['txt']['encoding'];
  readonly reading: boolean;
  readonly onRead: (encoding: TextEncoding) => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const [encoding, setEncoding] = useState<TextEncoding>(
    tried === 'cp949' ? 'auto' : 'cp949',
  );
  const same = encoding === tried;
  return (
    <Dialog
      title="글자 인코딩"
      size="s"
      subtitle={{icon: 'filetext', text: fileName ?? '텍스트 파일'}}
      onCancel={onCancel}
      cancelLabel="취소"
      primary={{
        label: '다시 읽기',
        disabled: reading || same,
        title: reading
          ? '읽는 중'
          : same
            ? '다른 글자 인코딩을 고릅니다'
            : undefined,
        onSelect: () => onRead(encoding),
      }}
    >
      <DialogField label="글자 인코딩">
        <SelectMenu
          aria-label="글자 인코딩"
          options={TEXT_ENCODINGS}
          value={encoding}
          disabled={reading}
          onChange={setEncoding}
        />
      </DialogField>
    </Dialog>
  );
}
