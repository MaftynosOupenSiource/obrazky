# Blackjack 2.3.23: kontrola peněz a opožděných vstupů

Sestava pro Minecraft 1.20.4, Java 17+. Kontrola zahrnuje všechny cesty pluginu pro stržení, DOUBLE, vrácení a výplatu peněz, změny kol, odchod a vypnutí. Ve výsledném JARu prošlo 192 automatických testů s JVM verifikací a kontrolou odkazů na Spigot API 1.20.4. Neproběhlo připojení skutečného Minecraft klienta ani konkrétního serverového economy pluginu.

## Nalezené problémy a opravy

| Situace | Oprava |
| --- | --- |
| DOUBLE nezohlednil neúspěšný výběr peněz. | Přídavná sázka se potvrdí pouze po úspěšném stržení. Bez potvrzení se nepřidá karta ani vyšší vyplatitelná sázka. DOUBLE může projít jednou. |
| Odchod po odkrytí dealera nebo před verdiktem vracel sázku. | Sázka je závazná od rozdání. Odchod, sesednutí i odpojení ji ukončí bez refundace a bez pozdější výplaty. |
| Vypnutí animace měnilo starý příznak hry a mohlo zpřístupnit refundaci. | Refundace se řídí evidencí sázek. Vypnutí vrací pouze potvrzené sázky před rozdáním; rozdáné sázky propadají. |
| `/start` po zrušení dealerovy úlohy mohl znovu otevřít staré sázky. | Stav kola je nezávislý na starém příznaku `gameInProgress`. Rozehrané kolo nelze změnit zpět na výběr sázek. |
| Výplata mazala sázku až po připsání peněz. | Nárok se zabere před voláním ekonomiky. Opakovaný verdikt ani odchod při připsání nemohou použít stejný nárok znovu. |
| Selhání refundace obnovovalo původní mapu sázky a dovolovalo další pokusy. | Nejasný převod zůstává zablokovaný. Neprovádí se automatický další výběr, výplata ani refundace. |
| Staré nebo změněné hodnoty v kompatibilní mapě mohly být považované za zaplacenou sázku. | Jedinou autoritou je evidence podle UUID hráče, UUID kola a UUID sázky. Kompatibilní mapa je pouze zobrazení. |
| Opakované příkazy nebo další objekt hráče se stejným UUID. | Jedno UUID smí mít jedno sezení a jednu neuzavřenou sázku. Každá akce ověřuje aktuální sezení, fázi, tah a nárok. |
| Ekonomický plugin může během převodu vyvolat další událost. | Finanční operace chrání stav proti opětovnému vstupu. Odchody a úklid se dokončí po návratu z převodu. Neplatné dodatečné sázky se nepřipojí k novému kolu. |
| Staré naplánované úlohy mohly změnit další kolo nebo zrušit novou animaci. | Dealer i výběr sázek používají jednorázové značky úloh a identitu kola. Starý callback je neplatný. |
| Klik čekající ve frontě mohl potvrdit jiné menu nebo STAND místo sázky. | Vstup je svázaný se sezením, revizí kola/tahu, typem menu a vybranou možností. Při změně se zahodí. |
| Záplava pohybových packetů mohla plnit frontu úloh. | Na hráče čeká nejvýše jeden klik a jedna sloučená pohybová úloha. Čekající vstupy mají omezené stáří; neplatné číselné hodnoty a enumy se odmítají. |

## Pravidla peněz

Základní sázky jsou pouze 50 000, 250 000, 500 000, 1 000 000 a 2 500 000. Po DOUBLE je celková sázka nejvýše 5 000 000. Výpočty používají kontrolované celočíselné operace. Výhra vrací 2× sázku, přirozený blackjack 2,5×, remíza 1× a prohra 0. Peníze se nemohou vyplatit jen na základě částky poslané klientem nebo změněné kompatibilní mapy.

Výplatu smí zahájit pouze aktuální dealerova úloha pro právě vyhodnocovaného hráče. Každou sázku lze uzavřít jednou: výplatou, refundací před rozdáním, nebo propadnutím po rozdání. Výsledky a podklady statistik se uloží před případnými událostmi vyvolanými ekonomikou.

Příkazy se ověřují na hlavním serverovém vlákně. Zavření klientského menu není důkaz zaplacení ani důvod k vrácení peněz. Toto ovládání používá subtitle, action bar a zobrazovací entity; nevytváří inventář se skutečnými kartami nebo peněžními předměty, které by šlo vybrat přes save-menu mod.

