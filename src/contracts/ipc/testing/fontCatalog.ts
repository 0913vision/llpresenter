import type {FontFamily} from '@core/schema/fontCatalog';

/** Invented localized font metadata for validation and native-reader tests. */
export function fontFamilyFixture(): FontFamily {
  return {
    family: 'Fixture Sans',
    label: '검사용 고딕',
    aliases: ['Fixture Sans', '검사용 고딕'],
    weights: [350, 400, 700],
  };
}
