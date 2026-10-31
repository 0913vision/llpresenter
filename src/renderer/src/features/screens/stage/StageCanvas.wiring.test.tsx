import {cleanup, render, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {afterEach, expect, it, vi} from 'vitest';
import {settingsDocument} from '@core/testing/settingsDocument';
import {LAYOUT_ID} from '@core/testing/screenDocuments';
import type {StageElement} from '@core/schema/stageLayouts';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import type {CanvasEditorProps} from '@renderer/ui/CanvasEditor';
import type {StagePicture} from './StagePicture';
import {useScreensSelection} from '../selection';
import {StageCanvas} from './StageCanvas';

const {mockCanvas, mockPicture} = vi.hoisted(() => ({
  mockCanvas: vi.fn<(props: CanvasEditorProps<StageElement>) => ReactNode>(),
  mockPicture: vi.fn<(props: Parameters<typeof StagePicture>[0]) => null>(),
}));
vi.mock('@renderer/ui/CanvasEditor', () => ({CanvasEditor: mockCanvas}));
vi.mock('./StagePicture', () => ({StagePicture: mockPicture}));

afterEach(() => {
  cleanup();
  delete window.llp;
});

it('adapts stage selection and draft frames through the shared canvas renderer', async () => {
  const document = settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      {
        id: LAYOUT_ID,
        name: 'Canvas',
        width: 1920,
        height: 1080,
        elements: [
          {
            id: 'first',
            name: '현재 가사',
            kind: 'currentSlide',
            frame: {x: 100, y: 100, w: 400, h: 200},
          },
        ],
      },
    ],
  });
  if (document.name !== 'stage-layouts') throw new Error('Invalid fixture');
  const layout = document.value.layouts.find(item => item.id === LAYOUT_ID);
  const first = layout?.elements[0];
  if (!layout || !first) throw new Error('Missing layout fixture');
  const draft = {...first, frame: {...first.frame, x: first.frame.x + 10}};
  mockCanvas.mockImplementation(props =>
    props.renderContent([draft, ...props.value.elements.slice(1)]),
  );
  mockPicture.mockReturnValue(null);
  const edit = vi.fn();
  window.llp = mockLlpApi({
    settings: {
      get: async request =>
        request.name === 'stage-layouts'
          ? document
          : settingsDocument('timers', {timers: []}),
      edit,
    },
  });
  useScreensSelection.getState().select('stage', LAYOUT_ID);
  useScreensSelection.getState().selectStageElement(LAYOUT_ID, first.id);
  render(<StageCanvas />);
  await waitFor(() => expect(mockCanvas).toHaveBeenCalled());
  const props = mockCanvas.mock.calls.at(-1)?.[0];
  expect(props?.value).toEqual(layout);
  expect(props?.selected).toBe(first.id);
  expect(props?.label).toBe('무대 배치');
  expect(mockPicture.mock.calls.at(-1)?.[0].layout.elements[0]).toEqual(draft);
  expect(edit).not.toHaveBeenCalled();
});
