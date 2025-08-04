# Test Internal Commands that LiteLLM uses
Write-Host "Testing LiteLLM Internal Commands on Windows" -ForegroundColor Cyan

# Test CPU Usage (as used in internal commands)
Write-Host "Test: CPU Usage" -ForegroundColor Yellow
try {
    $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
    Write-Host "Success: CPU Usage: $($cpu.Average)%" -ForegroundColor Green
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Memory Usage (as used in internal commands)
Write-Host "Test: Memory Usage" -ForegroundColor Yellow
try {
    $memory = Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json
    Write-Host "Success: Memory info retrieved" -ForegroundColor Green
    Write-Host $memory
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Process List (as used in internal commands)
Write-Host "Test: Process List" -ForegroundColor Yellow
try {
    $processes = Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name,Id,CPU,WorkingSet | Format-Table -AutoSize | Out-String
    Write-Host "Success: Process list retrieved" -ForegroundColor Green
    Write-Host $processes
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test Disk Information (as used in internal commands)
Write-Host "Test: Disk Information" -ForegroundColor Yellow
try {
    $disks = Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json
    Write-Host "Success: Disk info retrieved" -ForegroundColor Green
    Write-Host $disks
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test File Operations with Windows paths
Write-Host "Test: Windows File Paths" -ForegroundColor Yellow
$testDir = "C:\temp\littlellm-test"
$testFile = "$testDir\test.txt"

try {
    # Create directory
    if (!(Test-Path $testDir)) {
        New-Item -ItemType Directory -Path $testDir -Force | Out-Null
    }
    Write-Host "Success: Directory created/exists: $testDir" -ForegroundColor Green
    
    # Write file
    "Test content from LiteLLM" | Out-File -FilePath $testFile -Encoding UTF8
    Write-Host "Success: File written: $testFile" -ForegroundColor Green
    
    # Read file
    $content = Get-Content -Path $testFile -Raw
    Write-Host "Success: File read: $($content.Trim())" -ForegroundColor Green
    
    # Get file info
    $fileInfo = Get-Item -Path $testFile
    Write-Host "Success: File size: $($fileInfo.Length) bytes" -ForegroundColor Green
    
    # Clean up
    Remove-Item -Path $testFile -Force
    Remove-Item -Path $testDir -Force
    Write-Host "Success: Cleanup completed" -ForegroundColor Green
    
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test PowerShell command execution (as used by start_process)
Write-Host "Test: Command Execution" -ForegroundColor Yellow
try {
    $result = & powershell -Command "Get-Date | Select-Object DateTime | ConvertTo-Json"
    Write-Host "Success: Command executed" -ForegroundColor Green
    Write-Host $result
} catch {
    Write-Host "Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Internal Commands Test Complete!" -ForegroundColor Cyan
