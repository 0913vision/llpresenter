import type {JSX, ReactNode} from 'react';
import type {UiApi} from '@contracts/ipc/ui';
import type {SlidesItem} from '@core/schema/services/service';
import {useLabelColors} from '@renderer/features/labels/labels';
import {BackgroundDrop} from '@renderer/features/slides/BackgroundDrop';
import {SlideEditor} from '@renderer/features/slides/SlideEditor';
import styles from '@renderer/features/slides/SlideEditorHeader.module.css';
import {SlideInspector} from '@renderer/features/slides/inspector/SlideInspector';
import {
  useDeckTiles,
  useItemDeck,
  type SlideDeck,
} from '@renderer/features/slides/slideDeck';
import {runEdit, type Report} from '@renderer/session/service/serviceEdit';
import {renameItem} from '@renderer/session/service/serviceOrderEdits';
import {Button} from '@renderer/ui/buttons/Button';
import {isComposing} from '@renderer/ui/fields/ime';
import {RenameText} from '@renderer/ui/fields/RenameText';
import {OverlayClips} from '../overlays/OverlayClip';
import {useItemOverlays} from '../overlays/useItemOverlays';
import {useOverlayControl} from '../overlays/useOverlayControl';
import {ItemAdders} from './ItemAdders';
import {ItemTools} from './ItemTools';
import {useShow} from '@renderer/session/show/showStore';

const EMPTY = {slides: [], source: {kind: 'blank', title: ''}} as const;

/** Kinds whose name is the operator's own; others have one from their slides. */
const NAMED: ReadonlySet<SlidesItem['kind']> = new Set([
  'blank',
  'notice',
  'media',
]);

function ItemHeader({
  deck,
  report,
  onBack,
}: {
  readonly deck: SlideDeck;
  readonly report: Report;
  readonly onBack: () => void;
}): JSX.Element {
  const serviceName = useShow(view => view.serviceName);
  const {item} = deck;
  return (
    <header className={styles.header}>
      <Button onClick={onBack}>‹ {serviceName || '예배 순서'}</Button>
      <div className={styles.title}>
        <RenameText
          key={deck.id}
          label="이름"
          value={deck.source.title}
          readOnly={
            deck.readOnly || item === undefined || !NAMED.has(item.kind)
          }
          onCommit={name => {
            if (item !== undefined) runEdit(renameItem(item.id, name), report);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !isComposing(event)) {
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      <div className={styles.commands}>
        <ItemTools deck={deck} report={report} />
      </div>
    </header>
  );
}

/** The editor of an item of the open service, and the panel beside it. */
export function useItemEditor({
  itemId,
  report,
  onBack,
  ui,
}: {
  readonly itemId: string | null;
  readonly report: Report;
  readonly onBack: () => void;
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
}): {readonly editor: ReactNode; readonly inspector: ReactNode} | null {
  const deck = useItemDeck(itemId, report);
  const colors = useLabelColors();
  const tiles = useDeckTiles(deck ?? EMPTY, colors);
  const overlays = useItemOverlays(deck?.item, deck?.readOnly ?? true);
  const control = useOverlayControl(overlays);
  if (deck?.item === undefined) return null;
  return {
    editor: (
      <BackgroundDrop deck={deck} report={report}>
        <SlideEditor
          deck={deck}
          tiles={tiles}
          header={<ItemHeader deck={deck} report={report} onBack={onBack} />}
          add={<ItemAdders deck={deck} item={deck.item} report={report} />}
          extraMenu={index => control.entries(index + 1)}
          decoration={revision => (
            <OverlayClips control={control} revision={revision} />
          )}
          onBack={onBack}
          ui={ui}
        />
        {control.dialog}
      </BackgroundDrop>
    ),
    inspector: (
      <BackgroundDrop deck={deck} report={report}>
        <SlideInspector deck={deck} tiles={tiles} />
      </BackgroundDrop>
    ),
  };
}
