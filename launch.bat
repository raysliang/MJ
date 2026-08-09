@echo off
setlocal

cd /d "%~dp0"
call npm run build
if errorlevel 1 (
	echo Failed to build the Mahjong simulator.
	exit /b 1
)

start "" "%~dp0index.html"

echo Mahjong simulator built and opened from %~dp0index.html

endlocal