## Zápis na disk a nejasné platby

Soubor `plugins/Blackjack/money-journal.log` obsahuje identifikátory sázek, hráčů a kol, stav operace a částku. Záměr převodu se zapíše a vynutí na disk před voláním ekonomiky, výsledek po návratu. Soubor má pořadová čísla, kontrolní součty a výhradní souborový zámek. Porucha zápisu nebo poškozený záznam zastaví další finanční operace.

Vault nemá společnou transakci s tímto souborem ani identifikátor pro bezpečné opakování převodu. Pokud ekonomika peníze připíše a potom vrátí chybu, nebo server spadne mezi převodem a dokončením záznamu, není bezpečné převod automaticky opakovat. Taková sázka zůstane označená `FROZEN`; stejné UUID nemůže založit další sázku. Do logu se vypíše požadavek na kontrolu správcem. Také potvrzené předherní sázky nalezené po nečistém restartu zůstávají k ručnímu ověření. Přerušené již rozdáné sázky se nikdy nepřevádějí na refundace.

Při nejasném výsledku porovnej konkrétní UUID, ticket, operaci a částku s historií ekonomického pluginu. Zálohuj záznamy a ekonomická data společně. Journal nemaž ani neobnovuj samostatně ze starší zálohy: odstranil bys informaci o již zpracovaných nebo nejasných platbách. Tato verze záměrně neposkytuje hráčský příkaz pro opakování nebo odblokování nejasného převodu.

## Co lze rozpoznat u delay-packet modů

Klik, který už server přijal a zůstal ve frontě přes změnu menu, tahu nebo kola, se zahodí. Staré sezení po odchodu nebo opětovném připojení také neplatí. Testy zahrnují opakované verdikty, staré callbacky i změnu volby před zpracováním kliknutí.

Vanilla packet s kliknutím neobsahuje číslo tohoto blackjackového kola. Pokud ho klient celou dobu drží u sebe a pošle ho poprvé až v pozdější platné fázi, server nemůže spolehlivě určit původní okamžik jeho vytvoření. Proto každé přijaté kliknutí pouze žádá o aktuální serverem ověřenou akci; nevytváří peníze ani nárok na starou výplatu. Žádná tato kontrola nepředstavuje univerzální záruku proti všem chybám cizího ekonomického pluginu nebo jiných pluginů serveru.

## Natočení stolu

Nový stůl vytvořený přes `/createtable` se natočí podle pohledu hráče do nejbližší ze čtyř světových stran. Otáčí se celý stůl, židle a jejich hitboxy, karty, hologramy i kamera. Směr je uložený v `table-rotation-data.<svět>.<souřadnice>`. Staré stoly si zachovají původní směr. Jiný směr pohledu neumožní vytvořit další stůl na stejném místě.

## Statistiky a reload ve verzi 2.3.21

Při zapnutí se načítá `stats.yml` do živých statistik. Po vyhodnocení se statistiky ukládají pomocí dočasného souboru a atomického nahrazení; předchozí soubor je zálohovaný jako `stats.yml.bak`. Příkazy a placeholdery čtou živé hodnoty. Zápis statistik neprovádí žádný převod peněz, neopakuje výplatu a jeho selhání neobnovuje nárok na již zpracovanou sázku. Při vypnutí vyvolaném uvnitř finančního callbacku se závěrečné uložení dokončí až po jeho návratu.

## Paketová cedule ve verzi 2.3.22

Příkazy `setcedule` a `delcedule` vyžadují `blackjack.admin`. Model používá pouze odchozí zobrazovací pakety a nepřidává žádné inventáře, serverové entity ani nároky na výplatu. Ostatní příkazy Blackjacku jsou předávány původní obsluze. Zobrazení se omezuje na hráče ve stejném světě do 50 bloků; při odchodu, přesunu, nahrazení a vypnutí se odstraňuje.

## Natočení a měřítko cedule ve verzi 2.3.23

Příkaz podporuje volitelné měřítko 0.1–10. Neplatné, nekonečné nebo záporné hodnoty se odmítají před změnou existující cedule. Natočení i jeho desetinná část a měřítko se ukládají do konfigurace. Výpočty zobrazovacích transformací používají přesný úhel; finanční cesty se nemění.
