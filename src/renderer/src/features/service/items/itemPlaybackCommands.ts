import type {MediaId} from '@core/schema/ids';
import {withStartField} from '@core/services/itemFieldChanges';
import {backgroundChange} from '@renderer/session/serviceBackground';
import {itemArrangementChange} from '@renderer/session/serviceItemUpdate';
import type {ItemEditRequest, ItemTarget} from './itemEditQueue';
/** Captures the item's arrangement choice without changing the source song. */
export function arrangementRequest(
  target: ItemTarget | null,
  name: string | undefined,
): ItemEditRequest {
  return {
    change: itemArrangementChange(name),
    failure: '구성 변경 실패',
    target,
  };
}
/** Captures an item background override, or source inheritance with null. */
export function backgroundRequest(
  target: ItemTarget | null,
  mediaId: MediaId | null,
): ItemEditRequest {
  return {
    change: backgroundChange(mediaId),
    failure: '배경 변경 실패',
    target,
  };
}
/** Captures the supported item's start macro or field removal. */
export function startMacroRequest(
  target: ItemTarget | null,
  macroId: string | undefined,
): ItemEditRequest {
  return {
    change: withStartField('macro', macroId),
    failure: '시작 매크로 변경 실패',
    target,
  };
}
