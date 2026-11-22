import {createContext, use, type JSX, type ReactNode} from 'react';
import {parsePayload} from '@core/schema/payload';
import {itemTextsSchema} from '@core/schema/slideTexts';
import {isPassageItem} from '@core/services/passageEdits';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import type {ThemeId} from '@core/schema/ids';
import type {ThemeElement} from '@core/schema/themes';
import type {ThemeItemKind} from '@core/themes/elementRules';
import {hasSectionCard} from '@core/services/sectionCards';
import {setSlideText} from '@core/presentation/slideTexts';
import {isOwnTextBox, ownTextKey} from '@core/themes/content';
import {CREED_PRAYER_THEME_ID} from '@core/themes/creedPrayer';
import {resolveItemTheme, resolveThemeScreen} from '@core/themes/resolve';
import {SERMON_TITLE_THEME_ID} from '@core/themes/sundayScripture';
import type {RenderSlideTextFields} from '@renderer/features/songs/editor/SlideCardRenderer';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {themeElementNames} from '@renderer/rendering/themeNames';
import {useShow} from '@renderer/session/show';
import {ItemTextField} from './ItemTextField';
import type {ServiceItemState, ServiceItemStore} from './serviceItemStore';
import styles from './ItemTextField.module.css';

/** Which of a slide's own texts its theme shows. */
interface ShownTexts {
  readonly text: boolean;
  readonly reference: boolean;
}

const ShownTextsContext = createContext<ShownTexts>({
  text: true,
  reference: true,
});

export function useShownTexts(): ShownTexts {
  return use(ShownTextsContext);
}

interface Box {
  readonly key: string;
  readonly name: string;
  readonly text: string;
}

function kindOf(item: ServiceItem): ThemeItemKind {
  if (isPassageItem(item)) return 'bible';
  if (isItemOfKind(item, 'song')) return 'song';
  if (isItemOfKind(item, 'media')) return 'media';
  return isItemOfKind(item, 'slides') ? item.slides.form : 'blank';
}

/** The fields of the theme's own text boxes, for each slide of an item. */
export function SlideBoxes({
  items,
  state,
  children,
}: {
  readonly items: ServiceItemStore;
  readonly state: ServiceItemState | null;
  readonly children: (renderFields: RenderSlideTextFields) => ReactNode;
}): JSX.Element {
  const item = state?.item ?? null;
  const service = state?.service ?? null;
  const row = useShow(view => view.rows.find(entry => entry.id === item?.id));
  const themes = useSettingsDocument(
    item === null ? null : 'themes',
    '테마',
    items.reportNotice,
  );
  const screens = useSettingsDocument(
    item === null ? null : 'screens',
    '화면',
    items.reportNotice,
  );
  if (
    item === null ||
    service === null ||
    screens === null ||
    isItemOfKind(item, 'header')
  ) {
    return <>{children(() => null)}</>;
  }
  const targets = screens.value.screens;
  const elementsOf = (
    kind: ThemeItemKind,
    themeId: ThemeId | undefined,
  ): readonly ThemeElement[] => {
    const theme = resolveItemTheme({
      file: themes?.value,
      kind,
      source: 'service',
      screens: targets,
      ...(themeId === undefined ? {} : {theme: themeId}),
    });
    return targets.flatMap(
      screen => resolveThemeScreen(theme, screen.id, targets).layout.elements,
    );
  };
  const boxesOf = (elements: readonly ThemeElement[]): readonly Box[] => {
    const boxes = new Map<string, Box>();
    for (const element of elements) {
      if (!isOwnTextBox(element)) continue;
      const key = ownTextKey(element);
      if (!boxes.has(key)) {
        boxes.set(key, {
          key,
          name: element.name ?? themeElementNames.text,
          text: element.content,
        });
      }
    }
    return [...boxes.values()];
  };
  const itemElements = elementsOf(
    kindOf(item),
    item.theme ??
      (row?.kind === 'song' ? row.theme : undefined) ??
      (isItemOfKind(item, 'liturgy') ? CREED_PRAYER_THEME_ID : undefined),
  );
  const own = boxesOf(itemElements);
  const card = hasSectionCard(item)
    ? boxesOf(elementsOf('blank', item.sectionCard.theme))
    : [];
  const sermon = isItemOfKind(item, 'sermon')
    ? boxesOf(elementsOf('blank', SERMON_TITLE_THEME_ID))
    : [];
  const shows = (kind: ThemeElement['kind']): boolean =>
    itemElements.some(element => element.kind === kind);
  const readOnly = service.access === 'readOnly';
  const renderFields: RenderSlideTextFields = slide => {
    const boxes =
      slide === 'section' ? card : slide.startsWith('sermon:') ? sermon : own;
    if (boxes.length === 0) return null;
    return (
      <div className={styles.fields} role="group" aria-label="테마 글자">
        {boxes.map(box => (
          <ItemTextField
            key={`${item.id}:${slide}:${box.key}`}
            label={box.name}
            value={item.texts?.[slide]?.[box.key] ?? box.text}
            items={items}
            readOnly={readOnly}
            save={text =>
              items.submitItemEdit({
                target: {serviceId: service.service.id, itemId: item.id},
                failure: '슬라이드 글 저장 실패',
                change: fresh => {
                  const {texts: before, ...rest} = fresh;
                  const texts = setSlideText(before, {
                    slide,
                    box: box.key,
                    text: text === box.text ? null : text,
                  });
                  if (texts === undefined) return rest;
                  return parsePayload(itemTextsSchema, texts).ok
                    ? {...rest, texts}
                    : null;
                },
              })
            }
          />
        ))}
      </div>
    );
  };
  return (
    <ShownTextsContext
      value={{text: shows('currentText'), reference: shows('reference')}}
    >
      {children(renderFields)}
    </ShownTextsContext>
  );
}
