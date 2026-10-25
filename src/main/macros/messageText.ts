import type {MessageTemplate} from '@shared/schema/messages';

export const MAX_MACRO_MESSAGE_CHARACTERS = 4000;
const MAX_BLANK_NAME_IN_ERROR = 128;

export function fillMacroMessage(
  template: MessageTemplate,
  values: Readonly<Record<string, string>>,
): string {
  if (template.text.length > MAX_MACRO_MESSAGE_CHARACTERS) {
    throw new Error('Macro message is too long');
  }
  let length = 0;
  let position = 0;
  const filled = template.text.replace(
    /\{([^{}]+)\}/gu,
    (match: string, name: string, offset: number) => {
      const value = values[name];
      if (value === undefined || value.trim() === '') {
        throw new Error(
          `Missing message value: ${name.slice(0, MAX_BLANK_NAME_IN_ERROR)}`,
        );
      }
      length += offset - position + value.length;
      position = offset + match.length;
      if (length > MAX_MACRO_MESSAGE_CHARACTERS) {
        throw new Error('Macro message is too long');
      }
      return value;
    },
  );
  if (filled.length > MAX_MACRO_MESSAGE_CHARACTERS) {
    throw new Error('Macro message is too long');
  }
  return filled;
}
