# NEEDFIXES.md Validation Script (PowerShell)
# This script validates the NEEDFIXES.md document for markdown compliance and working links

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "🔍 Validating NEEDFIXES.md..." -ForegroundColor Cyan

# Check if required files exist
if (-not (Test-Path "NEEDFIXES.md")) {
    Write-Host "❌ NEEDFIXES.md not found!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".markdownlint.json")) {
    Write-Host "❌ .markdownlint.json not found!" -ForegroundColor Red
    exit 1
}

try {
    # Run markdown linting
    Write-Host "📝 Running markdown linter..." -ForegroundColor Yellow
    $lintResult = & npx markdownlint-cli NEEDFIXES.md --config .markdownlint.json 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Markdown linting passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Markdown linting failed" -ForegroundColor Red
        Write-Host $lintResult -ForegroundColor Red
        exit 1
    }

    # Check links
    Write-Host "🔗 Checking links..." -ForegroundColor Yellow
    $linkResult = & npx markdown-link-check NEEDFIXES.md 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Link checking passed" -ForegroundColor Green
    } else {
        Write-Host "❌ Link checking failed" -ForegroundColor Red
        Write-Host $linkResult -ForegroundColor Red
        exit 1
    }

    # Verify key sections exist
    Write-Host "📄 Verifying document structure..." -ForegroundColor Yellow
    $content = Get-Content "NEEDFIXES.md" -Raw
    
    if ($content -match "## 0️⃣ Executive Summary") {
        Write-Host "✅ Executive Summary section found" -ForegroundColor Green
    } else {
        Write-Host "❌ Executive Summary section missing" -ForegroundColor Red
        exit 1
    }

    if ($content -match "## Next Steps Checklist for Maintainers") {
        Write-Host "✅ Next Steps section found" -ForegroundColor Green
    } else {
        Write-Host "❌ Next Steps section missing" -ForegroundColor Red
        exit 1
    }

    if ($content -match "Expected Impact Summary") {
        Write-Host "✅ Expected Impact Summary found" -ForegroundColor Green
    } else {
        Write-Host "❌ Expected Impact Summary missing" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "🎉 NEEDFIXES.md validation completed successfully!" -ForegroundColor Green
    Write-Host "📊 Document is ready for team review and CI pipeline integration." -ForegroundColor Green
    
} catch {
    Write-Host "❌ Validation failed with error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
