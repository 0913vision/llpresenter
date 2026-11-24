import type {Dispatch, JSX, SetStateAction} from 'react';
import type {Preferences} from '@core/schema/app/preferences';
import type {TextImportOptions} from '@core/schema/songs/textImport';
import {Checkbox} from '@renderer/ui/choices/Checkbox';
import {NumberField} from '@renderer/ui/fields/NumberField';
import {TextField} from '@renderer/ui/fields/TextField';
import {DialogField} from '@renderer/ui/popups/Dialog';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {TEXT_ENCODINGS} from './textEncodings';

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

/**
 * The choices over the preview of 텍스트 가져오기: how the text is cut into
 * slides, whether [이름표] lines are read, and the first line of clipboard
 * text or the encoding of a file.
 */
export function TextImportChoices({
  options,
  setOptions,
  fromClipboard,
  encoding,
  reading,
  invalidSymbol,
  onLabelsOn,
  onRemember,
  onEncoding,
}: {
  readonly options: TextImportOptions;
  readonly setOptions: Dispatch<SetStateAction<TextImportOptions>>;
  readonly fromClipboard: boolean;
  readonly encoding: Preferences['import']['txt']['encoding'];
  /** The file is read again. */
  readonly reading: boolean;
  readonly invalidSymbol: boolean;
  /** 이름표 인식 was turned on. */
  readonly onLabelsOn: () => void;
  readonly onRemember: ((choice: TextImportChoice) => void) | undefined;
  readonly onEncoding:
    ((encoding: Preferences['import']['txt']['encoding']) => void) | undefined;
}): JSX.Element {
  return (
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
            onChange={symbol => setOptions(current => ({...current, symbol}))}
            maxLength={MAX_SYMBOL}
            invalid={invalidSymbol}
            invalidReason="나누기 기호를 적어야 합니다."
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
            if (checked) onLabelsOn();
            onRemember?.({labels: checked ? 'bracketLine' : 'off'});
            setOptions(current => ({
              ...current,
              labels: checked ? 'bracketLine' : 'off',
            }));
          }}
        />
      </DialogField>
      {fromClipboard ? (
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
            value={encoding}
            disabled={reading}
            onChange={encoding => onEncoding?.(encoding)}
          />
        </DialogField>
      )}
    </>
  );
}
