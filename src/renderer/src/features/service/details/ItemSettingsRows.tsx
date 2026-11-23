import {useMemo, type JSX} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {withMemo, withStartMacro} from '@core/services';
import type {SlidesItem} from '@core/schema/service';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {runEdit, type Report} from '@renderer/session/serviceEdit';
import {
  useFollowedDocument,
  type DocumentSource,
} from '@renderer/platform/useFollowedDocument';
import {editItem} from '@renderer/session/openService';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {Select} from '@renderer/ui/Select';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {TextArea} from '@renderer/ui/TextArea';

const NONE = '없음';
const NO_MACRO = '';
const MACRO_META = '매크로';
const MISSING_MACRO = '매크로 없음';
const LOADING_REASON = '불러오는 중';
const MACROS_FAILED_REASON = '매크로를 불러오지 못했습니다.';

type MacrosDocument = Extract<SettingsDocument, {name: 'macros'}>;
export type Macro = MacrosDocument['value']['macros'][number];

/** A reference names a 매크로 by its ID. */
export function resolveMacro(
  macros: readonly Macro[],
  reference: string | undefined,
): Macro | undefined {
  if (reference === undefined) return undefined;
  return macros.find(macro => macro.id === reference);
}

export function useMacros(api: LlpApi['settings']) {
  const source = useMemo<DocumentSource<MacrosDocument>>(
    () => ({
      read: async () => {
        const document = await api.get({name: 'macros'});
        if (document.name !== 'macros') {
          throw new Error('The macros read answered another document');
        }
        return document;
      },
      follow: accept =>
        api.subscribe(document => {
          if (document.name === 'macros') accept(document);
        }),
      // NOTE(0913vision): The window keeps the 매크로 list, so 시작할 때 is
      // ready in the panel's first frame instead of disabled for a moment.
      kept: {
        owner: api,
        name: 'macros',
        is: (document: {
          readonly revision: number;
        }): document is MacrosDocument =>
          'name' in document && document.name === 'macros',
      },
    }),
    [api],
  );
  return useFollowedDocument(source);
}

interface RowProps {
  readonly item: SlidesItem;
  readonly lockReason: string | undefined;
  readonly report: Report;
}

/** 시작할 때: the 매크로 that runs when the item starts, or 없음. */
export function ItemStartRow({
  api,
  item,
  lockReason,
  report,
}: RowProps & {readonly api: Pick<LlpApi, 'settings'>}): JSX.Element {
  const macros = useMacros(api.settings);
  const list = macros.document?.value.macros ?? [];
  const current = resolveMacro(list, item.macro);
  if (macros.failed && lockReason === undefined) {
    return (
      <PropertyRow label="시작할 때">
        {({controlId}) => (
          <Select
            id={controlId}
            block
            value={NONE}
            title={MACROS_FAILED_REASON}
            expanded={false}
            onExpandedChange={() => macros.retry()}
          />
        )}
      </PropertyRow>
    );
  }
  const reason =
    lockReason ?? (macros.document === null ? LOADING_REASON : undefined);
  return (
    <PropertyRow label="시작할 때">
      {({controlId}) => (
        <SelectMenu
          id={controlId}
          block
          menuLabel="시작할 때"
          options={[
            {value: NO_MACRO, label: NONE},
            ...list.map(macro => ({value: macro.id, label: macro.name})),
          ]}
          value={current?.id ?? item.macro ?? NO_MACRO}
          valueText={
            current?.name ?? (item.macro === undefined ? NONE : MISSING_MACRO)
          }
          lead={
            current === undefined
              ? undefined
              : {kind: 'tile', color: current.color, icon: current.icon}
          }
          meta={current === undefined ? undefined : MACRO_META}
          title={reason}
          disabled={reason !== undefined}
          onChange={value =>
            runEdit(
              editItem(item.id, entry =>
                withStartMacro(entry, value === NO_MACRO ? undefined : value),
              ),
              report,
            )
          }
        />
      )}
    </PropertyRow>
  );
}

/** 메모: what the operator notes on the item. */
export function ItemMemo({item, lockReason, report}: RowProps): JSX.Element {
  return (
    <TextArea
      aria-label="메모"
      value={item.memo ?? ''}
      readOnly={lockReason !== undefined}
      title={lockReason}
      onChange={memo =>
        runEdit(
          editItem(item.id, entry => withMemo(entry, memo), {
            key: `memo:${item.id}`,
          }),
          report,
        )
      }
    />
  );
}
