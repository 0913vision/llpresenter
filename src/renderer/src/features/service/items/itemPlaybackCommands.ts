import type {MediaId} from '@core/schema/ids';
import {withStartField} from '@core/services/itemFieldChanges';
import {backgroundChange} from '@renderer/session/serviceBackground';
import type {ItemEditRequest, ItemTarget} from './itemEditQueue';

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
/** Captures the supported item's memo, or its removal when the text is empty. */
export function memoRequest(
  target: ItemTarget | null,
  memo: string,
): ItemEditRequest {
  return {
    change: withStartField('memo', memo === '' ? undefined : memo),
    failure: '메모 저장 실패',
    target,
  };
}
