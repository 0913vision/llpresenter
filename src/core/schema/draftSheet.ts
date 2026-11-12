import * as v from 'valibot';

const schema = v.object({
  mode: v.picklist(['chords', 'staff', 'staff-next']),
  xml: v.string(),
  slides: v.object({
    song: v.string(),
    slides: v.array(
      v.object({
        lines: v.array(v.string()),
        systems: v.array(v.tuple([v.number(), v.number()])),
      }),
    ),
  }),
});
export type Draft = v.InferOutput<typeof schema>;

export function parseDraftSheet(value: unknown): Draft | null {
  const result = v.safeParse(schema, value);
  return result.success ? result.output : null;
}
