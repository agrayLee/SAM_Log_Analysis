@echo off
echo Testing npm call methods...
echo.

echo [Method 1] Direct npm call (problematic):
npm --version
echo This line should not appear if npm terminates the script
echo.

echo [Method 2] Using CALL npm (correct):
call npm --version
echo This line should appear - Method 2 completed
echo.

echo [Method 3] Using CALL with redirection:
call npm --version >nul 2>&1
echo Method 3 completed, error level: %errorlevel%
echo.

echo Script completed successfully!
pause
