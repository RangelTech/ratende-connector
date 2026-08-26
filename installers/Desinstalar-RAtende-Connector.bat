@echo off
setlocal

reg delete "HKCU\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /f >nul 2>&1
reg delete "HKCU\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /f >nul 2>&1
echo RAtende Connector removido. Feche e abra o navegador de novo.
pause
