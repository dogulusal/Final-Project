$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Split-Path -Parent $root
Set-Location $backend

$mlPath = Join-Path $backend 'src/modules/ml/ml.service.ts'
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'

$original = Get-Content -Path $mlPath -Raw -Encoding UTF8

function Replace-Strict {
    param(
        [string]$Text,
        [string]$Old,
        [string]$New,
        [string]$Label
    )

    if (-not $Text.Contains($Old)) {
        throw "Replacement target not found for $Label"
    }

    return $Text.Replace($Old, $New)
}

function Build-ScenarioContent {
    param(
        [string]$Name,
        [string]$Base
    )

    $text = $Base

    switch ($Name) {
        'baseline' { }
        'no-task11' {
            $text = Replace-Strict -Text $text -Old "const dunyaToSiyaset = injectFromPool(dunyaSiyasetPool, 10);" -New "const dunyaToSiyaset = injectFromPool(dunyaSiyasetPool, 0);" -Label 'Task1.1-dunyaToSiyaset'
            $text = Replace-Strict -Text $text -Old "const siyasetToDunya = injectFromPool(siyasetDunyaPool, 10);" -New "const siyasetToDunya = injectFromPool(siyasetDunyaPool, 0);" -Label 'Task1.1-siyasetToDunya'
        }
        'no-task12' {
            $text = Replace-Strict -Text $text -Old "let cap = category === 'Siyaset' ? 0.08 : 0.18;" -New "let cap = category === 'Siyaset' ? 0.13 : 0.18;" -Label 'Task1.2-cap'
        }
        'no-task13' {
            $text = Replace-Strict -Text $text -Old "news.icerik ? news.icerik.slice(0, 800) : ''" -New "news.icerik ? news.icerik.slice(0, 300) : ''" -Label 'Task1.3-slice'
        }
        'no-task14' {
            $oldHealth = @"
            'Sağlık': [
                'hastane', 'doktor', 'aşı', 'salgın', 'kanser', 'tedavi', 'sağlık', 'ameliyat',
                'acil servis', 'yoğun bakım', 'sağlık bakanlığı', 'epidemi', 'hijyen', 'enfeksiyon',
                'muayene', 'reçete', 'tıbbi', 'klinik', 'hemşire', 'ambulans'
            ],
"@
            $newHealth = @"
            'Sağlık': ['hastane', 'doktor', 'aşı', 'salgın', 'kanser', 'tedavi', 'sağlık', 'ameliyat'],
"@
            $text = Replace-Strict -Text $text -Old $oldHealth -New $newHealth -Label 'Task1.4-health-hints'
        }
        'no-task15' {
            $text = Replace-Strict -Text $text -Old "const ekonomiToTeknoloji = injectFromPool(ekonomiTechPool, 8);" -New "const ekonomiToTeknoloji = injectFromPool(ekonomiTechPool, 0);" -Label 'Task1.5-ekonomi-tech'
        }
        default {
            throw "Unknown scenario: $Name"
        }
    }

    return $text
}

$scenarios = @('baseline', 'no-task11', 'no-task12', 'no-task13', 'no-task14', 'no-task15')
$results = @()

try {
    foreach ($scenario in $scenarios) {
        Write-Host "=== Running $scenario ==="

        $scenarioContent = Build-ScenarioContent -Name $scenario -Base $original
        Set-Content -Path $mlPath -Value $scenarioContent -Encoding UTF8

        $logPath = Join-Path $backend ("ablation-{0}-{1}.log" -f $scenario, $stamp)
        npx ts-node --project tsconfig.scripts.json src/scripts/debug-ml.ts *> $logPath
        $exitCode = $LASTEXITCODE

        $accMatch = Select-String -Path $logPath -Pattern "\[ML\]\[Diagnostics\] Accuracy=%([0-9]+\.[0-9]+)" | Select-Object -First 1
        $acc = $null
        if ($accMatch) {
            $acc = [double]$accMatch.Matches[0].Groups[1].Value
        }

        $pairDunya = Select-String -Path $logPath -Pattern "\[ML\]\[Diagnostics\]\[TopPair [0-9]+\] Dünya -> Siyaset: ([0-9]+)" | Select-Object -First 1
        $pairGenel = Select-String -Path $logPath -Pattern "\[ML\]\[Diagnostics\]\[TopPair [0-9]+\] Genel -> Siyaset: ([0-9]+)" | Select-Object -First 1

        $results += [PSCustomObject]@{
            scenario = $scenario
            exitCode = $exitCode
            accuracyPct = if ($acc -ne $null) { $acc } else { [double]::NaN }
            dunyaToSiyaset = if ($pairDunya) { [int]$pairDunya.Matches[0].Groups[1].Value } else { -1 }
            genelToSiyaset = if ($pairGenel) { [int]$pairGenel.Matches[0].Groups[1].Value } else { -1 }
            logPath = $logPath
        }
    }
}
finally {
    Set-Content -Path $mlPath -Value $original -Encoding UTF8
}

$baseline = $results | Where-Object { $_.scenario -eq 'baseline' } | Select-Object -First 1
if (-not $baseline) {
    throw 'Baseline result missing'
}

$resultsWithDelta = $results | ForEach-Object {
    $delta = if ([double]::IsNaN($_.accuracyPct)) { [double]::NaN } else { [math]::Round($baseline.accuracyPct - $_.accuracyPct, 2) }
    [PSCustomObject]@{
        scenario = $_.scenario
        accuracyPct = $_.accuracyPct
        deltaPositiveForTask = $delta
        dunyaToSiyaset = $_.dunyaToSiyaset
        genelToSiyaset = $_.genelToSiyaset
        exitCode = $_.exitCode
        logPath = $_.logPath
    }
}

$outJson = Join-Path $backend ("ablation-summary-{0}.json" -f $stamp)
$outCsv = Join-Path $backend ("ablation-summary-{0}.csv" -f $stamp)
$resultsWithDelta | ConvertTo-Json -Depth 4 | Out-File -FilePath $outJson -Encoding utf8
$resultsWithDelta | Export-Csv -Path $outCsv -NoTypeInformation -Encoding utf8

$resultsWithDelta | Format-Table -AutoSize | Out-String | Write-Output
Write-Output "SUMMARY_JSON=$outJson"
Write-Output "SUMMARY_CSV=$outCsv"
