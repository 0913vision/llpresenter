import {memo, useRef, useState, type JSX} from 'react';
import type {Label} from '@core/schema/labels';
import {TEXT_IMPORT_LIMITS} from '@core/songs/textImportLimits';
import type {ImportHeader} from '@core/songs/textImport';
import {
  importHeaderKey,
  matchingImportLabel,
} from '@core/songs/importLabelMapping';
import {Dialog} from '@renderer/ui/Dialog';
import {Icon} from '@renderer/ui/Icon';
import {LabelSwatch} from '@renderer/ui/LabelChip';
import {Menu} from '@renderer/ui/Menu';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {labelMenuEntries} from '../editor/labelMenuEntries';
import {useImportLabelWindow} from './useImportLabelWindow';
import styles from './ImportLabelMappingDialog.module.css';

function LabelField({
  header,
  value,
  labels,
  onChange,
}: {
  readonly header: string;
  readonly value: string;
  readonly labels: readonly Label[];
  readonly onChange: (value: string) => void;
}): JSX.Element {
  const [field, setField] = useState<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [menuTakesFocus, setMenuTakesFocus] = useState(false);
  const current = matchingImportLabel(value, labels);
  return (
    <>
      <div
        ref={setField}
        className={styles.field}
        onClick={() => {
          input.current?.focus();
          setMenuTakesFocus(false);
          setOpen(true);
        }}
      >
        {current === undefined ? null : <LabelSwatch color={current.color} />}
        <input
          ref={input}
          aria-label={`[${header}] 이름표`}
          aria-haspopup="menu"
          aria-expanded={open}
          placeholder="이름표 없음"
          value={value}
          maxLength={TEXT_IMPORT_LIMITS.label}
          onFocus={event => event.currentTarget.select()}
          onChange={event => {
            onChange(event.currentTarget.value);
            setOpen(false);
          }}
          onKeyDown={event => {
            if (isComposing(event) || hasModifier(event)) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setMenuTakesFocus(true);
              setOpen(true);
            } else if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === 'Tab') setOpen(false);
          }}
        />
        {current === undefined && value.trim() !== '' ? (
          <span className={styles.caption}>새 이름표</span>
        ) : null}
        <button
          type="button"
          aria-label={`[${header}] 이름표 목록`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={event => {
            event.stopPropagation();
            setMenuTakesFocus(true);
            setOpen(value => !value);
          }}
        >
          <Icon name="down" size={12} />
        </button>
      </div>
      {open && field !== null ? (
        <Menu
          label={`[${header}] 이름표`}
          entries={labelMenuEntries({
            labels,
            selected:
              value.trim() === '' ? undefined : (current?.name ?? value),
            choose: name => onChange(name ?? ''),
          })}
          anchor={{kind: 'element', element: field}}
          width="var(--size-menu-max)"
          autoFocus={menuTakesFocus}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function ImportLabelMappingDialog({
  headers,
  labels,
  choices,
  applyReason,
  onChange,
  onApply,
  onKeep,
}: {
  readonly headers: readonly ImportHeader[];
  readonly labels: readonly Label[];
  readonly choices: ReadonlyMap<string, string>;
  readonly applyReason?: string | undefined;
  readonly onChange: (key: string, value: string) => void;
  readonly onApply: () => void;
  readonly onKeep: () => void;
}): JSX.Element {
  const {
    viewport,
    indices,
    stride,
    height,
    onScroll,
    onFocusCapture,
    onKeyDownCapture,
  } = useImportLabelWindow(headers.length);
  return (
    <Dialog
      title="이름표 맞추기"
      size="m"
      onCancel={onKeep}
      cancelLabel="머리줄 그대로 쓰기"
      primary={{
        label: '적용',
        onSelect: onApply,
        disabled: applyReason !== undefined,
        title: applyReason,
      }}
    >
      <div className={styles.content}>
        <p className={styles.intro}>
          머리줄마다 이름표를 고르거나 적으세요. 비슷한 이름표를 먼저 넣어
          두었습니다.
        </p>
        <div
          role="table"
          aria-label="머리줄 이름표"
          aria-rowcount={headers.length + 1}
          className={styles.table}
        >
          <div role="row" className={styles.heading}>
            <span role="columnheader">머리줄</span>
            <span role="columnheader">이름표</span>
            <span role="columnheader">첫 줄</span>
          </div>
          <div
            role="rowgroup"
            aria-label="머리줄 목록"
            className={styles.rows}
            ref={viewport}
            onScroll={onScroll}
            onKeyDownCapture={onKeyDownCapture}
            onFocusCapture={onFocusCapture}
          >
            <div className={styles.spacer} style={{height}}>
              {indices.map(index => {
                const header = headers[index];
                return header === undefined ? null : (
                  <MappingRow
                    key={importHeaderKey(header.name)}
                    index={index}
                    top={index * stride}
                    header={header}
                    value={
                      choices.get(importHeaderKey(header.name)) ?? header.name
                    }
                    labels={labels}
                    onChange={onChange}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const MappingRow = memo(
  ({
    header,
    index,
    top,
    value,
    labels,
    onChange,
  }: {
    readonly header: ImportHeader;
    readonly index: number;
    readonly top: number;
    readonly value: string;
    readonly labels: readonly Label[];
    readonly onChange: (key: string, value: string) => void;
  }): JSX.Element => {
    return (
      <div
        role="row"
        aria-rowindex={index + 2}
        data-header-index={index}
        className={styles.row}
        style={{top}}
      >
        <span role="cell" className={styles.header}>
          [{header.name}]
        </span>
        <div role="cell">
          <LabelField
            header={header.name}
            value={value}
            labels={labels}
            onChange={value => onChange(importHeaderKey(header.name), value)}
          />
        </div>
        <span role="cell" className={styles.firstLine}>
          {header.firstLine}
        </span>
      </div>
    );
  },
);
