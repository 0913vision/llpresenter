import {useMemo, useState, type JSX} from 'react';
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
import {TextField} from '@renderer/ui';
import {Dialog} from '@renderer/ui/Dialog';
import type {Notice} from '@renderer/ui/notices';
import {useLabelColors} from '@renderer/features/labels/labels';
import {slideMaking, useThemes} from '@renderer/platform/themes';
import {newSongSlides, songSlides, songTiles} from '@core/slides';
import {SlidePreviewGrid} from './SlidePreviewGrid';
import {
  DUPLICATE_TITLE_REASON,
  normalizeSongTitle,
  importLimitReason,
  applyImportLabelMapping,
} from '@core/songs';
import {ImportLabelMappingDialog} from './ImportLabelMappingDialog';
import {useImportLabelMapping} from './useImportLabelMapping';
import {useImportPreview} from './useImportPreview';
import {TextImportChoices, type TextImportChoice} from './TextImportChoices';
import styles from './TextImportDialog.module.css';

export type {TextImportChoice} from './TextImportChoices';

/** The song a draft becomes, with the title slide the editor adds. */
function songOf(draft: TextImportDraft, title: string): Song {
  const making = slideMaking();
  return {
    format: 'llsong',
    schemaVersion: SONG_SCHEMA_VERSION,
    id: createSongId('00000000-0000-4000-8000-000000000000'),
    title,
    slides: [
      ...newSongSlides(making, title).slice(0, 1),
      ...songSlides(making, draft),
    ],
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
  const themes = useThemes(view => view.themes);
  const colors = useLabelColors();
  const [title, setTitle] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const mapping = useImportLabelMapping(source.text, labels);
  const preview = useImportPreview({api, source, options, onProblem});
  const draft = useMemo(
    () =>
      preview.draft === null || options.labels === 'off'
        ? preview.draft
        : applyImportLabelMapping(preview.draft, mapping.inUse),
    [preview.draft, mapping.inUse, options.labels],
  );
  const mappingOpen =
    options.labels === 'bracketLine' && mapping.asking && draft !== null;
  const shownTitle = title ?? preview.draft?.title ?? '';
  const reason = library.some(
    song => normalizeSongTitle(song.title) === normalizeSongTitle(shownTitle),
  )
    ? DUPLICATE_TITLE_REASON
    : undefined;
  const song = useMemo(
    () =>
      draft === null || themes === null ? null : songOf(draft, shownTitle),
    [draft, shownTitle, themes],
  );
  const tiles = useMemo(
    () => (song === null ? [] : songTiles(song, colors)),
    [song, colors],
  );
  const draftReason = useMemo(
    () => (song === null ? undefined : importLimitReason(song)),
    [song],
  );
  const mappingReason = useMemo(
    () =>
      !mappingOpen || preview.draft === null
        ? undefined
        : importLimitReason(
            songOf(
              applyImportLabelMapping(preview.draft, mapping.chosen),
              shownTitle,
            ),
          ),
    [mappingOpen, preview.draft, mapping.chosen, shownTitle],
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
              ? '나누기 기호를 적어야 합니다.'
              : preview.pending
                ? '미리보기 준비 중'
                : preview.draft === null
                  ? '가져올 슬라이드가 없습니다.'
                  : undefined),
          onSelect: () => {
            if (!reading && draft && draftReason === undefined) {
              onEdit({...draft, title: shownTitle});
            }
          },
        }}
        topBar={
          <TextImportChoices
            options={options}
            setOptions={setOptions}
            fromClipboard={source.source === 'clipboard'}
            encoding={defaults.encoding}
            reading={reading}
            invalidSymbol={preview.invalidSymbol}
            onLabelsOn={mapping.ask}
            onRemember={onRemember}
            onEncoding={onEncoding}
          />
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
            <span className={styles.count}>슬라이드 {tiles.length}</span>
          </div>
          <div className={styles.preview}>
            <SlidePreviewGrid
              tiles={tiles}
              numberOf={index => index + 1}
              isSelected={index => index === selected}
              onSelect={setSelected}
            />
          </div>
        </div>
      </Dialog>
      {mappingOpen ? (
        <ImportLabelMappingDialog
          headers={mapping.headers}
          labels={labels}
          choices={mapping.choices}
          applyReason={mappingReason}
          onChange={mapping.change}
          onApply={() => {
            if (mappingReason === undefined) mapping.apply();
          }}
          onKeep={mapping.keep}
        />
      ) : null}
    </>
  );
}
