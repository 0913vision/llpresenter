import type {LlpApi} from '@contracts/ipc/api';
import {duplicateAfter} from '@core/common/duplicateAfter';
import type {EditResult} from '@core/schema/services/contentEdit';
import {NAME_LIMIT} from '@core/schema/common/primitives';
import {
  serializeProps,
  type Prop,
  type PropsFile,
} from '@core/schema/tools/props';
import {nameReason} from '@renderer/ui/fields/nameReason';
import {
  editableSettings,
  unchangedSettings,
  writeSettings,
} from '@renderer/session/settingsWrites';

export const MAX_PROPS = 500;
const MAX_TEXT = 4000;

export type PropEdit =
  | {readonly kind: 'add'; readonly prop: Prop}
  | {readonly kind: 'update'; readonly prop: Prop}
  | {
      readonly kind: 'duplicate';
      readonly id: Prop['id'];
      readonly copyId: Prop['id'];
    }
  | {readonly kind: 'delete'; readonly id: Prop['id']};

export function propReason(prop: Prop): string | undefined {
  const named = nameReason(prop.name, NAME_LIMIT);
  if (named !== undefined) return named;
  if (prop.targets.length === 0) return '화면을 골라야 저장할 수 있습니다.';
  if (prop.content.kind === 'text') {
    if (!prop.content.text.trim()) return '내용을 적어야 저장할 수 있습니다.';
    if (prop.content.text.length > MAX_TEXT) return '내용이 너무 깁니다.';
  }
  return undefined;
}

function apply(file: PropsFile, edit: PropEdit): PropsFile {
  if (edit.kind === 'duplicate') {
    const next = {
      ...file,
      props: duplicateAfter(file.props, edit, {
        limit: MAX_PROPS,
        maxName: NAME_LIMIT,
      }),
    };
    if (!serializeProps(next, 'props').ok) throw new Error('Invalid prop');
    return next;
  }
  if (edit.kind === 'delete') {
    return {...file, props: file.props.filter(prop => prop.id !== edit.id)};
  }
  if (propReason(edit.prop)) throw new Error('Invalid prop');
  const existing = file.props.find(prop => prop.id === edit.prop.id);
  if (edit.kind === 'add' && existing) return file;
  if (edit.kind === 'add' && file.props.length >= MAX_PROPS) {
    throw new Error('The prop list is full');
  }
  if (edit.kind === 'update' && !existing) {
    throw new Error('Prop no longer exists');
  }
  const oldContent = existing?.content;
  const newContent = edit.prop.content;
  const content =
    oldContent?.kind === newContent.kind
      ? {
          ...oldContent,
          ...newContent,
          ...(oldContent.kind === 'text' && newContent.kind === 'text'
            ? {style: {...oldContent.style, ...newContent.style}}
            : {}),
        }
      : newContent;
  const prop = {
    ...existing,
    ...edit.prop,
    content,
    name: edit.prop.name.trim(),
  };
  const next = {
    ...file,
    props:
      edit.kind === 'add'
        ? [...file.props, prop]
        : file.props.map(item => (item.id === prop.id ? prop : item)),
  };
  if (!serializeProps(next, 'props').ok) throw new Error('Invalid prop');
  return next;
}

export function savePropEdit(api: LlpApi, edit: PropEdit): Promise<EditResult> {
  return writeSettings(api, async () => {
    const document = await editableSettings(api, 'props');
    const value = apply(document.value, edit);
    return value === document.value
      ? unchangedSettings(document)
      : {
          type: 'settings.update',
          name: 'props',
          baseRevision: document.revision,
          value,
        };
  });
}
