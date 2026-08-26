#!/bin/sh
# RAtende Connector -- desinstalador macOS, 26/08/2026.
set -e

defaults delete com.google.Chrome ExtensionInstallForcelist 2>/dev/null || true

echo "RAtende Connector removido. Feche e abra o Chrome de novo."
