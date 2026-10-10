@echo off
setlocal
set "STL_APP_ROOT=%~dp0"
powershell.exe -NoProfile -Command "$shell=New-Object -ComObject WScript.Shell; $desktop=[Environment]::GetFolderPath('Desktop'); $shortcut=$shell.CreateShortcut((Join-Path $desktop 'STL Atolyesi.lnk')); $shortcut.TargetPath=Join-Path $env:STL_APP_ROOT 'windows-start.cmd'; $shortcut.WorkingDirectory=$env:STL_APP_ROOT; $shortcut.WindowStyle=7; $shortcut.Description='STL Atolyesi - yerel magaza calisma alani'; $shortcut.Save()"
if errorlevel 1 (
  echo Kisayol olusturulamadi. windows-start.cmd dosyasini kullanabilirsin.
) else (
  echo Masaustune STL Atolyesi kisayolu eklendi.
  echo Uygulama kucultulmus pencerede calisir; bilgisayar kapaliyken takip yapmaz.
)
pause
