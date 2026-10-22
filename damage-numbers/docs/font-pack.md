# Štětcový font pro damage numbers

Resource pack `dist/OrangeDamageNumbers-resource-pack.zip` obsahuje vlastní
bitmapový font **`orange_damage:numbers`** pro Minecraft **1.20.3–1.20.4**
(`pack_format: 22`). Nemění běžné písmo hry ani obrázky jiných pluginů.

Číslice používají mírně nakloněné ruční štětcové písmo **Permanent Marker**:
žluté horní odlesky přecházejí do syté oranžové, kolem je silný téměř černý
obrys a vpravo dole černý stín. Drobné řezy ve výplni připomínají opotřebený
štětec. Stejným stylem se vykresluje **MISS**.

Zdrojová textura má buňky **128 × 112 px**. Bitmapový font používá
`height: 16`, `ascent: 13`; vyšší rozlišení textury uchovává štětcové detaily.
Velikost ve světě upravuj měřítkem display entity v konfiguraci pluginu.
Podporované znaky jsou `0123456789.-MIS`. Pro správné barvy se text s tímto
fontem vykresluje bíle; barva, obrys i stín jsou součástí textury.

## Použití se serverovým resource packem

ZIP umísti na HTTPS adresu s přímým stažením a nastav jeho adresu a SHA-1 podle
hlavního README pluginu. SHA-1 v souboru
`dist/OrangeDamageNumbers-resource-pack.sha1` patří právě k vytvořenému ZIPu.
Po jakékoli úpravě nebo sloučení packu použij SHA-1 výsledného souboru.

Minecraft musí pack skutečně načíst. Bez něj klient vlastní štětcový font
neumí vykreslit; plugin může místo něj zobrazit standardní oranžové číslice.

## Sloučení s ItemsAdderem nebo existujícím packem

Do výsledného resource packu přidej celý adresář:

```text
assets/orange_damage/font/numbers.json
assets/orange_damage/textures/font/numbers.png
```

Jmenný prostor musí zůstat `orange_damage`, aby odpovídal fontu používanému
pluginem. **Nepřepisuj `assets/minecraft/font/default.json`** a do existujícího
packu nekopíruj `pack.mcmeta` z tohoto balíčku; ponech metadata svého celého
packu. U ItemsAdderu použij cestu pro vlastní raw assets podle verze své
instalace a ověř, že výsledný ZIP skutečně obsahuje oba uvedené soubory.

Ponech také `LICENSE-PermanentMarker.txt` a `FONT-NOTICE.txt` z našeho packu,
protože dodávají licenci a označení úprav použitého písma.

Pokud pack doručuje ItemsAdder místo tohoto pluginu, postupuj podle nastavení
ověření/aktivace vlastního fontu v hlavním README. Neposílej hráčům dvě různé
verze fontu ve stejném jmenném prostoru.

## Obnovení a kontrola výstupů

Z kořene projektu:

```sh
python3 -m pip install -r tools/requirements-font.txt
python3 tools/build_resource_pack.py
python3 -m unittest discover -s tools -p 'test_resource_pack.py' -v
```

Generátor načítá přibalený TTF a ověřuje jeho SHA-256. Síť potřebuje pouze
případná instalace Pillow. Se stejnou verzí Pillow a FreeType vytvoří stejné
vstupy bitově shodný ZIP. Náhled `dist/font-preview.png` slouží pouze k
prohlížení, nikoli jako textura fontu.

Písmo Permanent Marker pochází z Google Fonts a je distribuováno pod
**Apache License 2.0**. Zdrojový TTF i licence jsou v `tools/font/`; zdrojová
adresa a kontrolní součet jsou v `tools/font/README.md`.
