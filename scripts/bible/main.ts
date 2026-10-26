import {runBibleConverter} from './cli';

process.exitCode = await runBibleConverter(process.argv.slice(2));
