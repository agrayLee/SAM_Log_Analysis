@echo off
echo ===============================================
echo Node.js Environment Debug Tool
echo ===============================================
echo.

echo Current directory: %CD%
echo Current user: %USERNAME%
echo Computer name: %COMPUTERNAME%
echo.

echo Testing Node.js availability...
echo.

echo [Test 1] Direct node command:
node --version
set NODE_RESULT=%errorlevel%
echo Error level after node --version: %NODE_RESULT%
echo.

echo [Test 2] Node command with output redirection:
node --version >nul 2>&1
set NODE_REDIRECT_RESULT=%errorlevel%
echo Error level after node --version with redirection: %NODE_REDIRECT_RESULT%
echo.

echo [Test 3] Which node executable:
where node
set WHERE_RESULT=%errorlevel%
echo Error level after where node: %WHERE_RESULT%
echo.

echo [Test 4] PATH environment check:
echo PATH=%PATH%
echo.

echo [Test 5] Testing errorlevel logic:
if %NODE_REDIRECT_RESULT% geq 1 (
    echo Node.js appears NOT INSTALLED according to errorlevel check
) else (
    echo Node.js appears INSTALLED according to errorlevel check
)
echo.

echo [Test 6] Alternative error checking:
node --version >temp_output.txt 2>&1
if exist temp_output.txt (
    echo Temp file created successfully
    type temp_output.txt
    del temp_output.txt
) else (
    echo Failed to create temp file
)
echo.

pause
