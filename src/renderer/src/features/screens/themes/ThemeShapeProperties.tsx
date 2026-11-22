import type {JSX} from 'react';
import {
  THEME_CANVAS,
  THEME_FILE_LIMITS,
  type ThemeFill,
  type ThemeShape,
} from '@core/schema/theme';
import {Button} from '@renderer/ui/Button';
import {IconButton} from '@renderer/ui/IconButton';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {ColorProperty} from '../ColorProperty';
import {ThemeCheck, ThemeNumber} from './ThemePropertyFields';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

const MAX_RADIUS = 540;
const MAX_BORDER = 60;
const MAX_BLUR = 100;
const MAX_ANGLE = 359;
const BESIDE = {above: '위', below: '아래'} as const;

/** The look of a shape, and how it follows texts. */
export function ThemeShapeProperties({
  model,
  shape,
}: {
  readonly model: ThemeModel;
  readonly shape: ThemeShape;
}): JSX.Element {
  const reason = model.elementReason;
  const {height} = THEME_CANVAS;
  const {around, beside, border, shadow} = shape;
  const change = (update: (shape: ThemeShape) => ThemeShape): void => {
    model.property(shape.id, value =>
      value.kind === 'shape' ? update(value) : value,
    );
  };
  return (
    <>
      <PropertyGroup title="채우기">
        <FillProperties
          fill={shape.fill}
          reason={reason}
          change={fill => change(value => ({...value, fill}))}
        />
        <ThemeNumber
          label="모서리"
          value={shape.radius ?? 0}
          max={MAX_RADIUS}
          reason={reason}
          change={radius => change(value => ({...value, radius}))}
        />
        <ThemeCheck
          label="크로마키에서 따로"
          checked={shape.solid !== undefined}
          reason={reason}
          change={on =>
            change(value => {
              const {solid: _solid, ...rest} = value;
              return on ? {...rest, solid: value.fill} : rest;
            })
          }
        />
        {shape.solid === undefined ? null : (
          <FillProperties
            fill={shape.solid}
            reason={reason}
            change={solid => change(value => ({...value, solid}))}
          />
        )}
      </PropertyGroup>
      <PropertyGroup title="테두리와 그림자">
        <ThemeCheck
          label="테두리"
          checked={border !== undefined}
          reason={reason}
          change={on =>
            change(value => {
              const {border: _border, ...rest} = value;
              return on
                ? {...rest, border: {width: 4, color: '#FFFFFF', opacity: 100}}
                : rest;
            })
          }
        />
        {border === undefined ? null : (
          <>
            <ThemeNumber
              label="두께"
              value={border.width}
              max={MAX_BORDER}
              reason={reason}
              change={width =>
                change(value => ({...value, border: {...border, width}}))
              }
            />
            <ColorProperty
              label="테두리 색"
              value={border.color}
              reason={reason}
              commit={color =>
                change(value => ({...value, border: {...border, color}}))
              }
            />
            <ThemeNumber
              label="불투명도"
              value={border.opacity}
              max={100}
              reason={reason}
              change={opacity =>
                change(value => ({...value, border: {...border, opacity}}))
              }
            />
          </>
        )}
        <ThemeCheck
          label="그림자"
          checked={shadow !== undefined}
          reason={reason}
          change={on =>
            change(value => {
              const {shadow: _shadow, ...rest} = value;
              return on
                ? {...rest, shadow: {blur: 16, color: '#000000', opacity: 35}}
                : rest;
            })
          }
        />
        {shadow === undefined ? null : (
          <>
            <ThemeNumber
              label="흐림"
              value={shadow.blur}
              max={MAX_BLUR}
              reason={reason}
              change={blur =>
                change(value => ({...value, shadow: {...shadow, blur}}))
              }
            />
            <ColorProperty
              label="그림자 색"
              value={shadow.color}
              reason={reason}
              commit={color =>
                change(value => ({...value, shadow: {...shadow, color}}))
              }
            />
            <ThemeNumber
              label="불투명도"
              value={shadow.opacity}
              max={100}
              reason={reason}
              change={opacity =>
                change(value => ({...value, shadow: {...shadow, opacity}}))
              }
            />
          </>
        )}
      </PropertyGroup>
      {around === undefined ? null : (
        <PropertyGroup title="글 둘러싸기">
          <ThemeNumber
            label="위 여백"
            value={around.padding.top}
            min={-height}
            max={height}
            reason={reason}
            change={top =>
              change(value => ({
                ...value,
                around: {...around, padding: {...around.padding, top}},
              }))
            }
          />
          <ThemeNumber
            label="아래 여백"
            value={around.padding.bottom}
            min={-height}
            max={height}
            reason={reason}
            change={bottom =>
              change(value => ({
                ...value,
                around: {...around, padding: {...around.padding, bottom}},
              }))
            }
          />
        </PropertyGroup>
      )}
      {beside === undefined ? null : (
        <PropertyGroup title={`글 ${BESIDE[beside.side]}에 두기`}>
          <ThemeNumber
            label="간격"
            value={beside.gap}
            min={-height}
            max={height}
            reason={reason}
            change={gap =>
              change(value => ({...value, beside: {...beside, gap}}))
            }
          />
        </PropertyGroup>
      )}
    </>
  );
}

