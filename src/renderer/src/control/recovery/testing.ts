import {
  parseRecoverySummary,
  type RecoverySummary,
} from '@shared/schema/recovery';
import {expectSuccess} from '@shared/schema/testHelpers';

type Summary = NonNullable<RecoverySummary>;

const allRows = [
  {
    kind: 'outputs',
    screens: [
      {screenId: '10000000-0000-4000-8000-000000000001', name: '본 화면'},
      {screenId: '10000000-0000-4000-8000-000000000002', name: '무대 화면'},
    ],
  },
  {
    kind: 'slide',
    slide: {
      serviceId: '30000000-0000-4000-8000-000000000001',
      itemId: '40000000-0000-4000-8000-000000000001',
      title: '아침이 밝아 오네',
      position: 1,
      slideCount: 9,
    },
  },
  {
    kind: 'showing',
    counts: {
      messages: 1,
      props: 1,
      stageMessages: 1,
      notices: 0,
      stageLayouts: 0,
    },
  },
] as const;

/**
 * A checked offer, saved on 25 October at 11:26 local time, with the rows of
 * the given kinds (all three by default).
 */
export function sampleOffer(
  kinds: ReadonlyArray<(typeof allRows)[number]['kind']> = [
    'outputs',
    'slide',
    'showing',
  ],
  savedAt = new Date(2026, 9, 25, 11, 26),
): Summary {
  const summary = expectSuccess(
    parseRecoverySummary({
      savedAt: savedAt.toISOString(),
      rows: allRows.filter(row => kinds.includes(row.kind)),
    }),
  );
  if (summary === null) throw new Error('Expected an offer');
  return summary;
}
