# eco 6.76.2 a EcoPets 2.75.1 – oprava a optimalizace

Oprava vychází ze spark profilu `BQ7p73zF1f` a přímo z dodaných JARů. Výsledky jsou náhrady původních pluginů, žádný další opravný plugin není potřeba.

## Instalace

1. Vypni server.
2. Nahraď původní JAR eco souborem `eco-6.76.2-dreamland-fix1.jar` a původní EcoPets souborem `EcoPets-2.75.1-dreamland-fix1.jar`. V `plugins` ponech pouze jednu kopii každého pluginu.
3. Spusť server znovu. Použij úplný restart, nikoliv PlugMan reload.

Stávající konfigurace a data pluginů se použijí dál. Upstream čísla verzí v `plugin.yml` zůstávají 6.76.2 a 2.75.1 kvůli kompatibilitě kontrol verzí. Tato sestavení poznáš podle názvu souboru a `META-INF/dreamland-eco-compat.json` uvnitř JARu.

## Potvrzený zásek v eco

Při úderu hráče do železného golema libreforge spustil `damage_multiplier`. eco vyhodnocovalo argument `multiplier` přes asynchronní Caffeine cache a synchronně čekalo na výsledek pomocí `CompletableFuture.join`. Ve vzorcích profilu toto čekání zabralo přibližně **2700 ms**, tedy **91,1 % zachyceného času** hlavního vlákna.

Záznam používá filtr dlouhých ticků a zahrnuje jeden tick; nejde o 91,1 % průběžné zátěže za celých přibližně 16,5 minuty. Profil neobsahuje pracovní vlákno, takže neurčuje, co přesně pracovní výpočet zdržovalo. EventCore se v problematickém řetězci volání nevyskytuje.

Oprava vyhodnocuje chybějící hodnotu na volajícím vlákně, bez nuceného předání do společného pracovního poolu a čekání na něj. Výpočet také neprobíhá pod zámkem mapování cache: jiné vlákno s rozpracovaným stejným klíčem tak nezablokuje hlavní vlákno tímto mechanismem. Současná chybějící hodnota může být vypočtena více volajícími. Původní klíče cache, konfigurační TTL, rychlá cesta čísel a odmítání neplatných výsledků jsou zachovány.

Tato změna odstraňuje prokázaný mechanismus čekání. Sama o sobě nezrychlí libovolný pomalý externí placeholder; případné další záseky je potřeba zachytit s pracovními vlákny pomocí `/spark profiler start --thread * --timeout 120`.

## Další nalezená zbytečná práce v EcoPets

`PetDisplay.getLocation` pro každého peta procházel společnou mapu časů aktualizace všech petů. Při N sledovaných petech mohl tento úklid provést přibližně N² kontrol za tick. Kotlin `filterValues` navíc vytvářel dočasnou mapu odstraněných položek.

Úklid teď probíhá jednou na konci aktualizace zobrazení a odstraňuje položky přímo iterátorem: jeden lineární průchod za tick bez dočasné filtrované mapy. Samotný výpočet pozice, názvy, rotace a interval aktualizací jsou zachované. Po dlouhé pauze může přesun úklidu změnit jednorázové použití staršího vyhlazení pozice; neovlivňuje efekty petů. Spark tuto zobrazovací práci nezachytil jako příčinu daného záseku – jde o samostatnou optimalizaci nalezenou při kontrole zdrojů.

## Jak spolu pluginy souvisejí

Dodaný EcoPets obsahuje `libreforge-4.76.1-shadow.jar`. Loader jej rozbalí a načte jako plugin libreforge, který nad eco vykonává efekty. Výchozí konfigurace `tiger.yml` i `sea_serpent.yml` používají `damage_multiplier` se vzorcem `%level% * 0.01 + 1`. Jsou tedy možnými poskytovateli efektu ze sparku; samotný profil konkrétního peta neidentifikuje. Přibalený libreforge v opraveném EcoPets zůstává původní.

## Ověření

**15 behaviorálních testů** nad skutečnými zabalenými třídami na Java 21 s `-Xverify:all`:

- výpočet na volajícím vlákně a dokončení i při obsazených dvou vláknech common poolu;
- neblokující současný výpočet stejného klíče;
- číselná rychlá cesta, reuse cache, TTL včetně nuly, oddělení výrazů a kontextů;
- null, NaN, nekonečno, záporné a nulové výsledky, zotavení po chybě poskytovatele;
- absence sdíleného průchodu při 128 jednotlivých aktualizacích polohy;
- jediný úklid za tick, úklid bez online hráčů, přesná hranice expirace 5000 ms;
- zachování výpočtu vyhlazené polohy.

Testy nahrazují pouze konstrukci `EcoPlugin` a jeho konfigurace jednoduchými testovacími objekty. Kontext, číselný parser, evaluator interface, Caffeine a ostatní potřebné třídy jsou z dodaných JARů. Testovací objekty se nebalí do výsledných pluginů. Kompletní běh na produkčním Minecraft serveru zde nebyl proveden.

Sestavení používá Kotlin 2.1.0, JVM target 17 a dodané JARy se zachováním všech původních prostředků a ostatních tříd. Skript ověřuje vstupní SHA-256, CRC a obsah každé položky archivu. Mění jedinou třídu v eco a `PetDisplay` včetně jeho dvou generovaných vnitřních tříd v EcoPets; přidává pouze popis sestavení. Původní prostředky včetně přítomných licenčních souborů jsou zachovány. MIT licence zdrojů eco je přiložena v `licenses/eco-LICENSE.md`.

```bash
python3 build.py --eco /cesta/eco-original.jar --pets /cesta/EcoPets-original.jar --api /cesta/spigot-api-1.20.4.jar
```

Kompilátor a závislosti se stáhnou z Maven Central s kontrolou SHA-256 podle `compiler-dependencies.json`. Volitelné `--deps` a `--out` mění adresáře závislostí a výsledků. Skript záměrně přijímá jen přesné dodané vstupní binární soubory. Jde o neoficiální opravená sestavení projektů Auxilor.
