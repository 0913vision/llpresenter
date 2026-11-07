import {useCallback, useMemo, useState, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {LibrarySong} from '@core/schema/contentDocuments';
import {createSongId} from '@core/schema/ids';
import {SONG_SCHEMA_VERSION, type Song} from '@core/schema/song';
import type {Label} from '@core/schema/labels';
import type {Preferences} from '@core/schema/preferences';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import type {
  TextImportDraft,
  TextImportOptions,
  TextImportSource,
} from '@core/schema/textImport';
import {Checkbox, NumberField, TextField} from '@renderer/ui';
import {Dialog, DialogField} from '@renderer/ui/Dialog';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import type {Notice} from '@renderer/ui/notices';
import {VirtualSlides} from '../editor/VirtualSlides';
import {
  DUPLICATE_TITLE_REASON,
  normalizeSongTitle,
} from '@core/songs/songTitle';
import {importSlides} from '@core/songs/importSlides';
import {importLimitReason} from '@core/songs/importLimits';
import {textImportHeaders} from '@core/songs/textImport';
import {
  applyImportLabelMapping,
  importHeaderKey,
  matchingImportLabel,
  suggestImportLabel,
} from '@core/songs/importLabelMapping';
import {TEXT_ENCODINGS} from './textEncodings';
import {ImportLabelMappingDialog} from './ImportLabelMappingDialog';
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
const FIRST_LINES = [
  {value: 'title', label: '제목'},
  {value: 'lyrics', label: '가사'},
] as const;

/** The choices of the dialog that the next import starts from. */
export type TextImportChoice = Partial<Preferences['import']['txt']>;

function previewSong(draft: TextImportDraft, title: string): Song {
  let count = 0;
  const candidateId = (): string =>
    `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
  return {
    format: 'llsong',
    schemaVersion: SONG_SCHEMA_VERSION,
    id: createSongId('00000000-0000-4000-8000-000000000000'),
    title,
    slides: importSlides(draft.slides, candidateId),
  };
}

export function TextImportDialog({
  api,
  source,
  defaults,
  library,
  labels,
  onEdit,
  onDiscard,
  onProblem,
  onRemember,
  onEncoding,
  reading = false,
}: {
  readonly api: LlpApi['textImport'];
  readonly source: TextImportSource;
  readonly defaults: Preferences['import']['txt'];
  readonly library: readonly LibrarySong[];
  readonly labels: readonly Label[];
  readonly onEdit: (draft: TextImportDraft) => void;
  readonly onDiscard: () => void;
  readonly onProblem: (notice: Notice) => void;
  /** Called with each changed choice, so the next import starts from it. */
  readonly onRemember?: ((choice: TextImportChoice) => void) | undefined;
  /** True while the file is read again; 편집 waits for it. */
  readonly reading?: boolean | undefined;
  /** Reads the same file again with this encoding. */
  readonly onEncoding?:
    ((encoding: Preferences['import']['txt']['encoding']) => void) | undefined;
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
  const headers = useMemo(() => textImportHeaders(source.text), [source.text]);
  const exactMapping = useMemo(
    () =>
      new Map(
        headers.map(header => [
          importHeaderKey(header.name),
          matchingImportLabel(header.name, labels)?.name ?? header.name,
        ]),
      ),
    [headers, labels],
  );
  const [mappingRequested, setMappingRequested] = useState(true);
  const [edits, setEdits] = useState<ReadonlyMap<string, string>>(new Map());
  const changeChoice = useCallback((key: string, value: string) => {
    setEdits(current => new Map(current).set(key, value));
  }, []);
  const [applied, setApplied] = useState<ReadonlyMap<string, string> | null>(
    null,
  );
  const suggestions = useMemo(
    () =>
      new Map(
        headers.map(header => {
          const key = importHeaderKey(header.name);
          return [key, suggestImportLabel(header.name, labels)];
        }),
      ),
    [headers, labels],
  );
  const choices = useMemo(
    () => new Map([...suggestions, ...edits]),
    [suggestions, edits],
  );
  const selectedMapping = useMemo(
    () =>
      new Map(
        [...choices].map(([key, value]) => [
          key,
          matchingImportLabel(value, labels)?.name ?? value.trim(),
        ]),
      ),
    [choices, labels],
  );
  const preview = useImportPreview({api, source, options, onProblem});
  const draft = useMemo(
    () =>
      preview.draft === null || options.labels === 'off'
        ? preview.draft
        : applyImportLabelMapping(preview.draft, applied ?? exactMapping),
    [preview.draft, applied, exactMapping, options.labels],
  );
  const mappingOpen =
    options.labels === 'bracketLine' &&
    mappingRequested &&
    draft !== null &&
    headers.some(
      header => matchingImportLabel(header.name, labels) === undefined,
    );
  const shownTitle = title ?? preview.draft?.title ?? '';
  const reason = library.some(
    song => normalizeSongTitle(song.title) === normalizeSongTitle(shownTitle),
  )
    ? DUPLICATE_TITLE_REASON
    : undefined;
  const numbers = useMemo(
    () => draft?.slides.map((_, index) => index + 1) ?? [],
    [draft],
  );
  const candidateSong = useMemo<Song | null>(() => {
    if (draft === null) return null;
    return previewSong(draft, shownTitle);
  }, [draft, shownTitle]);
  const draftReason = useMemo(
    () =>
      candidateSong === null ? undefined : importLimitReason(candidateSong),
    [candidateSong],
  );
  const mappingReason = useMemo(
    () =>
      !mappingOpen || preview.draft === null
        ? undefined
        : importLimitReason(
            previewSong(
              applyImportLabelMapping(preview.draft, selectedMapping),
              shownTitle,
            ),
          ),
    [mappingOpen, preview.draft, selectedMapping, shownTitle],
  );
  return (
    <>
      <Dialog
        title="텍스트 가져오기"
        size="xl"
        subtitle={{
          icon: 'filetext',
          text: source.fileName ?? '클립보드 텍스트',
        }}
        onCancel={onDiscard}
        cancelLabel="저장 안 함"
        primary={{
          label: '편집',
          disabled:
            reading || preview.draft === null || draftReason !== undefined,
          title:
            draftReason ??
            (reading ? '파일을 다시 읽는 중' : undefined) ??
            (preview.invalidSymbol
              ? '나누기 기호를 적어야 합니다'
              : preview.pending
                ? '미리보기 준비 중'
                : preview.draft === null
                  ? '가져올 슬라이드가 없습니다'
                  : undefined),
          onSelect: () => {
            if (!reading && draft && draftReason === undefined) {
              onEdit({...draft, title: shownTitle});
            }
          },
        }}
        topBar={
          <>
            <DialogField label="슬라이드 나누기">
              <SelectMenu
                aria-label="슬라이드 나누기"
                options={SPLITS}
                value={options.split}
                onChange={split => {
                  onRemember?.({split});
                  setOptions(current => {
                    const {symbol, ...shared} = current;
                    return {
                      ...shared,
                      split,
                      ...(split === 'symbol'
                        ? {symbol: symbol?.trim() ? symbol : '/'}
                        : {}),
                      unitsPerSlide: split === 'lineBreak' ? 2 : 1,
                    };
                  });
                }}
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
                onChange={checked => {
                  if (checked) setMappingRequested(true);
                  onRemember?.({labels: checked ? 'bracketLine' : 'off'});
                  setOptions(current => ({
                    ...current,
                    labels: checked ? 'bracketLine' : 'off',
                  }));
                }}
              />
            </DialogField>
            {source.source === 'clipboard' ? (
              <DialogField label="첫 줄">
                <SelectMenu
                  aria-label="첫 줄"
                  options={FIRST_LINES}
                  value={options.firstLine}
                  onChange={firstLine => {
                    onRemember?.({firstLine});
                    setOptions(current => ({...current, firstLine}));
                  }}
                />
              </DialogField>
            ) : (
              <DialogField label="글자 인코딩">
                <SelectMenu
                  aria-label="글자 인코딩"
                  options={TEXT_ENCODINGS}
                  value={defaults.encoding}
                  disabled={reading}
                  onChange={encoding => onEncoding?.(encoding)}
                />
              </DialogField>
            )}
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
            {candidateSong === null ? null : (
              <VirtualSlides
                song={candidateSong}
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
      {mappingOpen ? (
        <ImportLabelMappingDialog
          headers={headers}
          labels={labels}
          choices={choices}
          applyReason={mappingReason}
          onChange={changeChoice}
          onApply={() => {
            if (mappingReason !== undefined) return;
            setApplied(selectedMapping);
            setEdits(selectedMapping);
            setMappingRequested(false);
          }}
          onKeep={() => {
            setApplied(new Map());
            setMappingRequested(false);
          }}
        />
      ) : null}
    </>
  );
}
