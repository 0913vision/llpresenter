import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {serializeProps, type Prop, type PropsFile} from '@shared/schema/props';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {withinLookupTimeout} from '@renderer/state/showOutput';

export const MAX_PROPS = 500;
const MAX_NAME = 256;
const MAX_TEXT = 4000;
const ATTEMPTS = 2;

export type PropEdit =
  | {readonly kind: 'add'; readonly prop: Prop}
  | {readonly kind: 'update'; readonly prop: Prop}
  | {readonly kind: 'delete'; readonly id: Prop['id']};

export function propReason(prop: Prop): string | undefined {
  if (!prop.name.trim()) return '이름을 입력하세요';
  if (prop.name.trim().length > MAX_NAME) return '이름이 너무 깁니다';
  if (prop.targets.length === 0) return '화면을 선택하세요';
  if (prop.content.kind === 'text') {
    if (!prop.content.text.trim()) return '내용을 입력하세요';
    if (prop.content.text.length > MAX_TEXT) return '내용이 너무 깁니다';
  }
  return undefined;
}

function apply(file: PropsFile, edit: PropEdit): PropsFile {
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

export async function savePropEdit(
  api: LlpApi,
  edit: PropEdit,
): Promise<EditResult> {
  const result = await pendingWritesOf(api).run<EditResult | null>({
    write: () => send(api, edit),
    refused: null,
    sent: outcome =>
      outcome !== null &&
      (outcome.ok || outcome.error.reason === 'write-failed'),
  });
  if (result === null) throw new Error('Prop edits stopped for closing');
  return result;
}

async function send(
  api: LlpApi,
  edit: PropEdit,
  attempt = 0,
): Promise<EditResult> {
  const document = await withinLookupTimeout(() =>
    api.settings.get({name: 'props'}),
  );
  if (document.name !== 'props' || document.access !== 'editable') {
    throw new Error('Prop settings cannot be edited');
  }
  const value = apply(document.value, edit);
  if (value === document.value) {
    return {ok: true, value: {id: 'props', revision: document.revision}};
  }
  const result = await api.settings.edit({
    type: 'settings.update',
    name: 'props',
    baseRevision: document.revision,
    value,
  });
  if (result.ok || result.error.reason === 'write-failed') return result;
  if (result.error.reason === 'stale' && attempt + 1 < ATTEMPTS) {
    return send(api, edit, attempt + 1);
  }
  throw new Error(result.error.message);
}
