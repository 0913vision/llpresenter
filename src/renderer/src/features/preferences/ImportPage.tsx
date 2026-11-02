import {PropertyGroup} from '@renderer/ui/PropertyRow';
import type {PreferenceEdits} from './usePreferenceEdits';
import {SelectRow} from './PreferenceRows';

const SPLIT_OPTIONS = [
  {value: 'blankLine', label: '빈 줄'},
  {value: 'lineBreak', label: '줄 바꿈'},
  {value: 'symbol', label: '기호'},
] as const;
const LABEL_OPTIONS = [
  {value: 'bracketLine', label: '대괄호 줄'},
  {value: 'off', label: '사용 안 함'},
] as const;
const FIRST_LINE_OPTIONS = [
  {value: 'title', label: '제목'},
  {value: 'lyrics', label: '가사'},
] as const;
const ENCODING_OPTIONS = [
  {value: 'auto', label: '자동'},
  {value: 'utf-8', label: 'UTF-8'},
  {value: 'cp949', label: 'CP949'},
] as const;

/** 가져오기: the defaults of the text import. */
export function ImportPage({edits}: {readonly edits: PreferenceEdits}) {
  const {preferences, lockedReason, change}: PreferenceEdits = edits;
  if (preferences === null) return null;
  const {txt} = preferences.import;
  const disabled = lockedReason !== undefined;
  const set =
    <TKey extends keyof typeof txt>(key: TKey) =>
    (value: (typeof txt)[TKey]): void =>
      change(stored => ({
        ...stored,
        import: {...stored.import, txt: {...stored.import?.txt, [key]: value}},
      }));
  return (
    <PropertyGroup title="txt">
      <SelectRow
        label="슬라이드 나누기"
        disabled={disabled}
        title={lockedReason}
        options={SPLIT_OPTIONS}
        value={txt.split}
        onChange={set('split')}
      />
      <SelectRow
        label="이름표"
        disabled={disabled}
        title={lockedReason}
        options={LABEL_OPTIONS}
        value={txt.labels}
        onChange={set('labels')}
      />
      <SelectRow
        label="첫 줄"
        disabled={disabled}
        title={lockedReason}
        options={FIRST_LINE_OPTIONS}
        value={txt.firstLine}
        onChange={set('firstLine')}
      />
      <SelectRow
        label="글자 인코딩"
        disabled={disabled}
        title={lockedReason}
        options={ENCODING_OPTIONS}
        value={txt.encoding}
        onChange={set('encoding')}
      />
    </PropertyGroup>
  );
}
