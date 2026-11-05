import {useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {TranslationId} from '@core/schema/ids';
import {Dialog} from '@renderer/ui/Dialog';
import {BibleReferenceForm} from './BibleReferenceForm';

/** Shares validated passage entry between service insertion and verse slide insertion. */
export function BiblePassageDialog({
  api,
  translation,
  limit,
  onChoose,
  onClose,
}: {
  readonly api: LlpApi['bible'];
  readonly translation: TranslationId | undefined;
  readonly limit?: number;
  readonly onChoose: (passage: BibleLookupPassage) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const [passage, setPassage] = useState<BibleLookupPassage | null>(null);
  const fits = (value: BibleLookupPassage): boolean =>
    limit === undefined || value.verses.length <= limit;
  const choose = (value: BibleLookupPassage | null): void => {
    if (value !== null && fits(value)) onChoose(value);
  };
  return (
    <Dialog
      title="성경 구절"
      size="s"
      onCancel={onClose}
      primary={{
        label: '추가',
        disabled: passage === null || !fits(passage),
        title:
          passage !== null && !fits(passage)
            ? '추가할 수 있는 슬라이드 수를 넘었습니다'
            : undefined,
        onSelect: () => choose(passage),
      }}
    >
      <BibleReferenceForm
        api={api}
        translation={translation}
        onReady={setPassage}
        onPreview={() => undefined}
        onSubmit={choose}
        autoFocus
      />
    </Dialog>
  );
}
