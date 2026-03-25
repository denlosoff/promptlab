@echo off
set "SOURCE=C:\Users\ADMIN\Toggle\backups\promptlab-data-backup_2026-03-25_16-15-08.json"
set "DEST=C:\Users\ADMIN\Toggle\promptlab-data (10).json"

if not exist "%SOURCE%" (
  echo Backup not found:
  echo %SOURCE%
  pause
  exit /b 1
)

copy /Y "%SOURCE%" "%DEST%"

if errorlevel 1 (
  echo Restore failed.
  pause
  exit /b 1
)

echo Backup restored to:
echo %DEST%
echo.
echo Restarting site...
powershell -ExecutionPolicy Bypass -File "C:\Users\ADMIN\Toggle\promptlab-v1.8.1\restart-site.ps1"
