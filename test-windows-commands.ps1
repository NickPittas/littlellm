# Windows Internal Commands Test Script
# Run this PowerShell script to verify that the commands used by LiteLLM work properly

Write-Host "🔧 Testing Windows Internal Commands for LiteLLM" -ForegroundColor Cyan
Write-Host "=" * 50

# Test 1: Basic PowerShell functionality
Write-Host "`n📅 Test 1: Get Current Date and Time" -ForegroundColor Yellow
try {
    $date = Get-Date
    Write-Host "✅ Success: $date" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Directory listing
Write-Host "`n📁 Test 2: List Directory Contents" -ForegroundColor Yellow
try {
    $files = Get-ChildItem -Path . | Select-Object -First 5 Name, Length
    Write-Host "✅ Success: Found $($files.Count) items" -ForegroundColor Green
    $files | Format-Table -AutoSize
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: System Information
Write-Host "`n💻 Test 3: Get System Information" -ForegroundColor Yellow
try {
    $sysInfo = Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, TotalPhysicalMemory
    Write-Host "✅ Success: Retrieved system information" -ForegroundColor Green
    $sysInfo | Format-List
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 4: Process List
Write-Host "`n🔄 Test 4: List Running Processes" -ForegroundColor Yellow
try {
    $processes = Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, Id, CPU, WorkingSet
    Write-Host "✅ Success: Found $($processes.Count) top processes" -ForegroundColor Green
    $processes | Format-Table -AutoSize
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: CPU Usage
Write-Host "`n📊 Test 5: Get CPU Usage" -ForegroundColor Yellow
try {
    $cpu = Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average
    Write-Host "✅ Success: CPU Usage: $($cpu.Average)%" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Memory Usage
Write-Host "`n🧠 Test 6: Get Memory Usage" -ForegroundColor Yellow
try {
    $memory = Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
    $totalGB = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
    $freeGB = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
    $usedGB = $totalGB - $freeGB
    Write-Host "✅ Success: Memory - Total: ${totalGB}GB, Used: ${usedGB}GB, Free: ${freeGB}GB" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 7: File Operations
Write-Host "`n📄 Test 7: File Operations" -ForegroundColor Yellow
$testFile = "test-littlellm.txt"
$testContent = "Hello from LiteLLM Windows test!`nThis is a test file created by PowerShell."

try {
    # Write file
    $testContent | Out-File -FilePath $testFile -Encoding UTF8
    Write-Host "✅ File created successfully" -ForegroundColor Green
    
    # Read file
    $content = Get-Content -Path $testFile -Raw
    Write-Host "✅ File read successfully: $($content.Length) characters" -ForegroundColor Green
    
    # Get file info
    $fileInfo = Get-Item -Path $testFile
    Write-Host "✅ File info: Size: $($fileInfo.Length) bytes, Modified: $($fileInfo.LastWriteTime)" -ForegroundColor Green
    
    # Delete file
    Remove-Item -Path $testFile -Force
    Write-Host "✅ File deleted successfully" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 8: Directory Operations
Write-Host "`n📂 Test 8: Directory Operations" -ForegroundColor Yellow
$testDir = "test-littlellm-dir"

try {
    # Create directory
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null
    Write-Host "✅ Directory created successfully" -ForegroundColor Green
    
    # List directory
    $dirContents = Get-ChildItem -Path $testDir
    Write-Host "✅ Directory listed: $($dirContents.Count) items" -ForegroundColor Green
    
    # Remove directory
    Remove-Item -Path $testDir -Recurse -Force
    Write-Host "✅ Directory removed successfully" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 9: Environment Variables
Write-Host "`n🌍 Test 9: Environment Variables" -ForegroundColor Yellow
try {
    $userProfile = $env:USERPROFILE
    $computerName = $env:COMPUTERNAME
    $osVersion = $env:OS
    Write-Host "✅ Success: User Profile: $userProfile" -ForegroundColor Green
    Write-Host "✅ Success: Computer Name: $computerName" -ForegroundColor Green
    Write-Host "✅ Success: OS: $osVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 10: Disk Information
Write-Host "`n💾 Test 10: Disk Information" -ForegroundColor Yellow
try {
    $disks = Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID, Size, FreeSpace
    Write-Host "✅ Success: Found $($disks.Count) disk(s)" -ForegroundColor Green
    foreach ($disk in $disks) {
        $sizeGB = [math]::Round($disk.Size / 1GB, 2)
        $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
        Write-Host "  Drive $($disk.DeviceID) - Total: ${sizeGB}GB, Free: ${freeGB}GB" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎉 Windows Internal Commands Test Complete!" -ForegroundColor Cyan
Write-Host "=" * 50

# Test PowerShell execution policy
Write-Host "`n🔒 PowerShell Execution Policy Check" -ForegroundColor Yellow
try {
    $policy = Get-ExecutionPolicy
    Write-Host "✅ Current Execution Policy: $policy" -ForegroundColor Green
    if ($policy -eq "Restricted") {
        Write-Host "⚠️  Warning: Execution policy is Restricted. This may prevent some commands from working." -ForegroundColor Yellow
        Write-Host "   Consider running: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to check execution policy: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nIf all tests passed, the Windows internal commands should work properly in LiteLLM!" -ForegroundColor Green
