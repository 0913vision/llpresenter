import type {JSX} from 'react';
import {IconButton} from '../IconButton';
import {Section, SpecGroup, SpecItem, Stateful} from './Spec';

export function IconButtonSection(): JSX.Element {
  return (
    <Section title="IconButton">
      <SpecGroup title="sm 26×26, icon 16, in a panel" surface="panel">
        <SpecItem label="Default">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Pressed" pin="pressed">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <IconButton icon="plus" label="항목 추가" />
        </SpecItem>
        <SpecItem label="Disabled">
          <IconButton icon="plus" label="항목 추가" disabled />
        </SpecItem>
        <SpecItem label="Off">
          <Stateful<boolean> initial={false}>
            {(pressed, setPressed) => (
              <IconButton
                icon="loop"
                label="반복"
                pressed={pressed}
                onPressedChange={setPressed}
              />
            )}
          </Stateful>
        </SpecItem>
        <SpecItem label="On">
          <IconButton icon="loop" label="반복" pressed />
        </SpecItem>
        <SpecItem label="On + hover" pin="hover">
          <IconButton icon="loop" label="반복" pressed />
        </SpecItem>
        <SpecItem label="Menu open">
          <IconButton icon="more" label="메뉴" menu expanded />
        </SpecItem>
      </SpecGroup>
      <SpecGroup title="md 30×30, icon 16, dialog header" surface="dialog">
        <SpecItem label="Default">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Hover" pin="hover">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Pressed" pin="pressed">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Focus" pin="focus">
          <IconButton icon="x" label="닫기" size="md" shortcut="Esc" />
        </SpecItem>
        <SpecItem label="Disabled">
          <IconButton icon="x" label="닫기" size="md" disabled />
        </SpecItem>
      </SpecGroup>
    </Section>
  );
}
