"""Package a confirmed-load configuration for the existing 1.0.0 plugin."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib

ROOT = Path(__file__).resolve().parents[1]
NAME = "OrangeDamageNumbers-font-loading-fix-1.0.0.zip"
URL = (
    "https://raw.githubusercontent.com/MaftynosOupenSiource/obrazky/"
    "c525a7eb7113c22673e3c60298b548d33c20dda5/"
    "damage-numbers/releases/1.0.0/OrangeDamageNumbers-resource-pack.zip"
)
SHA1 = "40f68175beec7e3b0738a9691c7332ef6a866e09"

INSTRUCTIONS = """ORANGE DAMAGE NUMBERS — OPRAVA NACITANI FONTU — 1.20.4

Pro již nainstalovaný OrangeDamageNumbers 1.0.0. JAR se nemění.

1. Rozbal složku plugins ze ZIPu do kořene serveru.
2. Spusť /dn reload přímo ve hře a přijmi nabídnutý fontový resource pack.
3. Po dokončení načítání zkus /dn test 12.5 a /dn test 0.
   Pokud se nabídka neukáže, použij /dn pack.

Tento ZIP nahrazuje plugins/OrangeDamageNumbers/config.yml výchozím nastavením
s opraveným načítáním fontu. Vlastní další změny svého configu si ponech.
ItemsAdder se nemění: plugin přidá malý samostatný fontový pack k dosavadním
serverovým packům. Obsahuje pouze náš namespace orange_damage a licenci.

Vlastní font se zapne až poté, co klient potvrdí úspěšné načtení právě tohoto
packu. Při odmítnutí nebo chybě plugin používá normální oranžové číslice.
font.assume-installed je false — předchozí ItemsAdder ZIP nastavil true,
což mohlo zobrazit chybějící znaky, když klient font ve skutečnosti neměl.

Pokud nechceš přepsat svůj config, uprav pouze následující hodnoty:
font:
  assume-installed: false
resource-pack:
  url: '""" + URL + """'
  sha1: '""" + SHA1 + """'
  required: false

Při novém připojení se pack nabídne automaticky. Pokud pozdější reload jiného
pluginu tento doplňkový pack odebere, požádej o něj znovu přes /dn pack.

Tohle řeší doručení fontu samostatným doplňkem. Původní důvod, proč font nebyl
dostupný z ItemsAdderu, bez jeho výsledného generated.zip určit nelze.
"""


def main():
    source_pack = ROOT / "releases/1.0.0/OrangeDamageNumbers-resource-pack.zip"
    if hashlib.sha1(source_pack.read_bytes()).hexdigest() != SHA1:
        raise SystemExit("Pinned resource pack checksum mismatch")
    config = (ROOT / "src/main/resources/config.yml").read_text(encoding="utf-8")
    for old, new in (("url: ''", f"url: '{URL}'"), ("sha1: ''", f"sha1: '{SHA1}'")):
        if config.count(old) != 1:
            raise SystemExit("Expected exactly one default configuration value: " + old)
        config = config.replace(old, new, 1)
    files = {
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
    print(f"Confirmed-load configuration ready: {destination}")
    print(f"SHA-256: {digest}")


if __name__ == "__main__":
    main()
