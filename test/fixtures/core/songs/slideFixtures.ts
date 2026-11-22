import {createSlideId} from '@core/schema/ids';

export function fixtureSlideId(number: number) {
  return createSlideId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
}
