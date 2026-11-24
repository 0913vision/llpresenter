import type {PictureFit} from '@core/schema/media/picturePlace';

/** The names of the fits, in the order every menu of them has. */
export const PICTURE_FIT_OPTIONS = [
  {value: 'fill', label: '채우기'},
  {value: 'fit', label: '맞추기'},
  {value: 'stretch', label: '늘리기'},
] as const satisfies ReadonlyArray<{
  readonly value: PictureFit;
  readonly label: string;
}>;

/** What a video or a list does at its end, as every 끝나면 row names it. */
export const MEDIA_END_OPTIONS = [
  {value: 'loop', label: '반복'},
  {value: 'stop', label: '정지'},
] as const;

/** The options as the [value, label] pairs a menu of choices takes. */
export function choicePairs<Value extends string>(
  options: ReadonlyArray<{readonly value: Value; readonly label: string}>,
): ReadonlyArray<readonly [Value, string]> {
  return options.map(({value, label}) => [value, label] as const);
}
