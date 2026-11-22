import {useState, type JSX, type KeyboardEvent, type ReactNode} from 'react';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {LabelMenu} from '@renderer/features/songs/editor/LabelMenu';
import {Button} from '@renderer/ui/Button';
import {isComposing} from '@renderer/ui/ime';
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {Properties, PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import {
  TransitionSection,
  type TransitionSectionProps,
} from './TransitionSection';
import styles from './SlideInspector.module.css';

export interface InspectorLabelAdapter {
  readonly store: SongEditorStore;
  readonly associateControl?: boolean;
  readonly value: string | undefined;
  readonly mixed: boolean;
  readonly disabled: boolean;
  readonly change: (value: string | undefined) => void;
}

/** One selection and command contract for an inspector, independent of item kind. */
export interface InspectorAdapter {
  readonly selectedIds: readonly string[];
  readonly label?: InspectorLabelAdapter | undefined;
  readonly transition?: TransitionSectionProps | undefined;
  readonly undo?: ((action: 'undo' | 'redo') => void) | undefined;
  readonly undoDisabled?: boolean | undefined;
}

/** Renders the same preview, property and transition surface for each adapter. */
export function SlideInspectorView({
  identity,
  preview,
  text,
  beforeProperties,
  afterProperties,
  adapter,
}: {
  readonly identity?: string | undefined;
  readonly preview?: ReactNode;
  /** The fields of the selected slide's texts. */
  readonly text?: ReactNode;
  readonly beforeProperties?: ReactNode;
  readonly afterProperties?: ReactNode;
  readonly adapter?: InspectorAdapter | undefined;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const label = adapter?.label;
  const keyDown = (event: KeyboardEvent): void => {
    if (
      adapter?.undo === undefined ||
      adapter.undoDisabled ||
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
    adapter.undo(key === 'y' || event.shiftKey ? 'redo' : 'undo');
  };
  return (
    <Panel label={'슬라이드 속성'}>
      <PanelBody>
        {identity === undefined || adapter === undefined ? null : (
          <div onKeyDown={keyDown}>
            {preview}
            {text}
            {beforeProperties}
            {label === undefined &&
            adapter.transition === undefined &&
            afterProperties === undefined ? null : (
              <Properties>
                {label === undefined ? null : (
                  <PropertyGroup>
                    <PropertyRow label={'이름표'}>
                      {({controlId}) => (
                        <Button
                          id={
                            label.associateControl === false
                              ? undefined
                              : controlId
                          }
                          size="md"
                          className={styles.full}
                          disabled={label.disabled}
                          onClick={event => setAnchor(event.currentTarget)}
                        >
                          {label.mixed
                            ? '혼합'
                            : label.value === undefined || label.value === ''
                              ? '없음'
                              : label.value}
                        </Button>
                      )}
                    </PropertyRow>
                  </PropertyGroup>
                )}
                {adapter.transition === undefined ? null : (
                  <TransitionSection
                    {...adapter.transition}
                    selectionKey={`${adapter.transition.selectionKey}:${JSON.stringify(adapter.selectedIds)}`}
                  />
                )}
                {afterProperties}
              </Properties>
            )}
            {label === undefined || anchor === null ? null : (
              <LabelMenu
                store={label.store}
                anchor={anchor}
                selected={label.mixed ? undefined : label.value}
                onChoose={label.change}
                onClose={restore => {
                  setAnchor(null);
                  if (restore) anchor.focus();
                }}
              />
            )}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
