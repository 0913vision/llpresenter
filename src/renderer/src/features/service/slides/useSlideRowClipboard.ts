import {useEffect, useLayoutEffect, useRef, type ClipboardEvent} from 'react';
import type {SlidesDraft} from '@core/services/slidesEdits';
import {isInTextEntry} from '@renderer/ui/textEntry';
import {
  pasteRowClipboard,
  readRowClipboard,
  readRowClipboardEvent,
  rowClipboardData,
  writeRowClipboard,
  writeRowClipboardEvent,
} from './slideRowsClipboard';

export function useSlideRowClipboard({
  draft,
  blocked,
  update,
  report,
}: {
  readonly draft: SlidesDraft;
  readonly blocked: boolean;
  readonly update: () => void;
  readonly report: (message: string) => void;
}) {
  const alive = useRef(true);
  const current = useRef({draft, blocked});
  useLayoutEffect(() => {
    current.current = {draft, blocked};
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const capture = () => {
    const copied = draft.copyRows();
    if (!copied.ok) {
      report('복사할 수 없는 슬라이드');
      return null;
    }
    if (copied.value === null) return null;
    const data = rowClipboardData(
      draft.snapshot.item.slides.form,
      copied.value,
    );
    if (data === null) report('복사할 수 없는 슬라이드');
    return data;
  };
  const valid = (snapshot: SlidesDraft['snapshot']) =>
    alive.current &&
    current.current.draft === draft &&
    !current.current.blocked &&
    draft.snapshot === snapshot;
  const copy = async (cut = false): Promise<void> => {
    if (blocked) return;
    const data = capture();
    if (data === null) return;
    const snapshot = draft.snapshot;
    try {
      await writeRowClipboard(data);
      if (cut && valid(snapshot)) {
        draft.commandRows({type: 'delete'});
        update();
      }
    } catch (error) {
      console.error('Could not copy slide rows', error);
      if (alive.current) report('슬라이드 복사 실패');
    }
  };
  const paste = async (): Promise<void> => {
    if (blocked) return;
    const snapshot = draft.snapshot;
    try {
      const data = await readRowClipboard();
      if (!valid(snapshot)) return;
      if (!pasteRowClipboard(draft, data)) report('붙여넣을 수 없는 슬라이드');
      update();
    } catch (error) {
      console.error('Could not paste slide rows', error);
      if (alive.current) report('슬라이드 붙여넣기 실패');
    }
  };
  const copyEvent = (event: ClipboardEvent, cut: boolean): void => {
    if (blocked || isInTextEntry(event.target)) return;
    const data = capture();
    if (data === null) return;
    event.preventDefault();
    event.stopPropagation();
    writeRowClipboardEvent(event.clipboardData, data);
    if (cut) {
      draft.commandRows({type: 'delete'});
      update();
    }
  };
  return {
    copy,
    paste,
    events: {
      onCopy: (event: ClipboardEvent) => copyEvent(event, false),
      onCut: (event: ClipboardEvent) => copyEvent(event, true),
      onPaste: (event: ClipboardEvent) => {
        if (blocked || isInTextEntry(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        if (
          !pasteRowClipboard(draft, readRowClipboardEvent(event.clipboardData))
        ) {
          report('붙여넣을 수 없는 슬라이드');
        }
        update();
      },
    },
  };
}
