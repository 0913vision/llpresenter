import type {MessageTemplate} from './schema/messages';

export const MAX_MESSAGE_CHARACTERS = 4000;
const MAX_BLANK_NAME_IN_ERROR = 128;

function blankPattern(): RegExp {
  return /\{([^{}]+)\}/gu;
}

export function messageBlankNames(text: string): readonly string[] {
  if (text.length > MAX_MESSAGE_CHARACTERS) return [];
  return [
    ...new Set(
      Array.from(text.matchAll(blankPattern()), match => match[1] ?? ''),
    ),
  ];
}

export function fillMessageText(
  template: MessageTemplate,
  values: Readonly<Record<string, string>>,
): string {
  if (template.text.length > MAX_MESSAGE_CHARACTERS) {
    throw new Error('Macro message is too long');
  }
  let length = 0;
  let position = 0;
  const filled = template.text.replace(
    blankPattern(),
    (match: string, name: string, offset: number) => {
      const value = Object.hasOwn(values, name) ? values[name] : undefined;
      if (value === undefined || value.trim() === '') {
        throw new Error(
          `Missing message value: ${name.slice(0, MAX_BLANK_NAME_IN_ERROR)}`,
        );
      }
      length += offset - position + value.length;
      position = offset + match.length;
      if (length > MAX_MESSAGE_CHARACTERS) {
        throw new Error('Macro message is too long');
      }
      return value;
    },
  );
  if (filled.length > MAX_MESSAGE_CHARACTERS) {
    throw new Error('Macro message is too long');
  }
  return filled;
}
