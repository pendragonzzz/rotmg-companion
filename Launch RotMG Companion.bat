@echo off
title RotMG Companion
cd /d "%~dp0"

rem --- make sure Node/npm is available ---
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js / npm was not found.
  echo  Install Node.js from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

rem --- first-time dependency install ---
if not exist "node_modules" (
  echo  First-time setup: installing dependencies, please wait...
  call npm install || goto :error
)

rem --- build the per-class stat table if missing (needs internet once) ---
if not exist "src\shared\data\dungeon-drops.json" (
  echo  Building data from RealmEye ^(one-time, ~2 min^)...
  call npm run refresh || goto :error
)

echo  Launching RotMG Companion...
call npm run dev
goto :end

:error
echo.
echo  Something went wrong - see the messages above.
echo.
pause
exit /b 1

:end
