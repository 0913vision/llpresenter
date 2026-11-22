import {hasSlides, type ServiceItem} from '@core/schema/service';

/** The item with a memo; none when it is empty. */
export function withMemo(item: ServiceItem, memo: string): ServiceItem | null {
  if (!hasSlides(item)) return null;
  const {memo: _memo, ...rest} = item;
  return memo === '' ? rest : {...rest, memo};
}

/** The item with a 매크로 that runs when it starts. */
export function withStartMacro(
  item: ServiceItem,
  macro: string | undefined,
): ServiceItem | null {
  if (!hasSlides(item)) return null;
  const {macro: _macro, ...rest} = item;
  return macro === undefined ? rest : {...rest, macro};
}
