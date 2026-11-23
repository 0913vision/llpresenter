import {app} from 'electron';
import {startOutputs} from '../outputs/start';
import type {registerPlaybackProblems} from '../outputs/playbackProblems';
import {controlRecoveryPlacement} from '../windows/controlRecovery';
import {GraphicsRecovery} from '../windows/graphicsRecovery';
import type {ControlOwner} from './controlOwner';
import type {Foundation} from './foundation';
import type {ControlFeatures} from './controlFeatures';

type Outputs = ReturnType<typeof startOutputs>;

/** The parts that draw, which start again after a graphics failure. */
export interface GraphicsParts {
  readonly control: ControlOwner;
  readonly settingsWindow: ControlFeatures['settingsWindow'];
  readonly playbackProblems: ReturnType<typeof registerPlaybackProblems>;
}

/** Runs the outputs, and replaces every window after a graphics failure. */
export class Graphics {
  private outputs: Outputs;
  private readonly recovery: GraphicsRecovery;

  constructor(
    private readonly foundation: Foundation,
    private readonly parts: GraphicsParts,
  ) {
    const {log} = foundation;
    this.outputs = this.startOutputs();
    this.recovery = new GraphicsRecovery(
      reason => this.replaceWindows(reason),
      error => log.error('could not recover graphics windows', error),
    );
  }

  /** Has the windows replaced. */
  request(reason: 'gpu-loss' | 'control-hang'): void {
    this.recovery.request(reason);
  }

  frameRates(): ReturnType<Outputs['frameRates']> {
    return this.outputs.frameRates();
  }

  stopRecovery(): void {
    this.recovery.stop();
  }

  stopOutputs(): void {
    this.outputs.stop();
  }

  private startOutputs(): Outputs {
    const {problems, launch, launchIdle, store, data, windowMode, log} =
      this.foundation;
    launch.begin('outputs');
    return startOutputs({
      problems: problems.feed,
      playbackProblems: this.parts.playbackProblems.board,
      onPrepared: ({done, total}) => {
        launch.advance('outputs', done, total);
        if (done < total) return;
        launch.finish('outputs');
        launchIdle.outputsReady();
      },
      store,
      settings: data.settings,
      saveScreenSettings: data.applySettingsEdit,
      control: this.parts.control.window,
      log,
      windowMode,
      presenter: true,
    });
  }

  private async replaceWindows(reason: string): Promise<void> {
    const {problems, log} = this.foundation;
    const {control, settingsWindow} = this.parts;
    const previous = control.window;
    const replacement = control.open(controlRecoveryPlacement(previous));
    settingsWindow.replaceControl(replacement);
    replacement.webContents.once('did-finish-load', () => {
      problems.feed.report({kind: 'graphics-recovered'});
    });
    // NOTE(0913vision): The main live store retains the output switches and slide.
    this.outputs.stop();
    this.outputs = this.startOutputs();
    if (!previous.isDestroyed()) previous.destroy();
    log.info('recreated windows after graphics failure', {reason});
    await Promise.resolve();
  }
}

/** Ends a GPU process that hangs, and tells if it could. */
export function restartGpu(onError: (error: unknown) => void): boolean {
  const gpu = app.getAppMetrics().find(process => process.type === 'GPU');
  if (gpu === undefined) return false;
  try {
    process.kill(gpu.pid);
    return true;
  } catch (error) {
    onError(error);
    return false;
  }
}
