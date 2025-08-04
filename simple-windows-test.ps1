# Simple Windows Commands Test for LiteLLM
Write-Host "Testing Windows Internal Commands for LiteLLM" -ForegroundColor Cyan

# Test 1: Basic PowerShell functionality
Write-Host "Test 1: Get Current Date" -ForegroundColor Yellow
try {
    $date = Get-Date
    Write-Host "Success: $date" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Directory listing
Write-Host "Test 2: List Directory" -ForegroundColor Yellow
try {
    $files = Get-ChildItem -Path . | Select-Object -First 3 Name
    Write-Host "Success: Found $($files.Count) items" -ForegroundColor Green
    $files | Format-Table
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: System Information
Write-Host "Test 3: System Info" -ForegroundColor Yellow
try {
    $sysInfo = Get-ComputerInfo | Select-Object WindowsProductName
    Write-Host "Success: $($sysInfo.WindowsProductName)" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Process List
Write-Host "Test 4: Process List" -ForegroundColor Yellow
try {
    $processes = Get-Process | Select-Object -First 3 Name, Id
    Write-Host "Success: Found $($processes.Count) processes" -ForegroundColor Green
    $processes | Format-Table
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: File Operations
Write-Host "Test 5: File Operations" -ForegroundColor Yellow
$testFile = "test-file.txt"
try {
    "Hello Windows" | Out-File -FilePath $testFile
    $content = Get-Content -Path $testFile
    Write-Host "Success: File content: $content" -ForegroundColor Green
    Remove-Item -Path $testFile -Force
    Write-Host "Success: File deleted" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Windows Commands Test Complete!" -ForegroundColor Cyan
