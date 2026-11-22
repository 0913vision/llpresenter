import {useRef, useState, type JSX} from 'react';
import {limitReason} from '@core/common/limitReason';
import {THEME_FILE_LIMITS} from '@core/schema/theme';
import {Button} from '@renderer/ui/Button';
import {IconButton} from '@renderer/ui/IconButton';
import {Menu} from '@renderer/ui/Menu';
import {PropertyRow} from '@renderer/ui/PropertyRow';
import {ThemeTextArea} from './ThemePropertyFields';
import type {ThemeModel} from './useThemeEditor';
import styles from './Themes.module.css';

/**
 * The phrases of a text. The first one whose values are all there shows, and
 * `[...]` is left out when a value inside it is missing.
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
  const [inserting, setInserting] = useState<{
    readonly index: number;
    readonly anchor: HTMLElement;
  } | null>(null);
  const replaceAt = (index: number, template: string): void =>
    change(templates.map((entry, at) => (at === index ? template : entry)));
  const insert = (index: number, value: string): void => {
    const template = templates[index] ?? '';
    const area = areas.current.get(index);
    const start = area?.selectionStart ?? template.length;
    const end = area?.selectionEnd ?? start;
    replaceAt(
      index,
      `${template.slice(0, start)}{${value}}${template.slice(end)}`,
    );
  };
  const full = templates.length >= THEME_FILE_LIMITS.templates;
  return (
    <PropertyRow label={label} alignTop>
      {({controlId}) => (
        <div className={styles.templates}>
          {templates.map((template, index) => (
            <div key={index} className={styles.template}>
              <ThemeTextArea
                id={index === 0 ? controlId : undefined}
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
                <IconButton
                  icon="plus"
                  label="값 넣기"
                  disabled={reason !== undefined}
                  title={reason}
                  onClick={event =>
                    setInserting({index, anchor: event.currentTarget})
                  }
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
          ))}
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
          {inserting === null ? null : (
            <Menu
              label="값 넣기"
              anchor={{kind: 'element', element: inserting.anchor}}
              entries={values.map(value => ({
                kind: 'item',
                id: value,
                label: value,
                onSelect: () => insert(inserting.index, value),
              }))}
              onClose={() => setInserting(null)}
            />
          )}
        </div>
      )}
    </PropertyRow>
  );
}
