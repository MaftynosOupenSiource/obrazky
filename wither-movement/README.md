# SmoothWither — Minecraft 1.20.4

**[Stáhnout plugin JAR](releases/1.0.0/SmoothWither-1.0.0.jar?raw=true)**
· [ZIP pro rozbalení do serveru](releases/1.0.0/SmoothWither-1.0.0.zip?raw=true)

Jednoduchý samostatný plugin pro **Paper/Purpur 1.20.4, Java 17+**.
Potlačuje nadbytečné aktualizace rychlosti při tiknutí Witheru, které mohou
přerušovat pohyb hráče. **Wither dál normálně ubírá životy**; efekt, absorpce
i běžné vyhodnocení smrti zůstávají součástí Minecraftu.

## Instalace

1. Vypni server.
2. Vlož `SmoothWither-1.0.0.jar` do `plugins/`.
3. Spusť server. Funguje automaticky pro všechny hráče.

Nevyžaduje resource pack, ProtocolLib ani další plugin. Funguje bez
příkazů a konfigurace. Poškození Witherem je vždy zachované.

## Rozsah změny

Wither v Minecraftu 1.20.4 nemá skutečný útočný knockback, ale jeho tiknutí
označuje hráče pro odeslání aktualizace rychlosti. Plugin potlačí pouze
takovou aktualizaci ve stejném nebo následujícím serverovém tiku, pokud stále
odpovídá přesně téže události poškození. Skutečný knockback,
jiné poškození a teleport mají ochranu proti
potlačení. Efekty jako Slowness a zásahy jiných pluginů se samostatně nemění.

Změny rychlosti od dřívějších posluchačů `PlayerVelocityEvent` se respektují.
Paper 1.20.4 ale nerozlišuje původ všech přímých volání `setVelocity`:
samostatný odraz od jiného pluginu bez damage/knockback události, který se
potká přesně s Wither tikem, může být také potlačen. U serverů s takovými
odrazovými plošinami je vhodné ověřit tuto konkrétní souhru.

Zachování poškození nevyužívá ruční odečítání zdraví, změny rychlosti chůze
ani přidávání doby nezranitelnosti. DamageNumbers a ostatní posluchači
nadále dostávají běžné události Wither poškození.

## Sestavení

```sh
mvn -B -ntp clean package
```

Výsledný JAR je v `target/`. Paper API poskytuje server; do JARu se nepřibaluje.
Pro vytvoření distribučního ZIPu použij `python3 tools/package_release.py`.

Postup živého testu: [tools/INTEGRATION.md](tools/INTEGRATION.md).
