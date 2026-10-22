"""Package the built plugin, resource pack and installation notes for distribution."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
FILES = {
    "OrangeDamageNumbers-1.0.0.jar": DIST / "OrangeDamageNumbers-1.0.0.jar",
    "OrangeDamageNumbers-resource-pack.zip": DIST / "OrangeDamageNumbers-resource-pack.zip",
    "OrangeDamageNumbers-resource-pack.sha1": DIST / "OrangeDamageNumbers-resource-pack.sha1",
    "font-preview.png": DIST / "font-preview.png",
    "README.md": ROOT / "README.md",
    "docs/font-pack.md": ROOT / "docs/font-pack.md",
    "config.example.yml": ROOT / "src/main/resources/config.yml",
}

def main():
    archive = DIST / "OrangeDamageNumbers-1.0.0.zip"
    for path in FILES.values():
        if not path.is_file():
            raise SystemExit(f"Required release file missing: {path}")
    with ZipFile(archive, "w", ZIP_DEFLATED) as release:
        for name, path in FILES.items():
            content = path.read_bytes()
            if name == "README.md":
                content = (content.decode("utf-8").replace("dist/", "")
                           .replace("src/main/resources/config.yml", "config.example.yml")
                           .encode("utf-8"))
            release.writestr(name, content)
        report = ROOT / "target/integration-results.json"
        if report.is_file():
            release.writestr("validation/integration-results.json", report.read_bytes())
    for filename in ("OrangeDamageNumbers-1.0.0.jar", archive.name):
        path = DIST / filename
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        (DIST / (filename + ".sha256")).write_text(f"{digest}  {filename}\n", encoding="ascii")
    print(f"Release ready: {archive}")

if __name__ == "__main__":
    main()
