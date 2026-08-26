#!/usr/bin/env bash
# RAtende Connector -- instalador Linux (Debian/Ubuntu, 26/08/2026).
#
# Chrome no Linux le politicas gerenciadas de arquivos JSON em
# /etc/opt/chrome/policies/managed/ (ou /etc/chromium/policies/managed/
# pro Chromium puro) -- sem registro, sem certificado, mecanismo bem mais
# simples que o Windows. Mesma politica ExtensionInstallForcelist.

set -euo pipefail

EXT_ID="ndamceimnbinifibkmegcfhidgjamiaf"
UPDATE_URL="https://storage.googleapis.com/rangel-tech-ratende-connector/update_manifest.xml"

if [ "$(id -u)" -ne 0 ]; then
  echo "Precisa rodar como root (sudo ./instalar-ratende-connector.sh)."
  exit 1
fi

instalar_para() {
  local dir="$1"
  local nome="$2"
  if [ -d "$(dirname "$dir")" ] || command -v "$nome" >/dev/null 2>&1; then
    mkdir -p "$dir"
    cat > "$dir/ratende-connector.json" <<EOF
{
  "ExtensionInstallForcelist": ["${EXT_ID};${UPDATE_URL}"]
}
EOF
    echo "$nome: OK ($dir/ratende-connector.json)"
  fi
}

instalar_para /etc/opt/chrome/policies/managed "Google Chrome"
instalar_para /etc/chromium/policies/managed "Chromium"
instalar_para /etc/chromium-browser/policies/managed "Chromium (Ubuntu)"

echo
echo "Pronto! Feche e abra o navegador de novo -- a extensao aparece"
echo "sozinha em alguns segundos."
