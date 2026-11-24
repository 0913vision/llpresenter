import type {JSX} from 'react';
import {
  THEME_FILE_LIMITS,
  type ThemeElement,
  type ThemeGroupedText,
} from '@core/schema/theme';
import {
  themeValues,
  changeSplit,
  changeStack,
  splitOf,
  stackOf,
} from '@core/theme';
import {GeometryField} from '@renderer/ui/canvas/GeometryField';
import {
  Properties,
  PropertyColumns,
  PropertyGroup,
  PropertyRow,
} from '@renderer/ui/panels/PropertyRow';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {ColorProperty} from '../ColorProperty';
import {ThemeImageChoice} from './ThemeImageChoice';
import {
  ThemeCheck,
  ThemeFitRow,
  ThemeNumber,
  ThemeOptionalNumber,
} from './ThemePropertyFields';
import {ThemeShapeProperties} from './ThemeShapeProperties';
import {ThemeTemplates} from './ThemeTemplates';
import {ThemeFitProperties, ThemeTextProperties} from './ThemeTextProperties';
import {elementName} from './themeNames';
import {themeCanvasBounds, type ThemeModel} from './useThemeEditor';

const FRAME_FIELDS = ['x', 'y', 'w', 'h'] as const;
const FREE = '';
const FIRST_RATIO = 0.65;

export function ThemeElementProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: ThemeElement;
}): JSX.Element {
  const reason = model.elementReason;
  const frame = model.frameOf(element.id) ?? element.frame;
  const {width, height, minimumSize} = themeCanvasBounds;
  return (
    <Properties key={element.id}>
      <PropertyGroup title={elementName(element)}>
        <PropertyColumns responsive>
          {FRAME_FIELDS.map(field => (
            <PropertyRow key={field} label={field.toUpperCase()}>
              {({controlId}) => (
                <GeometryField
                  id={controlId}
                  unit="px"
                  value={frame[field]}
                  min={field === 'x' || field === 'y' ? 0 : minimumSize}
                  max={
                    field === 'x'
                      ? width - frame.w
                      : field === 'y'
                        ? height - frame.h
                        : field === 'w'
                          ? width - frame.x
                          : height - frame.y
                  }
                  readOnly={reason !== undefined}
                  title={reason}
                  updateOn="commit"
                  onChange={value =>
                    model.frameValue(element.id, {field, value})
                  }
                />
              )}
            </PropertyRow>
          ))}
        </PropertyColumns>
        {element.kind === 'picture' ? (
          <PropertyRow label="이미지">
            {({controlId}) => (
              <ThemeImageChoice
                id={controlId}
                selected={element.media}
                reason={reason}
                change={media =>
                  model.property(element.id, value =>
                    value.kind === 'picture' ? {...value, media} : value,
                  )
                }
              />
            )}
          </PropertyRow>
        ) : null}
        {element.kind === 'picture' || element.kind === 'background' ? (
          <ThemeFitRow
            value={element.fit}
            reason={reason}
            change={fit =>
              model.property(element.id, value =>
                value.kind === 'picture' || value.kind === 'background'
                  ? {...value, fit}
                  : value,
              )
            }
          />
        ) : null}
        {element.kind === 'next' ? (
          <NextProperties model={model} element={element} />
        ) : null}
      </PropertyGroup>
      {element.kind === 'text' ? (
        <ContentProperties model={model} element={element} />
      ) : null}
      {element.kind === 'text' || element.kind === 'next' ? (
        <>
          <ThemeTextProperties model={model} element={element} />
          <ThemeFitProperties model={model} element={element} />
          <GroupProperties model={model} element={element} />
        </>
      ) : null}
      {element.kind === 'shape' ? (
        <ThemeShapeProperties model={model} shape={element} />
      ) : null}
    </Properties>
  );
}

type TextElement = Extract<ThemeElement, {readonly kind: 'text'}>;
type NextElement = Extract<ThemeElement, {readonly kind: 'next'}>;

function ContentProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: TextElement;
}): JSX.Element | null {
  const {theme, elementReason: reason} = model;
  if (theme === undefined) return null;
  const change = (update: (text: TextElement) => TextElement): void => {
    model.property(element.id, value =>
      value.kind === 'text' ? update(value) : value,
    );
  };
  const {empty} = element;
  return (
    <PropertyGroup title="내용">
      <ThemeTemplates
        model={model}
        label="문구"
        templates={element.content}
        values={themeValues(theme)}
        reason={reason}
        change={content => change(text => ({...text, content}))}
      />
      <ThemeCheck
        label="없을 때 대신"
        checked={empty !== undefined}
        reason={reason}
        change={on =>
          change(text => {
            const {empty: _empty, ...rest} = text;
            return on
              ? {...rest, empty: {content: [], color: text.style.color}}
              : rest;
          })
        }
      />
      {empty === undefined ? null : (
        <>
          <ThemeTemplates
            model={model}
            label="대신할 문구"
            templates={empty.content}
            values={themeValues(theme)}
            reason={reason}
            change={content =>
              change(text => ({...text, empty: {...empty, content}}))
            }
          />
          <ColorProperty
            label="대신할 글자색"
            value={empty.color}
            reason={reason}
            commit={color =>
              change(text => ({...text, empty: {...empty, color}}))
            }
          />
        </>
      )}
      <ThemeCheck
        label="이름표 함께"
        checked={element.label ?? false}
        reason={reason}
        change={on =>
          change(text => {
            const {label: _label, ...rest} = text;
            return on ? {...rest, label: true} : rest;
          })
        }
      />
      <ThemeOptionalNumber
        label="한 줄로 잇기"
        value={element.joinRows}
        first={1}
        min={1}
        max={THEME_FILE_LIMITS.rows}
        reason={reason}
        change={joinRows =>
          change(text => {
            const {joinRows: _joinRows, ...rest} = text;
            return joinRows === undefined ? rest : {...rest, joinRows};
          })
        }
      />
    </PropertyGroup>
  );
}

function NextProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: NextElement;
}): JSX.Element {
  const reason = model.elementReason;
  const texts = (model.layout?.elements ?? []).filter(
    entry => entry.kind === 'text',
  );
  const change = (update: (next: NextElement) => NextElement): void => {
    model.property(element.id, value =>
      value.kind === 'next' ? update(value) : value,
    );
  };
  return (
    <>
      <PropertyRow label="크기 기준">
        {({controlId}) => (
          <SelectMenu<string>
            id={controlId}
            block
            value={element.of ?? FREE}
            disabled={reason !== undefined}
            title={reason}
            options={[
              {value: FREE, label: '없음'},
              ...texts.map(entry => ({
                value: entry.id,
                label: elementName(entry),
              })),
            ]}
            onChange={id =>
              change(next => {
                const {of: _of, ratio, ...rest} = next;
                const text = texts.find(entry => entry.id === id);
                return text === undefined
                  ? rest
                  : {...rest, of: text.id, ratio: ratio ?? FIRST_RATIO};
              })
            }
          />
        )}
      </PropertyRow>
      {element.of === undefined ? null : (
        <ThemeNumber
          label="비율"
          value={element.ratio ?? FIRST_RATIO}
          min={0.1}
          max={1}
          step={0.01}
          reason={reason}
          change={ratio => change(next => ({...next, ratio}))}
        />
      )}
    </>
  );
}

const ANCHORS = [
  {value: 'top', label: '위'},
  {value: 'center', label: '가운데'},
  {value: 'bottom', label: '아래'},
] as const;

/** How a text stands with the other texts of its stack or split. */
function GroupProperties({
  model,
  element,
}: {
  readonly model: ThemeModel;
  readonly element: ThemeGroupedText;
}): JSX.Element | null {
  const {layout, elementReason: reason} = model;
  if (layout === null) return null;
  const stack = stackOf(layout, element.id);
  const split = splitOf(layout, element.id);
  const {height} = themeCanvasBounds;
  if (stack !== undefined) {
    const change = (update: Partial<typeof stack>): void => {
      model.elements(screen => changeStack(screen, element.id, update));
    };
    return (
      <PropertyGroup title="위아래로 쌓기">
        <PropertyRow label="기준">
          {({controlId, labelId}) => (
            <SegmentedControl
              id={controlId}
              labelledBy={labelId}
              fill
              value={stack.anchor}
              disabled={reason !== undefined}
              title={reason}
              options={ANCHORS}
              onChange={anchor => change({anchor})}
            />
          )}
        </PropertyRow>
        <ThemeNumber
          label="기준 위치"
          value={stack.at}
          max={height}
          reason={reason}
          change={at => change({at})}
        />
        <ThemeNumber
          label="간격"
          value={stack.gap}
          min={-height}
          max={height}
          reason={reason}
          change={gap => change({gap})}
        />
        <ThemeCheck
          label="글자 높이로"
          checked={stack.ink ?? false}
          reason={reason}
          change={ink => change({ink})}
        />
      </PropertyGroup>
    );
  }
  if (split === undefined) return null;
  const change = (update: Partial<typeof split>): void => {
    model.elements(screen => changeSplit(screen, element.id, update));
  };
  return (
    <PropertyGroup title="미리 보여줄 내용">
      <ThemeNumber
        label="위 끝"
        value={split.top}
        max={height}
        reason={reason}
        change={top => change({top})}
      />
      <ThemeNumber
        label="아래 끝"
        value={split.bottom}
        max={height}
        reason={reason}
        change={bottom => change({bottom})}
      />
      <ThemeNumber
        label="시작 위치"
        value={split.at}
        max={height}
        reason={reason}
        change={at => change({at})}
      />
      <ThemeNumber
        label="간격"
        value={split.gap}
        max={height}
        reason={reason}
        change={gap => change({gap})}
      />
      {split.upper.length < 2 ? null : (
        <ThemeNumber
          label="위 글 간격"
          value={split.upperGap ?? 0}
          max={height}
          reason={reason}
          change={upperGap => change({upperGap})}
        />
      )}
    </PropertyGroup>
  );
}
