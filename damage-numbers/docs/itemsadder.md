# ItemsAdder — rozbalit a spustit

[Stáhnout připravený ZIP](../releases/1.0.0/OrangeDamageNumbers-ItemsAdder-1.0.0.zip?raw=true)

Vyžaduje již nainstalovaný plugin OrangeDamageNumbers 1.0.0 a funkční
ItemsAdder na Minecraftu 1.20.4.

Pokud se místo fontu zobrazují bílé obdélníky, použij
[nastavení s potvrzeným načtením samostatného fontového packu](font-loading-fix.md).
To umožní ověřit font bez závislosti na sloučení a hostování ItemsAdderu.

1. Rozbal ZIP **do kořene serveru**, kde už je složka `plugins`.
2. Spusť `/iazip` a nech klienta načíst aktualizovaný ItemsAdder pack.
3. Spusť `/dn reload`.
4. Ověř `/dn test 12.5` a `/dn test 0`.

V balíčku je samostatný addon a přednastavený config DamageNumbers:

```text
plugins/
├── ItemsAdder/
│   └── contents/
│       └── orange_damage/
│           └── resourcepack/
│               └── assets/
│                   └── orange_damage/
│                       ├── font/numbers.json
│                       ├── textures/font/numbers.png
│                       ├── LICENSE-PermanentMarker.txt
│                       └── FONT-NOTICE.txt
└── OrangeDamageNumbers/
    └── config.yml
```

Přiložený `config.yml` zapíná `font.assume-installed: true` a ponechává
prázdné `resource-pack.url` a `sha1`: celý pack posílá ItemsAdder přes své
stávající hostování. ZIP neobsahuje plugin JAR ani konfiguraci ItemsAdderu.

**Pokud už máš vlastní nastavení DamageNumbers**, ponech si svůj config;
rozbal jen složku ItemsAdder a ve svém configu změň tyto tři hodnoty:

```yaml
font:
  assume-installed: true
resource-pack:
  url: ''
  sha1: ''
```

Potom načti nový pack a spusť `/dn reload`. Bez nového packu klient vlastní
font nemá, proto je potřeba jej po `/iazip` skutečně načíst.

Struktura raw assetů odpovídá [oficiálnímu návodu ItemsAdder pro slučování
packů](https://github.com/LoneDev6/Wiki-ItemsAdder/blob/master/adding-content/merge-resourcepacks.md).
Žádné `font_images` ani nové Unicode znaky se neregistrují: plugin přímo
používá vlastní Minecraft font `orange_damage:numbers`.

Balíček lze obnovit ze zdrojů příkazem:

```sh
python3 tools/package_itemsadder.py
```
