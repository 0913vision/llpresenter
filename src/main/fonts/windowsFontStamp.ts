import {
  currentWindows,
  runPowerShell,
  windowsPowerShell,
  type WindowsEnvironment,
} from '../base/windowsPowerShell';

const STAMP_TIMEOUT_MS = 15_000;
const MAX_REPLY_BYTES = 1024;
const QUERY = String.raw`
$ErrorActionPreference = 'Stop'
$rows = [System.Collections.Generic.List[string]]::new()
$folders = @((Join-Path $env:SystemRoot 'Fonts'), (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'))
function StampFile($path) {
  $f = [IO.FileInfo]::new($path)
  if ($f.Exists) {
    $rows.Add("F|$($f.FullName)|$($f.Length)|$($f.LastWriteTimeUtc.Ticks)|$($f.CreationTimeUtc.Ticks)")
  } else { $rows.Add("M|$path") }
}
foreach ($folder in $folders) {
  $directory = [IO.DirectoryInfo]::new($folder)
  if ($directory.Exists) {
    $rows.Add("D|$folder|$($directory.LastWriteTimeUtc.Ticks)|$($directory.CreationTimeUtc.Ticks)")
    $count = 0
    foreach ($f in $directory.EnumerateFiles('*', [IO.SearchOption]::AllDirectories)) {
      if (++$count -gt 8192) { throw 'Too many font files' }
      $rows.Add("F|$($f.FullName)|$($f.Length)|$($f.LastWriteTimeUtc.Ticks)|$($f.CreationTimeUtc.Ticks)")
    }
  } else { $rows.Add("M|$folder") }
}
foreach ($hive in @('HKLM:', 'HKCU:')) {
  foreach ($leaf in @('Fonts', 'FontSubstitutes')) {
    $path = "$hive\SOFTWARE\Microsoft\Windows NT\CurrentVersion\$leaf"
    if (!(Test-Path -LiteralPath $path)) { $rows.Add("M|$path"); continue }
    $key = Get-Item -LiteralPath $path
    try {
      $names = @($key.GetValueNames())
      if ($names.Count -gt 8192) { throw 'Too many font registrations' }
      foreach ($name in $names) {
        $value = $key.GetValue($name)
        if ($value -isnot [string]) { throw 'Unsupported font registration' }
        $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value))
        $rows.Add("R|$path|$name|$($key.GetValueKind($name))|$encoded")
        if ($leaf -eq 'Fonts' -and [IO.Path]::IsPathRooted($value)) { StampFile $value }
      }
    } finally { $key.Dispose() }
  }
}
$bytes = [Text.Encoding]::UTF8.GetBytes((($rows | Sort-Object -CaseSensitive) -join "\n"))
$sha = [Security.Cryptography.SHA256]::Create()
try { [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
`;

/** Fingerprints font folders/files and per-machine/per-user font registry values. */
export async function readWindowsFontStamp(
  signal: AbortSignal,
  environment: WindowsEnvironment = currentWindows(),
): Promise<string> {
  const program = windowsPowerShell(environment);
  if (program === null) throw Error('Windows font stamp is unavailable');
  const stamp = await runPowerShell(program, QUERY, {
    signal,
    timeoutMs: STAMP_TIMEOUT_MS,
    maxBytes: MAX_REPLY_BYTES,
  }).then(
    printed => printed.trim(),
    (cause: unknown) => {
      throw Error('Could not fingerprint installed fonts', {cause});
    },
  );
  if (!/^[a-f0-9]{64}$/.test(stamp)) {
    throw Error('Could not fingerprint installed fonts');
  }
  return stamp;
}
