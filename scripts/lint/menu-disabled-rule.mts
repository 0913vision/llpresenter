import type {Rule} from 'eslint';
import type {ObjectExpression, Property} from 'estree';

function keyName(property: Property): string | undefined {
  const {key} = property;
  if (property.computed) return undefined;
  if (key.type === 'Identifier') return key.name;
  return key.type === 'Literal' ? String(key.value) : undefined;
}

function namedProperty(
  object: ObjectExpression,
  name: string,
): Property | undefined {
  return object.properties.find(
    (entry): entry is Property =>
      entry.type === 'Property' && keyName(entry) === name,
  );
}

function isLiteral(property: Property | undefined, value: unknown): boolean {
  return property?.value.type === 'Literal' && property.value.value === value;
}

/**
 * A menu row written with `disabled: true` must carry the reason as its
 * `title`. Write the pair with `menuAvailability(reason)`, which derives both
 * from one value, so a row never turns gray without saying why.
 */
export const menuDisabledReasonRule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      bareDisabled:
        'A disabled menu row needs its reason: spread menuAvailability(reason) instead of writing disabled: true by hand.',
    },
  },
  create(context) {
    return {
      ObjectExpression(object) {
        if (!isLiteral(namedProperty(object, 'kind'), 'item')) return;
        const disabled = namedProperty(object, 'disabled');
        if (!isLiteral(disabled, true)) return;
        if (namedProperty(object, 'title') !== undefined) return;
        context.report({node: disabled ?? object, messageId: 'bareDisabled'});
      },
    };
  },
};
