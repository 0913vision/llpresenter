import type {LiveCommand} from '../schema/liveCommand';

/** Whether this command interrupts pending song-output navigation. */
export function interruptsSongOutput(command: LiveCommand): boolean {
  switch (command.type) {
    case 'slide.show':
    case 'media.show':
    case 'clear.undo':
    case 'item.stop':
    case 'item.restore':
      return true;
    case 'layer.clear':
    case 'layer.clear.toggle':
      return ['all', 'slide', 'media'].includes(command.target);
    case 'live.batch':
      return command.commands.some(interruptsSongOutput);
    case 'screen.testPattern.set':
      return command.on;
    case 'message.show':
    case 'media.properties.refresh':
    case 'output.set':
    case 'black.toggle':
    case 'slide.update':
    case 'stage.timer.set':
    case 'stage.message.set':
    case 'prop.set':
    case 'message.send':
    case 'message.expire':
    case 'overlay.clear':
    case 'timer.start':
    case 'timer.pause':
    case 'timer.reset':
    case 'audio.play':
    case 'audio.pause':
    case 'audio.next':
    case 'audio.previous':
    case 'audio.fadeOut':
    case 'audio.fadeOut.complete':
    case 'audio.volume.set':
    case 'macro.run':
    case 'item.start':
    case 'theme.set':
    case 'themes.refresh':
    case 'monitors.identify':
    case 'screen.settings.apply':
      return false;
    default: {
      const unhandled: never = command;
      return unhandled;
    }
  }
}
