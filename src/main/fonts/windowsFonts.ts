import {execFile} from 'node:child_process';
import {win32} from 'node:path';
import {
  FONT_CATALOG_LIMITS,
  parseFontCatalog,
  type FontCatalog,
} from '@shared/schema/fontCatalog';

export const FONT_QUERY_TIMEOUT_MS = 10_000;
const MAX_REPLY_BYTES = 2 * 1024 * 1024;

const QUERY = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName PresentationCore
$english = [System.Windows.Markup.XmlLanguage]::GetLanguage('en-US')
$korean = [System.Windows.Markup.XmlLanguage]::GetLanguage('ko-KR')
$catalog = @([System.Windows.Media.Fonts]::SystemFontFamilies | Select-Object -First ${FONT_CATALOG_LIMITS.families} | ForEach-Object {
  $family = $_
  $names = $family.FamilyNames
  $canonical = if ($names.ContainsKey($english)) { $names[$english] } else { $family.Source }
  $label = if ($names.ContainsKey($korean)) { $names[$korean] } else { $canonical }
  $aliases = @(@($family.Source) + @($names.Values) | Sort-Object -Unique | Select-Object -First ${FONT_CATALOG_LIMITS.aliases})
  $weights = @($family.GetTypefaces() | Where-Object { $glyph = $null; $_.TryGetGlyphTypeface([ref]$glyph) } | ForEach-Object { $_.Weight.ToOpenTypeWeight() } | Sort-Object -Unique | Select-Object -First ${FONT_CATALOG_LIMITS.weights})
  if ($weights.Count -gt 0) { [pscustomobject]@{ family=$canonical; label=$label; aliases=$aliases; weights=$weights } }
})
ConvertTo-Json -InputObject $catalog -Depth 4 -Compress
`;

/** Reads Windows font metadata in a hidden, bounded, cancellable child process. */
export async function readWindowsFonts(
  signal: AbortSignal,
  environment = {
    platform: process.platform,
    root: process.env['SystemRoot'],
  },
): Promise<FontCatalog> {
  const {root} = environment;
  if (
    environment.platform !== 'win32' ||
    root === undefined ||
    !win32.isAbsolute(root)
  ) {
    throw new Error('Windows font enumeration is unavailable');
  }
  const program = win32.join(
    root,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const text = await new Promise<string>((resolve, reject) => {
    execFile(
      program,
      ['-NoProfile', '-NonInteractive', '-Command', QUERY],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: FONT_QUERY_TIMEOUT_MS,
        maxBuffer: MAX_REPLY_BYTES,
        signal,
      },
      (error, stdout) => {
        if (error !== null) {
          reject(new Error('Windows font query failed', {cause: error}));
        } else resolve(stdout);
      },
    );
  });
  const value: unknown = JSON.parse(text);
  const parsed = parseFontCatalog(value);
  if (!parsed.ok) throw new Error('Invalid installed font metadata');
  return parsed.value;
}
