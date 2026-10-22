#!/bin/sh
set -eu
cd "$(dirname "$0")"
mvn -B -ntp clean package "$@"
python3 tools/package_release.py
