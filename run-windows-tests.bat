@echo off
echo Testing Windows Internal Commands for LiteLLM
echo =============================================

echo.
echo Running PowerShell command tests...
powershell -ExecutionPolicy Bypass -File "test-windows-commands.ps1"

echo.
echo Running Jest unit tests (if available)...
if exist "node_modules\.bin\jest.cmd" (
    npm test -- --config=jest.config.windows-tests.js
) else (
    echo Jest not found. Install with: npm install --save-dev jest @types/jest ts-jest
)

echo.
echo Test complete! Check the output above for any failures.
pause
