import {useMemo, useState, type JSX} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {LibrarySong} from '@shared/schema/contentDocuments';
import type {Label} from '@shared/schema/labels';
import type {Preferences} from '@shared/schema/preferences';
import {SONG_IMPORT_LIMITS} from '@shared/schema/songImport';
import type {
  TextImportDraft,
  TextImportOptions,
  TextImportSource,
} from '@shared/schema/textImport';
import {Checkbox, NumberField, TextField} from '@renderer/ui';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import type {Notice} from '@renderer/ui/notices';
import {VirtualSlides} from '../editor/VirtualSlides';
import {DUPLICATE_TITLE_REASON, normalizeSongTitle} from '../editor/songTitle';
import {useImportPreview} from './useImportPreview';
import styles from './TextImportDialog.module.css';

const PREVIEW_COLUMNS = 3;
const PREVIEW_SCALE = 100;
const MAX_UNITS = 1000;
const MAX_SYMBOL = 32;
const SPLITS = [
  {value: 'blankLine', label: '빈 줄'},
  {value: 'lineBreak', label: '줄 바꿈'},
  {value: 'symbol', label: '기호'},
] as const;

export function TextImportDialog({
  api,
  source,
  defaults,
  library,
  labels,
  onEdit,
  onDiscard,
  onProblem,
}: {
  readonly api: LlpApi['textImport'];
  readonly source: TextImportSource;
  readonly defaults: Preferences['import']['txt'];
  readonly library: readonly LibrarySong[];
  readonly labels: readonly Label[];
  readonly onEdit: (draft: TextImportDraft) => void;
  readonly onDiscard: () => void;
  readonly onProblem: (notice: Notice) => void;
}): JSX.Element {
  const [options, setOptions] = useState<TextImportOptions>(() => ({
    split: defaults.split,
    labels: defaults.labels,
    firstLine: defaults.firstLine,
    symbol: '/',
    unitsPerSlide: defaults.split === 'lineBreak' ? 2 : 1,
  }));
  const [title, setTitle] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const preview = useImportPreview({api, source, options, onProblem});
  const shownTitle = title ?? preview.draft?.title ?? '';
  const reason = library.some(
    song => normalizeSongTitle(song.title) === normalizeSongTitle(shownTitle),
  )
    ? DUPLICATE_TITLE_REASON
    : undefined;
  const numbers = useMemo(
    () => preview.draft?.slides.map((_, index) => index + 1) ?? [],
    [preview.draft],
  );
  return (
    <Dialog
      title="텍스트 가져오기"
      size="xl"
      subtitle={{icon: 'filetext', text: source.fileName ?? '클립보드 텍스트'}}
      onCancel={onDiscard}
      cancelLabel="버리기"
      primary={{
        label: '편집',
        disabled: preview.draft === null,
        title: preview.invalidSymbol
          ? '나누기 기호를 적어야 합니다'
          : preview.pending
            ? '미리보기 준비 중'
            : preview.draft === null
              ? '가져올 슬라이드가 없습니다'
              : undefined,
        onSelect: () => {
          if (preview.draft) onEdit({...preview.draft, title: shownTitle});
        },
      }}
      topBar={
        <>
          <DialogField label="슬라이드 나누기">
            <SelectMenu
              aria-label="슬라이드 나누기"
              options={SPLITS}
              value={options.split}
              onChange={split =>
                setOptions(current => ({
                  ...current,
                  split,
                  unitsPerSlide: split === 'lineBreak' ? 2 : 1,
                }))
              }
            />
          </DialogField>
          {options.split === 'symbol' ? (
            <DialogField label="기호">
              <TextField
                aria-label="기호"
                value={options.symbol ?? ''}
                onChange={symbol =>
                  setOptions(current => ({...current, symbol}))
                }
                maxLength={MAX_SYMBOL}
                invalid={preview.invalidSymbol}
                invalidReason="나누기 기호를 적어야 합니다"
              />
            </DialogField>
          ) : null}
          <DialogField label="한 슬라이드에">
            <NumberField
              aria-label="한 슬라이드에"
              value={options.unitsPerSlide}
              min={1}
              max={MAX_UNITS}
              onChange={unitsPerSlide =>
                setOptions(current => ({...current, unitsPerSlide}))
              }
            />
          </DialogField>
          <DialogField label="이름표 인식">
            <Checkbox
              aria-label="이름표 인식"
              checked={options.labels === 'bracketLine'}
              onChange={checked =>
                setOptions(current => ({
                  ...current,
                  labels: checked ? 'bracketLine' : 'off',
                }))
              }
            />
          </DialogField>
        </>
      }
    >
      <div className={styles.content}>
        <div className={styles.title}>
          <TextField
            aria-label="제목"
            block
            value={shownTitle}
            onChange={setTitle}
            maxLength={SONG_IMPORT_LIMITS.name}
            invalid={reason !== undefined}
            invalidReason={reason}
          />
          <span className={styles.count}>슬라이드 {numbers.length}</span>
        </div>
        <div className={styles.preview}>
          {preview.draft === null ? null : (
            <VirtualSlides
              song={preview.draft}
              numbers={numbers}
              labels={labels}
              selected={
                selected !== undefined && selected < numbers.length
                  ? selected
                  : undefined
              }
              onSelect={setSelected}
              baseline={PREVIEW_COLUMNS}
              scale={PREVIEW_SCALE}
            />
          )}
        </div>
      </div>
    </Dialog>
  );
}
