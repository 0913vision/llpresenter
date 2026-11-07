import type {LiveCommand, SingleLiveCommand} from '@core/live/commands';

export function liveCommands(
  command: LiveCommand,
): readonly SingleLiveCommand[] {
  return command.type === 'live.batch' ? command.commands : [command];
}

export function lastLiveCommand(
  command: LiveCommand | undefined,
): SingleLiveCommand | undefined {
  return command === undefined ? undefined : liveCommands(command).at(-1);
}
