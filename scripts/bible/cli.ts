import {convertBibleFile} from './convert';

const USAGE =
  'Usage: npm run bible:convert -- <source-v1.llbible> <destination-v2.llbible>';

/** Reports a conversion outcome and returns a shell exit code. */
export async function runBibleConverter(
  args: readonly string[],
): Promise<number> {
  if (args.length === 1 && args[0] === '--help') {
    console.info(USAGE);
    return 0;
  }
  const [source, destination] = args;
  if (args.length !== 2 || !source?.trim() || !destination?.trim()) {
    console.error(USAGE);
    return 2;
  }
  try {
    await convertBibleFile(source, destination);
    console.info(`Converted ${source} to ${destination}`);
    return 0;
  } catch (error: unknown) {
    console.error(
      'Could not convert Bible file:',
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
