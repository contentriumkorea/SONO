@echo off
chcp 65001 >nul
cd /d "%~dp0"
if exist "release\win-unpacked\SONO.exe" (
  start "" "release\win-unpacked\SONO.exe"
  exit /b
)
set "SONO_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined SONO_NODE set "SONO_NODE=%%N"
if not defined SONO_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "SONO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined SONO_NODE (
  echo Node.js가 필요합니다. Node.js 설치 후 다시 실행해주세요.
  pause
  exit /b 1
)
if not exist "dist-electron\main.mjs" (
  "%SONO_NODE%" scripts\build.mjs
  if errorlevel 1 exit /b 1
)
"%SONO_NODE%" scripts\start.mjs
