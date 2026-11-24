import {useRef, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {
  THEME_FILE_LIMITS,
  slidePurposes,
  type ThemeBox,
  type ThemeFile,
} from '@core/schema/screens/theme';
import {
  addBox,
  appBoxes,
  boxNameProblem,
  changeBox,
  moveBox,
  removeBox,
  themeValues,
  builtInTheme,
} from '@core/theme';
import {AUTO_TOKENS} from '@core/schema/slides/slideContent';
import {Button} from '@renderer/ui/buttons/Button';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {
  Properties,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
} from '@renderer/ui/panels/PropertyRow';
import {SegmentedControl} from '@renderer/ui/choices/SegmentedControl';
import {SelectMenu} from '@renderer/ui/choices/SelectMenu';
import {StringProperty} from '../../StringProperty';
import {ThemeBackgroundProperties} from './ThemeBackgroundProperties';
import {ThemeTextArea} from './ThemePropertyFields';
import {ThemeTemplates} from './ThemeTemplates';
import {textWithValue, ThemeValueButton} from './ThemeValueButton';
import {purposeNames} from '../themeNames';
import type {ThemeModel} from '../useThemeEditor';
import styles from '../Themes.module.css';

const boxNameProblems = {
  empty: '이름을 적어야 합니다.',
  brackets: '{ } [ ]는 쓸 수 없습니다.',
  taken: '같은 이름의 글 상자가 있음',
} as const;
const APP_BOX = '앱이 글을 넣는 글 상자는 이름을 바꿀 수 없습니다.';
const SAME_THEME = '';

/** What the slides of a theme have, whatever screen they are on. */
export function ThemeFileProperties({
  model,
}: {
  readonly model: ThemeModel;
}): JSX.Element | null {
  const {theme, reason, list} = model;
  if (theme === undefined || list === null) return null;
  const {next} = theme;
  const change = (patch: Partial<ThemeFile>): void => {
    model.themeChange(current => ({...current, ...patch}));
  };
  const full = theme.boxes.length >= THEME_FILE_LIMITS.boxes;
  return (
    <Properties key={theme.id}>
      <PropertyGroup title="슬라이드">
        {builtInTheme(theme.id) === undefined ? (
          <PropertyRow label="쓰임">
            {({controlId}) => (
              <SelectMenu
                id={controlId}
                block
                value={theme.purpose}
                disabled={reason !== undefined}
                title={reason}
                options={slidePurposes.map(purpose => ({
                  value: purpose,
                  label: purposeNames[purpose],
                }))}
                onChange={purpose => change({purpose})}
              />
            )}
          </PropertyRow>
        ) : (
          <PropertyValue label="쓰임" value={purposeNames[theme.purpose]} />
        )}
        <PropertyRow label="다음 테마">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              block
              value={theme.then ?? SAME_THEME}
              disabled={reason !== undefined}
              title={reason}
              options={[
                {value: SAME_THEME, label: '같은 테마'},
                ...list.themes
                  .filter(entry => entry.id !== theme.id)
                  .map(entry => ({value: entry.id, label: entry.name})),
              ]}
              onChange={id =>
                model.themeChange(current => {
                  const {then: _then, ...rest} = current;
                  const chosen = list.themes.find(entry => entry.id === id);
                  return chosen === undefined
                    ? rest
                    : {...rest, then: chosen.id};
                })
              }
            />
          )}
        </PropertyRow>
        <ThemeBackgroundProperties
          model={model}
          background={theme.background}
        />
      </PropertyGroup>
      {theme.boxes.map((box, index) => (
        <BoxProperties
          key={box.name}
          model={model}
          theme={theme}
          box={box}
          index={index}
        />
      ))}
      <PropertyGroup>
        <div className={styles.boxTools}>
          <Button
            icon="plus"
            disabled={reason !== undefined || full}
            title={
              reason ??
              (full
                ? limitReason('글 상자', THEME_FILE_LIMITS.boxes)
                : undefined)
            }
            onClick={() => model.themeChange(current => addBox(current)?.theme)}
          >
            글 상자 추가
          </Button>
        </div>
      </PropertyGroup>
      <PropertyGroup title="미리 보여줄 내용">
        <ThemeTemplates
          model={model}
          label="문구"
          templates={next.content}
          values={themeValues(theme)}
          reason={reason}
          change={content => change({next: {...next, content}})}
        />
      </PropertyGroup>
    </Properties>
  );
}

function BoxProperties({
  model,
  theme,
  box,
  index,
}: {
  readonly model: ThemeModel;
  readonly theme: ThemeFile;
  readonly box: ThemeBox;
  readonly index: number;
}): JSX.Element {
  const {reason} = model;
  const change = (update: (box: ThemeBox) => ThemeBox): void => {
    model.themeChange(current => changeBox(current, box.name, update));
  };
  const fixed = appBoxes(theme.purpose).has(box.name) ? APP_BOX : undefined;
  const defaultArea = useRef<HTMLTextAreaElement | null>(null);
  const setDefault = (text: string): void =>
    change(current => {
      const {default: _default, ...rest} = current;
      return text === '' ? rest : {...rest, default: text};
    });
  return (
    <PropertyGroup
      title={`글 상자: ${box.name}`}
      action={
        <>
          <IconButton
            icon="up"
            label={`${box.name} 글 상자 위로`}
            disabled={reason !== undefined || index === 0}
            title={reason}
            onClick={() =>
              model.themeChange(current => moveBox(current, box.name, -1))
            }
          />
          <IconButton
            icon="down"
            label={`${box.name} 글 상자 아래로`}
            disabled={reason !== undefined || index === theme.boxes.length - 1}
            title={reason}
            onClick={() =>
              model.themeChange(current => moveBox(current, box.name, 1))
            }
          />
          <IconButton
            icon="trash"
            label={`${box.name} 글 상자 삭제`}
            disabled={reason !== undefined}
            title={reason}
            onClick={() =>
              model.themeChange(current => removeBox(current, box.name))
            }
          />
        </>
      }
    >
      <StringProperty
        label="이름"
        value={box.name}
        reason={reason ?? fixed}
        validate={name => {
          const problem = boxNameProblem(theme, name, box.name);
          return problem === undefined ? undefined : boxNameProblems[problem];
        }}
        commit={name => change(current => ({...current, name: name.trim()}))}
      />
      <PropertyRow label="처음 글" alignTop>
        {({controlId}) => (
          <div className={styles.template}>
            <ThemeTextArea
              id={controlId}
              label={`${box.name} 처음 글`}
              value={box.default ?? ''}
              reason={reason}
              begin={model.beginEditGroup}
              change={setDefault}
              area={element => {
                defaultArea.current = element;
              }}
            />
            <div className={styles.templateTools}>
              <ThemeValueButton
                values={Object.values(AUTO_TOKENS)}
                reason={reason}
                onPick={text =>
                  setDefault(
                    textWithValue(box.default ?? '', defaultArea.current, text),
                  )
                }
              />
            </div>
          </div>
        )}
      </PropertyRow>
      <PropertyRow label="줄">
        {({controlId, labelId}) => (
          <SegmentedControl
            id={controlId}
            labelledBy={labelId}
            fill
            value={box.rows}
            disabled={reason !== undefined}
            title={reason}
            options={[
              {value: 'one', label: '한 줄'},
              {value: 'many', label: '여러 줄'},
            ]}
            onChange={rows => change(current => ({...current, rows}))}
          />
        )}
      </PropertyRow>
    </PropertyGroup>
  );
}
