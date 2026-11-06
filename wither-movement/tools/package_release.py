"""Package SmoothWither for direct JAR download and server-folder extraction."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import shutil

ROOT = Path(__file__).resolve().parents[1]
NAME = "SmoothWither-1.0.0"


def main():
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    jar = ROOT / "target" / (NAME + ".jar")
    with ZipFile(jar) as built:
        if built.testzip() is not None:
            raise SystemExit("Invalid plugin archive")
        if "config.yml" in built.namelist():
            raise SystemExit("Expected the configuration-free plugin")
    shutil.copy2(jar, dist / jar.name)
    archive = dist / (NAME + ".zip")
    with ZipFile(archive, "w", ZIP_DEFLATED) as release:
        release.write(jar, "plugins/" + jar.name)
        release.write(ROOT / "README.md", "README.md")
        report = ROOT / "target/integration-results.json"
        if report.is_file():
            release.write(report, "validation/integration-results.json")
    for path in (dist / jar.name, archive):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        path.with_name(path.name + ".sha256").write_text(f"{digest}  {path.name}\n", encoding="ascii")
    print(f"Release ready: {archive}")


if __name__ == "__main__":
    main()
