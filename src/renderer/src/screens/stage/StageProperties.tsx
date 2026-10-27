import {useState, type JSX} from 'react';
import {stageElementKinds} from '@shared/schema/stageLayouts';
import {STAGE_TEXT_FALLBACK} from '@renderer/render/stageLayout';
import {
  Button,
  Properties,
  PropertyGroup,
  PropertyRow,
  SelectMenu,
  SegmentedControl,
} from '@renderer/ui';
import type {Notice} from '@renderer/ui/notices';
import {useScreensSelection} from '../selection';
import {useSettingsDocument} from '../useSettingsDocument';
import {elementNames} from './stageEditor';
import {useStageEditor} from './useStageEditor';
import {StageBoxProperties} from './StageBoxProperties';
import {
  StageStringProperty,
  StageTextProperties,
  STAGE_READ_ONLY,
} from './StageTextProperties';

/** Edits the canvas selection through the same queued settings-document session. */
export function StageProperties({
  onProblem,
}: {
  onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const document = useSettingsDocument('stage-layouts', '무대 배치', onProblem);
  const selection = useScreensSelection(view => view.selection);
  const picked = useScreensSelection(view => view.stageElement);
  const select = useScreensSelection(view => view.selectStageElement);
  const run = useStageEditor(document, onProblem);
  const [tab, setTab] = useState<'appearance' | 'text'>('text');
  const layout =
    selection.kind === 'stage'
      ? document?.value.layouts.find(layout => layout.id === selection.id)
      : undefined;
  const element =
    layout?.id === picked?.layoutId
      ? layout?.elements.find(element => element.id === picked?.elementId)
      : undefined;
  if (element === undefined || layout === undefined) return null;
  const reason = document?.access === 'editable' ? undefined : STAGE_READ_ONLY;
  return (
    <Properties key={`${element.id}:${document?.access}`}>
      <PropertyGroup title="요소">
        <StageStringProperty
          label="이름"
          value={element.name}
          reason={reason}
          commit={name =>
            run(editor => editor.patch(layout.id, element.id, {name}))
          }
        />
        <PropertyRow label="내용 종류">
          {({controlId}) => (
            <SelectMenu
              id={controlId}
              aria-label="내용 종류"
              block
              disabled={reason !== undefined}
              title={reason}
              value={element.kind}
              options={stageElementKinds.map(value => ({
                value,
                label: elementNames[value],
              }))}
              onChange={kind =>
                run(editor => editor.patch(layout.id, element.id, {kind}))
              }
            />
          )}
        </PropertyRow>
        <Button
          size="sm"
          disabled={reason !== undefined}
          title={reason}
          onClick={() =>
            run(
              editor => editor.remove(layout.id, element.id),
              saved => {
                const current = useScreensSelection.getState().stageElement;
                if (
                  saved &&
                  current?.layoutId === layout.id &&
                  current.elementId === element.id
                ) {
                  select(layout.id, null);
                }
              },
            )
          }
        >
          요소 삭제
        </Button>
      </PropertyGroup>
      <SegmentedControl
        label="요소 속성"
        kind="tabs"
        fill
        value={tab}
        onChange={setTab}
        options={[
          {value: 'appearance', label: '모양'},
          {value: 'text', label: '글자'},
        ]}
      />
      <div role="tabpanel" aria-label={tab === 'text' ? '글자' : '모양'}>
        <PropertyGroup title={tab === 'text' ? '글자' : '모양'}>
          {tab === 'text' ? (
            <StageTextProperties
              text={element.text ?? STAGE_TEXT_FALLBACK}
              reason={reason}
              change={text =>
                run(editor => editor.patch(layout.id, element.id, {text}))
              }
            />
          ) : (
            <StageBoxProperties
              box={element.box}
              reason={reason}
              change={box =>
                run(editor => editor.patch(layout.id, element.id, {box}))
              }
            />
          )}
        </PropertyGroup>
      </div>
    </Properties>
  );
}