/** One color, or a gradient of several. */
function FillProperties({
  fill,
  reason,
  change,
}: {
  readonly fill: ThemeFill;
  readonly reason: string | undefined;
  readonly change: (fill: ThemeFill) => void;
}): JSX.Element {
  const kind = 'color' in fill ? 'color' : 'gradient';
  return (
    <>
      <PropertyRow label="채우기">
        {({controlId, labelId}) => (
          <SegmentedControl<'color' | 'gradient'>
            id={controlId}
            labelledBy={labelId}
            fill
            value={kind}
            disabled={reason !== undefined}
            title={reason}
            options={[
              {value: 'color', label: '단색'},
              {value: 'gradient', label: '그라데이션'},
            ]}
            onChange={next => {
              if (next === kind) return;
              if ('color' in fill) {
                const {color, opacity} = fill;
                change({
                  angle: 90,
                  stops: [
                    {color, opacity, position: 0},
                    {color, opacity: 0, position: 100},
                  ],
                });
                return;
              }
              const {color = '#FFFFFF', opacity = 100} = fill.stops[0] ?? {};
              change({color, opacity});
            }}
          />
        )}
      </PropertyRow>
      {'color' in fill ? (
        <>
          <ColorProperty
            label="색"
            value={fill.color}
            reason={reason}
            commit={color => change({...fill, color})}
          />
          <ThemeNumber
            label="불투명도"
            value={fill.opacity}
            max={100}
            reason={reason}
            change={opacity => change({...fill, opacity})}
          />
        </>
      ) : (
        <>
          <ThemeNumber
            label="각도"
            value={fill.angle}
            max={MAX_ANGLE}
            reason={reason}
            change={angle => change({...fill, angle})}
          />
          {fill.stops.map((stop, index) => {
            const changeStop = (update: Partial<typeof stop>): void =>
              change({
                ...fill,
                stops: fill.stops.map((entry, at) =>
                  at === index ? {...entry, ...update} : entry,
                ),
              });
            return (
              <div key={index}>
                <ColorProperty
                  label={`색 ${index + 1}`}
                  value={stop.color}
                  reason={reason}
                  commit={color => changeStop({color})}
                />
                <ThemeNumber
                  label="위치"
                  value={stop.position}
                  max={100}
                  reason={reason}
                  change={position => changeStop({position})}
                />
                <ThemeNumber
                  label="불투명도"
                  value={stop.opacity}
                  max={100}
                  reason={reason}
                  change={opacity => changeStop({opacity})}
                />
                <IconButton
                  icon="trash"
                  label={`색 ${index + 1} 삭제`}
                  disabled={reason !== undefined || fill.stops.length <= 2}
                  title={reason}
                  onClick={() =>
                    change({
                      ...fill,
                      stops: fill.stops.filter((_, at) => at !== index),
                    })
                  }
                />
              </div>
            );
          })}
          <div className={styles.boxTools}>
            <Button
              icon="plus"
              disabled={
                reason !== undefined ||
                fill.stops.length >= THEME_FILE_LIMITS.gradientStops
              }
              title={reason}
              onClick={() => {
                const last = fill.stops.at(-1);
                if (last !== undefined) {
                  change({...fill, stops: [...fill.stops, {...last}]});
                }
              }}
            >
              색 추가
            </Button>
          </div>
        </>
      )}
    </>
  );
}
