"""Build a ready-to-extract ItemsAdder add-on for the existing 1.0.0 plugin."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib

ROOT = Path(__file__).resolve().parents[1]
NAME = "OrangeDamageNumbers-ItemsAdder-1.0.0.zip"
PREFIX = "plugins/ItemsAdder/contents/orange_damage/resourcepack/assets/orange_damage/"

INSTRUCTIONS = """ORANGE DAMAGE NUMBERS — ITEMSADDER — Minecraft 1.20.4

Vyžaduje už nainstalovaný OrangeDamageNumbers 1.0.0 a funkční ItemsAdder.

1. Rozbal obsah tohoto ZIPu do kořene serveru: tam, kde je složka plugins.
   Výsledná cesta má být:
   plugins/ItemsAdder/contents/orange_damage/resourcepack/assets/orange_damage/font/numbers.json
   ZIP samotný se do plugins nekopíruje; rozbalí se jeho obsah.
2. Spusť /iazip a nech klienta načíst aktualizovaný ItemsAdder resource pack.
   Použij své stávající hostování ItemsAdder packu, žádnou novou adresu nenastavuj.
3. Spusť /dn reload.
4. Zkus /dn test 12.5 a /dn test 0 (MISS).

Balíček obsahuje i přednastavený plugins/OrangeDamageNumbers/config.yml.
Při rozbalení může nahradit tvoji dosavadní konfiguraci DamageNumbers.
Jestli už máš vlastní nastavení, ponech svůj config a změň v něm pouze:
  font.assume-installed: true
  resource-pack.url: ''
  resource-pack.sha1: ''
Pak spusť /dn reload. Samotný plugin JAR se tímto ZIPem nemění.

Konfigurace ItemsAdderu ani jeho ostatní obsah se nenahrazují.
Font je samostatný orange_damage:numbers; běžné písmo Minecraftu se nemění.
Žádný pack.mcmeta nebo assets/minecraft/font/default.json se nepřepisuje.
Oranžové číslice a MISS budou fungovat po načtení sloučeného packu klientem.
Font Permanent Marker má licenci Apache 2.0; licence je přiložena v jeho namespace.

Ověřená struktura podle oficiální dokumentace ItemsAdder:
https://github.com/LoneDev6/Wiki-ItemsAdder/blob/master/adding-content/merge-resourcepacks.md
"""


def build():
    config = (ROOT / "src/main/resources/config.yml").read_text(encoding="utf-8")
    if config.count("assume-installed: false") != 1:
        raise SystemExit("Expected one known font setting in the default plugin configuration")
    config = config.replace("assume-installed: false", "assume-installed: true", 1)
    files = {
        PREFIX + "font/numbers.json": (ROOT / "resource-pack/assets/orange_damage/font/numbers.json").read_bytes(),
        PREFIX + "textures/font/numbers.png": (ROOT / "resource-pack/assets/orange_damage/textures/font/numbers.png").read_bytes(),
        PREFIX + "LICENSE-PermanentMarker.txt": (ROOT / "resource-pack/LICENSE-PermanentMarker.txt").read_bytes(),
        PREFIX + "FONT-NOTICE.txt": (ROOT / "resource-pack/FONT-NOTICE.txt").read_bytes(),
        "plugins/OrangeDamageNumbers/config.yml": config.encode("utf-8"),
        "PRECTI-ME.txt": INSTRUCTIONS.encode("utf-8"),
    }
    destination = ROOT / "dist" / NAME
    destination.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(destination, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            entry = ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, data)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_name(NAME + ".sha256").write_text(f"{digest}  {NAME}\n", encoding="ascii")
    print(f"ItemsAdder add-on ready: {destination}")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    build()
