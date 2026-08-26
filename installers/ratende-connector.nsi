; RAtende Connector -- instalador Windows (NSIS), 26/08/2026.
; Escreve a politica ExtensionInstallForcelist do Chrome/Edge apontando pro
; update manifest hospedado -- o navegador baixa e instala a extensao
; sozinho, sem "Modo desenvolvedor" nem "Carregar sem compactacao".
; Sem certificado de assinatura de codigo ainda (bloqueio real, precisa de
; compra numa CA) -- Defender/SmartScreen pode alertar ate isso ser resolvido.
; Politica em HKCU (usuario atual) -- sem UAC, sem admin. Vale so pro
; usuario que instalou, nao pra maquina toda.

!define EXT_ID "ndamceimnbinifibkmegcfhidgjamiaf"
!define UPDATE_URL "https://storage.googleapis.com/rangel-tech-ratende-connector/update_manifest.xml"

RequestExecutionLevel user
Name "RAtende Connector"
OutFile "RAtende-Connector-Instalador.exe"
InstallDir "$LOCALAPPDATA\RAtende Connector"
ShowInstDetails show
ShowUninstDetails show

!include "MUI2.nsh"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Section "Instalar"
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  DetailPrint "Instalando politica do Google Chrome..."
  WriteRegStr HKCU "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" "1" "${EXT_ID};${UPDATE_URL}"

  ; Edge tambem entende o mesmo mecanismo (Chromium por baixo) -- so escreve
  ; se o Edge estiver instalado, pra nao criar chave orfa a toa.
  IfFileExists "$PROGRAMFILES\Microsoft\Edge\Application\msedge.exe" 0 +2
    WriteRegStr HKCU "SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" "1" "${EXT_ID};${UPDATE_URL}"
  IfFileExists "$PROGRAMFILES32\Microsoft\Edge\Application\msedge.exe" 0 +2
    WriteRegStr HKCU "SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" "1" "${EXT_ID};${UPDATE_URL}"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RAtendeConnector" "DisplayName" "RAtende Connector"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RAtendeConnector" "UninstallString" "$INSTDIR\Desinstalar.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RAtendeConnector" "Publisher" "Rangel Tech"

  DetailPrint "Pronto! Feche e abra o Chrome de novo -- a extensao aparece sozinha em alguns segundos."
SectionEnd

Section "Uninstall"
  DeleteRegValue HKCU "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" "1"
  DeleteRegValue HKCU "SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist" "1"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\RAtendeConnector"
  Delete "$INSTDIR\Desinstalar.exe"
  RMDir "$INSTDIR"
SectionEnd
