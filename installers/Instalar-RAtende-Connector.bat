@echo off
setlocal

:: RAtende Connector -- instalador Windows (26/08/2026)
:: Escreve a politica ExtensionInstallForcelist do Chrome (e Edge, se
:: instalado) apontando pro update manifest hospedado -- o Chrome baixa e
:: instala a extensao sozinho, sem "Modo desenvolvedor" nem "Carregar sem
:: compactacao". Precisa rodar como Administrador (a politica fica em
:: HKLM, exige elevacao).

set EXT_ID=ndamceimnbinifibkmegcfhidgjamiaf
set UPDATE_URL=https://storage.googleapis.com/rangel-tech-ratende-connector/update_manifest.xml

:: Verifica elevacao; se nao for admin, relanca pedindo UAC.
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Pedindo permissao de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Instalando RAtende Connector no Google Chrome...
reg add "HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul
if %errorLevel% equ 0 (
    echo Chrome: OK
) else (
    echo Chrome: falhou ao escrever o registro
)

:: Bonus: Edge tambem entende o mesmo mecanismo (Chromium por baixo).
reg query "HKLM\SOFTWARE\Microsoft\Edge" >nul 2>&1
if %errorLevel% equ 0 (
    reg add "HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" /v 1 /t REG_SZ /d "%EXT_ID%;%UPDATE_URL%" /f >nul
    echo Edge: OK
)

echo.
echo Pronto! Feche e abra o Chrome de novo -- a extensao aparece sozinha
echo em alguns segundos (o Chrome baixa em segundo plano).
echo.
pause
