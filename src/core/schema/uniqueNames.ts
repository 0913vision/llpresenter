import * as v from 'valibot';

/** Rejects repeated names with an issue at each repeated item. */
export function uniqueNames<T extends {readonly name: string}>(
  message: string,
) {
  return v.rawCheck<T[]>(({dataset, addIssue}) => {
    if (!dataset.typed) return;
    const seen = new Set<string>();
    for (const [index, item] of dataset.value.entries()) {
      if (seen.has(item.name)) {
        addIssue({
          input: item,
          message,
          path: [
            {
              type: 'array',
              origin: 'value',
              input: dataset.value,
              key: index,
              value: item,
            },
          ],
        });
      } else {
        seen.add(item.name);
      }
    }
  });
}
