@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org/ adresinden LTS surumunu kur.
  echo Kurulumdan sonra bu dosyayi tekrar ac.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<20)process.exit(1)"
if errorlevel 1 (
  echo Node.js 20 veya daha yeni bir surum gerekli. LTS surumunu kur.
  pause
  exit /b 1
)
set "HOST=localhost"
set "PORT=3000"
set "OPEN_BROWSER=1"
echo Panel baslatiliyor. Tarayici otomatik acilacak.
echo Bu pencereyi kapatirsan yerel sunucu durur.
node scripts\launch.js
if errorlevel 1 pause
endlocal
