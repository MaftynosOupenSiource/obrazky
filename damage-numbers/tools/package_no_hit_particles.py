"""Build a narrowly scoped Minecraft1.20.4 damage-indicator override."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
ADDON_NAME = "OrangeDamageNumbers-no-hit-particles-ItemsAdder-1.0.0.zip"
PACK_NAME = "OrangeDamageNumbers-no-hit-particles-resource-pack.zip"
ADDON_PREFIX = "plugins/ItemsAdder/contents/orange_damage_effects/resourcepack/"


def transparent_png():
    """One valid, fully transparent RGBA pixel; an empty sprite list is not valid hiding."""
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\0\0\0\0\0"))
            + chunk(b"IEND", b""))


def assets():
    return {
        "assets/minecraft/particles/damage_indicator.json": (
            json.dumps({"textures": ["orange_damage_effects:invisible_hit"]}, indent=2) + "\n"
        ).encode("utf-8"),
        "assets/orange_damage_effects/textures/particle/invisible_hit.png": transparent_png(),
    }


INSTRUCTIONS = """SKRYTI VANILLA CASTIC PRI ZASAHU — Minecraft 1.20.4 / ItemsAdder

1. Rozbal slozku plugins z tohoto ZIPu do korene serveru.
2. Spust /iazip a nech klienty nacist novou verzi ItemsAdder resource packu.
   U externiho hostovani aktualizuj i ZIP na hostingu.
3. Over skutecnym zasahem, ze se hnedocervena srdicka damage_indicator nezobrazuji.

Pouzij sve jiz funkcni hostovani packu. ZIP pridava jen dva raw assety do
plugins/ItemsAdder/contents/orange_damage_effects/resourcepack/assets/.
Neobsahuje config ani JAR DamageNumbers a nemeni jeho cisla nebo font.

Jde o vizualni skryti castice minecraft:damage_indicator pruhlednou texturou.
Castice se stale vytvareji, klient je pouze nekresli viditelne. Jine castice,
zabarveni postavy pri zraneni, zvuky a kamera se timto balickem nemeni.
Efekt plati pro klienty, kteri aktualizovany pack skutecne nacetli.

Odebrani: smaz jen slozku ItemsAdder/contents/orange_damage_effects,
znovu spust /iazip a aktualizovany pack znovu nacti v klientech.
"""


def write_zip(destination, files):
    with ZipFile(destination, "w", ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            entry = ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, data)
    digest = hashlib.sha256(destination.read_bytes()).hexdigest()
    destination.with_name(destination.name + ".sha256").write_text(
        f"{digest}  {destination.name}\n", encoding="ascii")


def main():
    files = assets()
    source = ROOT / "resource-pack-no-hit-particles"
    pack_metadata = (json.dumps({"pack": {
        "pack_format": 22,
        "description": "Hide vanilla damage-indicator particles | Minecraft1.20.4",
    }}, indent=2) + "\n").encode("utf-8")
    for name, data in {**files, "pack.mcmeta": pack_metadata}.items():
        target = source / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    destination = ROOT / "dist"
    destination.mkdir(parents=True, exist_ok=True)
    write_zip(destination / ADDON_NAME, {
        **{ADDON_PREFIX + name: data for name, data in files.items()},
        "PRECTI-ME.txt": INSTRUCTIONS.encode("utf-8"),
    })
    write_zip(destination / PACK_NAME, {**files, "pack.mcmeta": pack_metadata})
    print(f"ItemsAdder add-on ready: {destination / ADDON_NAME}")
    print(f"Standalone resource pack ready: {destination / PACK_NAME}")


if __name__ == "__main__":
    main()
