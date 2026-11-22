import type {HTMLAttributes} from 'react';
import {
  parseElements,
  pasteElements,
  serializeElements,
} from '@core/theme/elements';
import {isInTextEntry} from '@renderer/ui/textEntry';
import type {ThemeModel} from './useThemeEditor';

export type ThemeEditorEvents = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onKeyDownCapture' | 'onCopy' | 'onPaste'
>;

/** Copies and pastes elements while the canvas or the list has the focus. */
export function useThemeClipboard(model: ThemeModel) {
  const copied = (): string =>
    serializeElements(
      (model.layout?.elements ?? []).filter(element =>
        model.selectedIds.includes(element.id),
      ),
    );
  const pasteText = (text: string): void => {
    if (model.elementReason !== undefined) return;
    const elements = parseElements(text);
    let ids: readonly string[] = [];
    const pasted =
      elements !== null &&
      model.elements(screen => {
        const result = pasteElements(screen, elements);
        ids = result?.ids ?? [];
        return result?.screen;
      });
    if (pasted) model.selectMany(ids);
    else model.report('붙여넣을 수 없는 요소');
  };
  const events: ThemeEditorEvents = {
    onKeyDownCapture: event => {
      if (
        isInTextEntry(event.target) ||
        event.nativeEvent.isComposing ||
        event.altKey ||
        event.metaKey
      ) {
        return;
      }
      if (event.ctrlKey && event.code === 'KeyA') {
        event.preventDefault();
        event.stopPropagation();
        model.selectAll();
      }
      if (
        event.key === 'Delete' &&
        !event.ctrlKey &&
        model.selectedIds.length > 0 &&
        model.elementReason === undefined
      ) {
        event.preventDefault();
        event.stopPropagation();
        model.remove(model.selectedIds);
      }
    },
    onCopy: event => {
      if (isInTextEntry(event.target) || model.selectedIds.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData('text/plain', copied());
    },
    onPaste: event => {
      if (isInTextEntry(event.target) || model.elementReason !== undefined) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      pasteText(event.clipboardData.getData('text/plain'));
    },
  };
  return {
    events,
    copy: () => {
      navigator.clipboard.writeText(copied()).catch(model.reportError);
    },
    paste: () => {
      navigator.clipboard.readText().then(pasteText).catch(model.reportError);
    },
  };
}
