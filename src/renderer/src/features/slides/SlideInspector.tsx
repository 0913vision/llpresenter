import {
  useContext,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import type {ThemeId} from '@core/schema/ids';
import type {ShowTile} from '@core/schema/showService';
import type {Slide} from '@core/schema/slide';
import type {ScreenKind, SlideBackground} from '@core/schema/theme';
import type {SlideTransition} from '@core/schema/slideTransition';
import {sameJson} from '@core/common/sameJson';
import {nextTextOfTile} from '@core/presentation/slideLayer';
import {
  changeSlides,
  withBackground,
  withLabel,
  withTheme,
  withTransition,
} from '@core/slides/edits';
import {themeOfSlide} from '@core/theme/themes';
import {LabelMenu} from '@renderer/features/labels/LabelMenu';
import {useLabelCatalog} from '@renderer/features/labels/labels';
import {themeOfTile, useThemes} from '@renderer/platform/themes';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {TilePicture} from '@renderer/pictures/TilePicture';
import {outputSlideOf} from '@renderer/session/show';
import {Button} from '@renderer/ui/Button';
import {isComposing} from '@renderer/ui/ime';
import {labelInk} from '@renderer/ui/labelInk';
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {Properties, PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {INITIAL_SLIDE_EFFECT} from '@renderer/ui/slideTransitionChoices';
import {
  focusedSlide,
  selectedSlides,
  selectionOf,
  useDeckSelection,
} from './deckSelection';
import {BackgroundPlace} from './BackgroundPlace';
import {SlideBackgroundControl} from './SlideBackgroundControl';
import type {SlideDeck} from './slideDeck';
import {NEXT_BOX} from './slideColumns';
import {SlideTextField} from './SlideTextField';
import {inspectorTransition, TransitionSection} from './TransitionSection';
import {openTheme} from '@renderer/session/themeRequests';
import styles from './SlideInspector.module.css';

const SCREENS: ReadonlyArray<{
  readonly value: ScreenKind;
  readonly label: string;
}> = [
  {value: 'audience', label: '청중'},
  {value: 'stage', label: '무대'},
  {value: 'broadcast', label: '방송'},
];

function changeSelected(
  deck: SlideDeck,
  change: (slide: Slide) => Slide,
  key?: string,
): void {
  const {ids} = selectionOf(deck);
  deck.edit(slides => changeSlides(slides, ids, change), key);
}

function Picture({
  deck,
  tile,
  tiles,
  index,
}: {
  readonly deck: SlideDeck;
  readonly tile: ShowTile;
  readonly tiles: readonly ShowTile[];
  readonly index: number;
}): JSX.Element {
  const [role, setRole] = useState<ScreenKind>('audience');
  const after = tiles[index + 1];
  const live =
    deck.item === undefined
      ? null
      : outputSlideOf({itemId: deck.id, index})?.next;
  const next =
    after === undefined
      ? (live ?? null)
      : nextTextOfTile(after, themeOfTile, false);
  return (
    <>
      <SegmentedControl
        kind="toggle"
        label="화면"
        options={SCREENS}
        value={role}
        onChange={setRole}
      />
      <div className={styles.picture} data-background-picture>
        <div className={styles.canvas}>
          <TilePicture tile={tile} tiles={tiles} role={role} next={next} />
        </div>
      </div>
      <div className={styles.caption} style={labelInk(tile.labelColor)}>
        {tile.slide.label ?? ''}
        <span>
          {index + 1} / {tiles.length}
        </span>
      </div>
    </>
  );
}

function ThemeRow({
  deck,
  chosen,
}: {
  readonly deck: SlideDeck;
  readonly chosen: readonly Slide[];
}): JSX.Element {
  const themes = useThemes(view => view.themes);
  const navigate = useContext(WorkspaceNavigation);
  const own = chosen.map(slide => themeOfSlide(themes, slide));
  const first = own[0];
  const purposes = new Set(own.map(theme => theme.purpose));
  const mixed = new Set(chosen.map(slide => slide.theme)).size > 1;
  const options =
    purposes.size === 1
      ? (themes?.themes ?? []).filter(theme => purposes.has(theme.purpose))
      : [];
  return (
    <PropertyRow label="테마">
      {({controlId}) => (
        <span className={styles.themeRow}>
          <SelectMenu<ThemeId>
            id={controlId}
            aria-label="테마"
            block
            disabled={deck.readOnly || options.length === 0}
            value={mixed ? undefined : first?.id}
            valueText={mixed ? '혼합' : (first?.name ?? '없음')}
            options={options.map(theme => ({
              value: theme.id,
              label: theme.name,
            }))}
            onChange={id => changeSelected(deck, slide => withTheme(slide, id))}
          />
          <Button
            size="md"
            disabled={navigate === undefined || first === undefined}
            onClick={() => {
              if (first === undefined) return;
              openTheme(first.id);
              navigate?.('screens');
            }}
          >
            테마 편집
          </Button>
        </span>
      )}
    </PropertyRow>
  );
}

function BackgroundRow({
  deck,
  chosen,
}: {
  readonly deck: SlideDeck;
  readonly chosen: readonly Slide[];
}): JSX.Element {
  const value = chosen[0]?.background;
  const mixed = chosen.some(slide => !sameJson(slide.background, value));
  const set = (background: SlideBackground | undefined): void =>
    changeSelected(deck, slide => withBackground(slide, background));
  return (
    <>
      <PropertyRow label="배경">
        {({controlId}) => (
          <SlideBackgroundControl
            id={controlId}
            value={value}
            mixed={mixed}
            disabled={deck.readOnly}
            onChange={set}
          />
        )}
      </PropertyRow>
      {!mixed && value?.kind === 'media' ? (
        <BackgroundPlace
          value={value}
          disabled={deck.readOnly}
          onChange={set}
        />
      ) : null}
      <PropertyRow label="">
        {() => (
          <Button
            className={styles.full}
            size="md"
            disabled={deck.readOnly || mixed || deck.slides.length < 2}
            onClick={() =>
              deck.edit(slides =>
                slides.map(slide => withBackground(slide, value)),
              )
            }
          >
            전체 슬라이드에 적용
          </Button>
        )}
      </PropertyRow>
    </>
  );
}

function LabelRow({
  deck,
  chosen,
}: {
  readonly deck: SlideDeck;
  readonly chosen: readonly Slide[];
}): JSX.Element {
  const catalog = useLabelCatalog();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const label = chosen[0]?.label;
  const mixed = chosen.some(slide => slide.label !== label);
  return (
    <>
      <PropertyRow label="이름표">
        {({controlId}) => (
          <Button
            id={controlId}
            size="md"
            className={styles.full}
            disabled={deck.readOnly || catalog === null}
            onClick={event => setAnchor(event.currentTarget)}
          >
            {mixed ? '혼합' : (label ?? '없음')}
          </Button>
        )}
      </PropertyRow>
      {anchor === null || catalog === null ? null : (
        <LabelMenu
          store={catalog}
          anchor={anchor}
          selected={mixed ? undefined : label}
          onChoose={name =>
            changeSelected(deck, slide => withLabel(slide, name))
          }
          onClose={restore => {
            setAnchor(null);
            if (restore) anchor.focus();
          }}
        />
      )}
    </>
  );
}

function Transition({
  deck,
  chosen,
}: {
  readonly deck: SlideDeck;
  readonly chosen: readonly Slide[];
}): JSX.Element {
  const {value, mixed} = inspectorTransition(
    chosen.map(slide => slide.transition),
  );
  const set = (transition: SlideTransition): void =>
    changeSelected(deck, slide => withTransition(slide, transition));
  return (
    <TransitionSection
      value={mixed ? INITIAL_SLIDE_EFFECT : value}
      mixed={mixed}
      disabled={deck.readOnly}
      selectionKey={chosen.map(slide => slide.id).join(',')}
      onChange={set}
      onSeconds={sec =>
        changeSelected(deck, slide =>
          slide.transition === undefined
            ? slide
            : withTransition(slide, {...slide.transition, sec}),
        )
      }
      onApplyAll={() =>
        deck.edit(slides => slides.map(slide => withTransition(slide, value)))
      }
    />
  );
}

/** Everything of the selected slides: what it looks like, texts and settings. */
export function SlideInspector({
  deck,
  tiles,
  children,
}: {
  readonly deck: SlideDeck;
  readonly tiles: readonly ShowTile[];
  /** Rows of the item itself, above the ones of its slides. */
  readonly children?: ReactNode;
}): JSX.Element {
  const selection = useDeckSelection(deck);
  const chosen = selectedSlides(deck, selection);
  const slide = focusedSlide(deck, selection);
  const index = tiles.findIndex(tile => tile.slide.id === slide?.id);
  const tile = tiles[index];
  const themes = useThemes(view => view.themes);
  const theme = slide === undefined ? undefined : themeOfSlide(themes, slide);
  const keyDown = (event: KeyboardEvent): void => {
    if (
      deck.readOnly ||
      isComposing(event) ||
      event.altKey ||
      !(event.ctrlKey || event.metaKey)
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    event.stopPropagation();
    deck.replay(key === 'y' || event.shiftKey ? 'redo' : 'undo');
  };
  const one = chosen.length === 1;
  return (
    <Panel label="슬라이드 속성">
      <PanelBody>
        <div className={styles.body} onKeyDown={keyDown}>
          {children}
          {tile === undefined || chosen.length === 0 ? null : (
            <>
              <Picture deck={deck} tile={tile} tiles={tiles} index={index} />
              {one && theme !== undefined ? (
                <div className={styles.text} key={tile.slide.id}>
                  {theme.boxes.map(box => (
                    <SlideTextField
                      key={box.name}
                      deck={deck}
                      tile={tile}
                      theme={theme}
                      box={box.name}
                    />
                  ))}
                  <SlideTextField
                    deck={deck}
                    tile={tile}
                    theme={theme}
                    box={NEXT_BOX}
                  />
                </div>
              ) : null}
              <Properties>
                <PropertyGroup>
                  <ThemeRow deck={deck} chosen={chosen} />
                  <BackgroundRow deck={deck} chosen={chosen} />
                  <LabelRow deck={deck} chosen={chosen} />
                </PropertyGroup>
                <Transition deck={deck} chosen={chosen} />
              </Properties>
            </>
          )}
        </div>
      </PanelBody>
    </Panel>
  );
}
