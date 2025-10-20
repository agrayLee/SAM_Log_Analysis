@echo off
echo ===============================================
echo Node.js Environment Test - CMD vs PowerShell
echo ===============================================
echo.

echo Current directory: %CD%
echo Current shell: CMD (Batch)
echo.

echo [TEST 1] Direct node command in CMD:
node --version
echo Error level after node --version: %errorlevel%
echo.

echo [TEST 2] Using WHERE to find node:
where node
echo Error level after where node: %errorlevel%
echo.

echo [TEST 3] PATH environment variable:
echo PATH=%PATH%
echo.

echo [TEST 4] Specific node path test:
if exist "E:\nodejs\node.exe" (
    echo Found node at E:\nodejs\node.exe
    "E:\nodejs\node.exe" --version
    echo Error level: %errorlevel%
) else (
    echo E:\nodejs\node.exe not found
)
echo.

echo [TEST 5] Manual errorlevel test:
node --version >nul 2>&1
set NODE_TEST_RESULT=%errorlevel%
echo Manual errorlevel capture: %NODE_TEST_RESULT%

if %NODE_TEST_RESULT% equ 0 (
    echo Result: Node.js IS available in CMD
) else (
    echo Result: Node.js is NOT available in CMD
)
echo.

pause
