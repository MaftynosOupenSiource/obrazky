#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 tools/build_resource_pack.py
python3 -m unittest discover -s tools -p 'test_resource_pack.py' -v
mvn -B -ntp clean verify "$@"
cp target/OrangeDamageNumbers-1.0.0.jar dist/OrangeDamageNumbers-1.0.0.jar
python3 tools/package_release.py
