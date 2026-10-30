import type {MessageStyleId} from '../schema/ids';
import {
  serializeLooks,
  type LooksFile,
  type MessageStyle,
} from '../schema/looks';

type BasicFields = Pick<
  MessageStyle,
  | 'font'
  | 'weight'
  | 'size'
  | 'color'
  | 'align'
  | 'vAlign'
  | 'lineHeight'
  | 'maxLines'
  | 'margin'
>;

/** Each change carries only the field that the operator edited. */
export type MessageStyleChange =
  | {readonly kind: 'text'; readonly change: Partial<BasicFields>}
  | {
      readonly kind: 'outline';
      readonly change: Partial<MessageStyle['outline']>;
    }
  | {readonly kind: 'shadow'; readonly change: Partial<MessageStyle['shadow']>}
  | {
      readonly kind: 'background';
      readonly change: NonNullable<MessageStyle['background']> | null;
    };

/** Applies and validates a message style edit against the newest queued file. */
export function editMessageStyle(
  file: LooksFile,
  id: MessageStyleId,
  edit: MessageStyleChange,
): LooksFile | undefined {
  const styles = file.messageStyles;
  const previous = styles?.find(style => style.id === id);
  if (previous === undefined) return undefined;
  let next: MessageStyle;
  switch (edit.kind) {
    case 'text':
      next = {...previous, ...edit.change};
      break;
    case 'outline':
      next = {...previous, outline: {...previous.outline, ...edit.change}};
      break;
    case 'shadow':
      next = {...previous, shadow: {...previous.shadow, ...edit.change}};
      break;
    case 'background': {
      const {background: _removed, ...rest} = previous;
      next =
        edit.change === null
          ? rest
          : {...rest, background: {...previous.background, ...edit.change}};
      break;
    }
  }
  const validated = serializeLooks(
    {
      format: file.format,
      schemaVersion: file.schemaVersion,
      current: file.current,
      looks: [],
      lyricStyles: [],
      messageStyles: [next],
    },
    'looks.json',
  );
  if (!validated.ok) return undefined;
  if (JSON.stringify(next) === JSON.stringify(previous)) return file;
  return {
    ...file,
    messageStyles: styles?.map(style => (style.id === id ? next : style)) ?? [],
  };
}
