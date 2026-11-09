param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('install', 'package', 'inspect', 'smoke')]
    [string]$Stage
)

if ($env:GITHUB_ACTIONS -ne 'true') {
    throw 'Installer jobs run on GitHub runners only'
}

$PSNativeCommandUseErrorActionPreference = $false
switch ($Stage) {
    'install' {
        npm.cmd ci 2>&1 | Tee-Object -Variable installerStageOutput
    }
    'package' {
        npm.cmd run package:win 2>&1 | Tee-Object -Variable installerStageOutput
    }
    'inspect' {
        node scripts/installer/inspect.mts 2>&1 | Tee-Object -Variable installerStageOutput
    }
    'smoke' {
        node scripts/installer/smoke.mts 2>&1 | Tee-Object -Variable installerStageOutput
    }
}
$installerStageExitCode = $LASTEXITCODE
if ($installerStageExitCode -ne 0) {
    $installerStageMessage = ($installerStageOutput | Select-Object -Last 60 | Out-String).Trim()
    $installerStageMessage = $installerStageMessage.Replace('%', '%25').Replace("`r", '%0D').Replace("`n", '%0A')
    Write-Output "::error file=scripts/installer/run-ci.ps1,line=1,title=Installer $Stage failed::$installerStageMessage"
}
exit $installerStageExitCode
