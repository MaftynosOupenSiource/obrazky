# Skrytí srdíček při zásahu

[Stáhnout doplněk pro ItemsAdder](../releases/1.0.0/OrangeDamageNumbers-no-hit-particles-ItemsAdder-1.0.0.zip?raw=true)

1. Rozbal složku `plugins` ze ZIPu **do kořene serveru**.
2. Spusť `/iazip` a nech klienta načíst aktualizovaný ItemsAdder pack.
   Pokud používáš externí hostování, aktualizuj i hostovaný ZIP.
3. Ověř skutečným zásahem, že se hnědočervená srdíčka nezobrazují.

Doplněk přidává pouze:

```text
plugins/ItemsAdder/contents/orange_damage_effects/resourcepack/
└── assets/
    ├── minecraft/particles/damage_indicator.json
    └── orange_damage_effects/textures/particle/invisible_hit.png
```

JAR, konfigurace DamageNumbers a jeho font se nemění. Doplněk můžeš používat
i spolu se samostatným fontovým packem: ten tuto částici nepřepisuje.

Přesměruje se pouze sprite částice `minecraft:damage_indicator` na platné
průhledné PNG. Je to vizuální skrytí pro klienty s načteným packem; server
částice nadále vytváří. Kritické zásahy, léčení, zvuky, červené zabarvení
zasažené entity a pohyb kamery používají jiné mechanismy a zůstávají.

Definice částice a pravidla atlasu byly ověřeny v původním Minecraftu
1.20.4. Prázdný seznam `textures` by zobrazil chybějící texturu; používá se
proto skutečný průhledný RGBA sprite o velikosti 1 × 1 px.

Odebrání: smaž jen `ItemsAdder/contents/orange_damage_effects`, znovu spusť
`/iazip` a načti aktualizovaný pack v klientech.

Pro ruční sloučení nebo místní načtení v klientu je dostupný také
[samostatný resource pack](../releases/1.0.0/OrangeDamageNumbers-no-hit-particles-resource-pack.zip?raw=true).

Obnovení obou ZIPů ze zdrojů:

```sh
python3 tools/package_no_hit_particles.py
```
