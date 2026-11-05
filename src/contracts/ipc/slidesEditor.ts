import {
  parseSlidesEditorTarget,
  parseSlidesEditorSaved,
  type SlidesEditorTarget,
  type SlidesEditorSaved,
} from '@core/schema/slidesEditor';
import {
  parseOpenWindowResult,
  refuseOpenWindow,
  type OpenWindowResult,
} from '@core/schema/ipcPayloads';
import {message, push, query, request, type IpcPort} from './endpoint';

export {
  parseSlidesEditorTarget,
  parseSlidesEditorSaved,
  type SlidesEditorTarget,
  type SlidesEditorSaved,
};

const parseTarget = (value: unknown) =>
  value === null
    ? ({ok: true, value: null} as const)
    : parseSlidesEditorTarget(value);

export const slidesEditorEndpoints = {
  open: request<SlidesEditorTarget, OpenWindowResult>('slides-editor:open', {
    request: parseSlidesEditorTarget,
    reply: parseOpenWindowResult,
    refuse: refuseOpenWindow,
  }),
  target: query<SlidesEditorTarget | null>('slides-editor:target', parseTarget),
  retarget: push<SlidesEditorTarget | null>(
    'slides-editor:retarget',
    parseTarget,
  ),
  saved: message<SlidesEditorSaved>(
    'slides-editor:saved',
    parseSlidesEditorSaved,
  ),
  savedInControl: push<SlidesEditorSaved>(
    'slides-editor:saved-in-control',
    parseSlidesEditorSaved,
  ),
};

/** The service slides editor, including the control window's undo entry. */
export function slidesEditorApi(port: IpcPort) {
  return {
    open: port.request(slidesEditorEndpoints.open),
    target: port.query(slidesEditorEndpoints.target),
    onRetarget: port.subscribe(slidesEditorEndpoints.retarget),
    saved: port.message(slidesEditorEndpoints.saved),
    onSaved: port.subscribe(slidesEditorEndpoints.savedInControl),
  };
}

export type SlidesEditorApi = ReturnType<typeof slidesEditorApi>;
