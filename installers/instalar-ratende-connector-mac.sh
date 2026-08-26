#!/bin/sh
# RAtende Connector -- instalador macOS, 26/08/2026.
# Mesmo mecanismo dos outros SOs: escreve a politica ExtensionInstallForcelist
# do Chrome apontando pro update manifest hospedado -- o Chrome baixa e
# instala a extensao sozinho, sem "Modo desenvolvedor". No macOS a politica
# fica no dominio de preferencias do usuario (com.google.Chrome), sem sudo --
# mesmo espirito do HKCU no Windows: vale so pra quem instalou, nao pra
# maquina toda.
set -e

EXT_ID="ndamceimnbinifibkmegcfhidgjamiaf"
UPDATE_URL="https://storage.googleapis.com/rangel-tech-ratende-connector/update_manifest.xml"
ENTRADA="${EXT_ID};${UPDATE_URL}"

JA_TEM=$(defaults read com.google.Chrome ExtensionInstallForcelist 2>/dev/null | grep -F "$ENTRADA" || true)
if [ -n "$JA_TEM" ]; then
  echo "RAtende Connector ja estava na politica do Chrome."
else
  defaults write com.google.Chrome ExtensionInstallForcelist -array-add "$ENTRADA"
  echo "Chrome: OK"
fi

echo ""
echo "Pronto! Feche e abra o Chrome de novo -- a extensao aparece sozinha"
echo "em alguns segundos (o Chrome baixa em segundo plano)."
