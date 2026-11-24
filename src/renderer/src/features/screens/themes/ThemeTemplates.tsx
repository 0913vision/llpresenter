import {useRef, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {THEME_FILE_LIMITS} from '@core/schema/theme';
import {Button} from '@renderer/ui/buttons/Button';
import {IconButton} from '@renderer/ui/buttons/IconButton';
import {PropertyRow} from '@renderer/ui/panels/PropertyRow';
import {ThemeTextArea} from './ThemePropertyFields';
import {textWithValue, ThemeValueButton} from './ThemeValueButton';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

/**
 * The phrases of a text. The first one that has any of its values shows; a
 * missing value is left out, with its brackets when it was put in with them.
 * Each phrase after the first is an 없으면 row: what shows when the ones above
 * have none of their values.
 */
export function ThemeTemplates({
  model,
  label,
  templates,
  values,
  reason,
  change,
}: {
  readonly model: ThemeModel;
  readonly label: string;
  readonly templates: readonly string[];
  readonly values: readonly string[];
  readonly reason: string | undefined;
  readonly change: (templates: string[]) => void;
}): JSX.Element {
  const areas = useRef(new Map<number, HTMLTextAreaElement>());
  const replaceAt = (index: number, template: string): void =>
    change(templates.map((entry, at) => (at === index ? template : entry)));
  const insert = (index: number, text: string): void => {
    replaceAt(
      index,
      textWithValue(templates[index] ?? '', areas.current.get(index), text),
    );
  };
  const full = templates.length >= THEME_FILE_LIMITS.templates;
  return (
    <>
      {templates.map((template, index) => (
        <PropertyRow
          key={index}
          label={index === 0 ? label : '없으면'}
          alignTop
        >
          {({controlId}) => (
            <div className={styles.template}>
              <ThemeTextArea
                id={controlId}
                label={`${label} ${index + 1}`}
                value={template}
                reason={reason}
                begin={model.beginEditGroup}
                change={text => replaceAt(index, text)}
                area={element => {
                  if (element === null) areas.current.delete(index);
                  else areas.current.set(index, element);
                }}
              />
              <div className={styles.templateTools}>
                <ThemeValueButton
                  values={values}
                  reason={reason}
                  onPick={text => insert(index, text)}
                />
                <IconButton
                  icon="trash"
                  label={`${label} ${index + 1} 삭제`}
                  disabled={reason !== undefined}
                  title={reason}
                  onClick={() =>
                    change(templates.filter((_, at) => at !== index))
                  }
                />
              </div>
            </div>
          )}
        </PropertyRow>
      ))}
      <PropertyRow label={templates.length === 0 ? label : ''}>
        {() => (
          <div className={styles.templates}>
            <Button
              icon="plus"
              disabled={reason !== undefined || full}
              title={
                reason ??
                (full
                  ? limitReason('문구', THEME_FILE_LIMITS.templates)
                  : undefined)
              }
              onClick={() => change([...templates, ''])}
            >
              문구 추가
            </Button>
          </div>
        )}
      </PropertyRow>
    </>
  );
}
