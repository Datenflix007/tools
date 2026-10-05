@echo off
setlocal

set "PORT=8765"
set "ROOT=%~dp0..\..\.."
set "WALL_URL=http://127.0.0.1:%PORT%/src/modules/regie/index(1).html"

pushd "%ROOT%" >nul 2>nul
if errorlevel 1 (
  echo Konnte Repository-Root nicht finden: %ROOT%
  pause
  exit /b 1
)

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_CMD=py -3"
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_CMD=python"
  ) else (
    echo Python wurde nicht gefunden. Installiere Python oder starte einen HTTP-Server manuell:
    echo python -m http.server %PORT% --bind 127.0.0.1
    popd >nul
    pause
    exit /b 1
  )
)

echo Starte lokale Regie Wall auf %WALL_URL%
echo Dieses Fenster schliessen, um den lokalen Server zu stoppen.

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%WALL_URL%' -TimeoutSec 2; if ($r.Content -match 'REGIE WALL') { exit 0 } else { exit 2 } } catch { exit 1 }"
set "SERVER_CHECK=%errorlevel%"
if "%SERVER_CHECK%"=="0" (
  echo Lokale Regie Wall laeuft bereits auf Port %PORT%.
  start "" "%WALL_URL%"
  popd >nul
  exit /b 0
)
if "%SERVER_CHECK%"=="2" (
  echo Port %PORT% ist bereits belegt, aber nicht durch diese Regie Wall.
  echo Bitte den anderen Dienst stoppen oder den PORT im Script anpassen.
  popd >nul
  pause
  exit /b 1
)

start "Regie Wall Local Server" cmd /k "%PYTHON_CMD% -m http.server %PORT% --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "%WALL_URL%"

popd >nul
