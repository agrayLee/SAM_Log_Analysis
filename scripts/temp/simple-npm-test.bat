@echo off
echo Starting npm test...
echo.

echo [Step 1] Direct npm call:
npm --version
echo Step 1 completed, error level: %errorlevel%
echo.

echo [Step 2] npm with redirection:
npm --version >nul 2>&1
echo Step 2 completed, error level: %errorlevel%
echo.

echo [Step 3] npm with if statement:
npm --version >nul 2>&1
if not errorlevel 1 (
    echo npm check passed
) else (
    echo npm check failed
)
echo Step 3 completed
echo.

echo [Step 4] Alternative npm check:
call npm --version >nul 2>&1
echo Step 4 completed, error level: %errorlevel%
echo.

echo If you see this, the script completed normally
pause
