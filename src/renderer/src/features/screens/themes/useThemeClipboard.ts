import type {HTMLAttributes} from 'react';
import {createThemeElementId} from '@core/schema/ids';
import {
  parseThemeClipboard,
  pasteThemeElements,
  serializeThemeClipboard,
} from '@core/themes/elementEdits';
import {isInTextEntry} from '@renderer/ui/textEntry';
import type {ThemeModel} from './useThemeEditor';

export type ThemeEditorEvents = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onKeyDownCapture' | 'onCopy' | 'onPaste'
>;

/** Limits editor shortcuts to its element surfaces, leaving property drafts native. */
export function useThemeClipboard(model: ThemeModel) {
  const selected = () =>
    model.visibleElements.filter(element =>
      model.selectedIds.includes(element.id),
    );
  const pasteText = (text: string): void => {
    if (model.elementReason !== undefined) return;
    const values = parseThemeClipboard(text);
    if (values === undefined) {
      model.report('붙여넣을 수 없는 요소');
      return;
    }
    const ids = values.map(() => createThemeElementId(crypto.randomUUID()));
    model.elements(elements => pasteThemeElements(elements, values, ids));
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
      if (isInTextEntry(event.target) || selected().length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.clipboardData.setData(
        'text/plain',
        serializeThemeClipboard(selected()),
      );
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
      navigator.clipboard
        .writeText(serializeThemeClipboard(selected()))
        .catch(model.reportError);
    },
    paste: () => {
      navigator.clipboard.readText().then(pasteText).catch(model.reportError);
    },
  };
}
