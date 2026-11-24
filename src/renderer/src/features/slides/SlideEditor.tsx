import {useRef, useState, type JSX, type ReactNode} from 'react';
import type {UiApi} from '@contracts/ipc/ui';
import type {ShowTile} from '@core/schema/showService';
import type {Slide} from '@core/schema/slide';
import {assignHotKey} from '@core/slides';
import {Button} from '@renderer/ui/buttons/Button';
import {GridFooter} from '@renderer/ui/lists/GridFooter';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import {ColumnMenu} from './ColumnMenu';
import {addReason, addSlide} from './deckCommands';
import type {SlideDeck} from './slideDeck';
import {SlideHotKeyDialog} from './SlideHotKeyDialog';
import {SlideRows} from './SlideRows';
import {SlideSurface} from './SlideSurface';
import {SlideSurfaceView, useSlideSurfaceView} from './SlideSurfaceView';
import {useEditorBack} from './useEditorBack';
import styles from './SlideEditor.module.css';

/** The one editor of slides, for an item of the service and for a song. */
export function SlideEditor({
  deck,
  tiles,
  header,
  add,
  extraMenu,
  decoration,
  onBack,
  ui,
}: {
  readonly deck: SlideDeck;
  readonly tiles: readonly ShowTile[];
  readonly header: ReactNode;
  /** What else can be added, such as 타이틀 or 그림. */
  readonly add?: ReactNode;
  /** Entries for the slide at a place, above the ones of every list. */
  readonly extraMenu?: ((index: number) => readonly MenuEntry[]) | undefined;
  readonly decoration?: ((revision: string) => ReactNode) | undefined;
  readonly onBack: () => void;
  readonly ui?: Pick<UiApi, 'setLayout'> | undefined;
}): JSX.Element {
  const root = useRef<HTMLElement>(null);
  useEditorBack(root, onBack);
  const view = useSlideSurfaceView();
  const [keyed, setKeyed] = useState<Slide | null>(null);
  const reason = addReason(deck);
  const keyedIndex = deck.slides.findIndex(slide => slide.id === keyed?.id);
  return (
    <section ref={root} aria-label="편집" className={styles.editor}>
      <div className={styles.content}>
        {header}
        <SlideSurface
          key={deck.id}
          deck={deck}
          onBack={onBack}
          onHotKey={setKeyed}
          extraMenu={extraMenu}
        >
          <SlideRows deck={deck} tiles={tiles} decoration={decoration} />
        </SlideSurface>
        <GridFooter
          count={deck.slides.length}
          zoom={
            <>
              {view.mode === 'list' ? <ColumnMenu tiles={tiles} /> : null}
              <SlideSurfaceView ui={ui} />
            </>
          }
        >
          <Button
            variant="ghost"
            icon="plus"
            disabled={reason !== undefined}
            title={reason}
            onClick={() => addSlide(deck)}
          >
            슬라이드 추가
          </Button>
          {add}
        </GridFooter>
      </div>
      {keyed === null || keyedIndex < 0 ? null : (
        <SlideHotKeyDialog
          value={deck.slides[keyedIndex]?.hotKey}
          slideNumber={keyedIndex + 1}
          otherAssignments={deck.slides.flatMap((slide, index) =>
            slide.hotKey === undefined || slide.id === keyed.id
              ? []
              : [{code: slide.hotKey, slideNumber: index + 1}],
          )}
          onSave={code => {
            deck.edit(slides => assignHotKey(slides, keyed.id, code));
            return true;
          }}
          onClose={() => setKeyed(null)}
        />
      )}
    </section>
  );
}
