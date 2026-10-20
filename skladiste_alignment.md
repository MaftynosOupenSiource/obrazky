# Zarovnání SKLADIŠTĚ v PlayerVaults a ItemsAdder

Soubor `skladiste_gui_176x112.png` má přesně **176 × 112 px** a **54 slotů (9 sloupců × 6 řad)**. Neobsahuje nadpis: všech šest řad potřebuje 108 px výšky, takže uvnitř takto vysokého obrázku není místo na běžnou horní lištu. Obrázek a jeho souřadnice byly ověřeny; nasazení na konkrétním Minecraft serveru zatím ověřeno nebylo.

## Přesná geometrie

Souřadnice jsou v logických pixelech GUI při měřítku obrázku 1:1. Pro sloupec `c = 0…8` a řadu `r = 0…5`:

| Prvek | Souřadnice v PNG | Rozměr |
| --- | --- | --- |
| Celý slot včetně okraje | `x = 7 + 18c`, `y = 2 + 18r` | 18 × 18 px |
| Prostor pro item | `x = 8 + 18c`, `y = 3 + 18r` | 16 × 16 px |

Celá mřížka zabírá `x = 7…168`, `y = 2…109`. Po stranách je 7 px rámečku, nahoře a dole 2 px. Podrobné souřadnice jsou v [skladiste_slot_layout.json](skladiste_slot_layout.json).

Standardní chest menu v Minecraftu umisťuje itemy na `x = 8 + 18c`, `y = 18 + 18r`, vzhledem k levému hornímu rohu menu. Aby kresba seděla na tyto pozice, musí levý horní roh našeho obrázku ve výsledném vykreslení být na **GUI-relative `(0, +15)`**:

```text
item v PNG       = (8 + 18c,  3 + 18r)
pozice PNG v GUI = (0,       15)
item v GUI       = (8 + 18c, 18 + 18r)
```

**`+15` označuje výslednou polohu obrázku vůči menu; není to automaticky hodnota `y_position`, fontového ascentu ani jiného pole ItemsAdder.** Číselnou hodnotu takového pole je nutné ověřit podle konkrétní verze ItemsAdder a použitého způsobu vykreslení. Celý panel potom pokrývá GUI `y = 15…126`; jeho poslední dva řádky zasahují do oblasti oddělovače hráčova inventáře. I tuto hranu je potřeba zkontrolovat ve hře.

## Oprava pro dodané nastavení

Dodané nastavení bylo `scale_ratio: 107`, `y_position: -5` a titulek `:offset_4:&f爩`. Při výšce 107 se textura zmenší na přibližně 168,14 × 107 px a rozteč slotů na 17,20 px. Přidaný vodorovný posun 4 px vysvětluje, proč se prostředek téměř trefil, zatímco krajní sloty se rozcházely.

Pro původní PNG 176 × 112 px použij v jeho stávající sekci ItemsAdder:

```yaml
y_position: -2
scale_ratio: 112
```

V dodaném formátu titulku ponech:

```text
&f爩
```

Odstraň pouze `:offset_4:`. Znak `` (U+F808) i znak obrázku `爩` zůstávají. Výpočet počítá s obvyklým posunem −8 px pro ``: začátek titulku `8 − 8 = 0`. Po opravě měřítka posun 4 px navíc už není potřeba.

Svislá hodnota −2 vychází ze standardního bitmapového fontu: začátek titulku 6 px + základní účaří 7 px − ascent (−2 px) = horní okraj obrázku 15 px. Změna z −5 na −2 tedy zvedne obrázek o 3 logické pixely. Tento výpočet předpokládá, že ItemsAdder předá `y_position` jako bitmapový `ascent`; ve vygenerovaném font provideru má být `height: 112` a `ascent: -2`. Výsledek na uživatelově serveru zatím nebyl potvrzen novým náhledem.

Po úpravě znovu vygeneruj resource pack přes `/iazip`, načti jeho novou verzi v klientu a znovu otevři sklad. Kontroluj první i poslední slot; samotné překopírování PNG bez aktualizace fontu nezmění vykreslované měřítko.

## Praktické nastavení a kalibrace

1. Importuj **originál 176 × 112 px**, nikoli zvětšený náhled, jako obrázkový znak do svého ItemsAdder resource packu. Nastav výslednou vykreslenou velikost na 176 × 112 **logických GUI pixelů**. Konkrétní oprava dodaného nastavení je uvedena výše; u jiného fontu nebo způsobu vykreslení ověř skutečnou velikost a ascent ve vygenerovaném resource packu.
2. Použij skutečný Unicode znak, který ItemsAdder obrázku přiřadí. Identifikátor obrázku a jeho skutečný Unicode znak nejsou zaměnitelné. Znak nevymýšlej: musí odpovídat vygenerovanému resource packu.
3. V titulku menu zachovej **bílou barvu** obrázkového znaku, aby barva titulku netónovala celou texturu. Před obrázek nevkládej další viditelný nadpis. Potřebný posun vlož jako skutečný posunový znak podporovaný instalovaným fontem/pluginem.
4. Výsledný levý okraj obrázku musí být přesně na levém okraji menu, tedy `GUI x = 0`. Běžný vanilla titulek začíná 8 px od levého okraje; pokud se obrázek vykresluje právě z tohoto textového začátku, je potřeba skutečný horizontální posun **−8 px**. Ověř jeho provedení v použitém pluginu; nevkládej neověřený textový placeholder.
5. Svislé umístění zkalibruj tak, aby horní okraj obrázku ležel na **GUI y = 15**. Neměň kvůli tomu PNG ani rozteč slotů. Zkontroluj první slot i poslední řadu: item slotu 0 má začínat na `(8,18)` a item slotu 53 na `(152,108)` vzhledem k menu.
6. Otevři šestiřadý vault s načteným resource packem a porovnej rámečky s pozicí skutečných itemů a zvýrazněním slotu při najetí myší. Stejná odchylka všech slotů znamená posun obrázku; odchylka rostoucí po řadách/sloupcích znamená nesprávnou velikost vykreslení. Při vyšším nastavení Minecraft GUI Scale budou logické pixely na screenshotu násobně větší — to samo o sobě není chyba.

## Titulek v PlayerVaults

V ověřeném zdrojovém kódu PlayerVaultsX (tag 4.3.3 a současná větev uvedená níže) se titulek načítá z **`plugins/PlayerVaults/lang.conf`**, klíč **`translations.vaultTitle`**. Jde o konfiguraci HOCON, nikoli o YAML. Titulek zpracovává MiniMessage a potom jej předává Bukkit inventáři.

V této cestě není doložena expanze obrázků ItemsAdder ve tvaru `:namespace:id:` ani volání `PlaceholderAPI.setPlaceholders`. Proto se na takovou expanzi v PlayerVaults nespoléhej. Pro tento způsob použij skutečný Unicode znak obrázku a případný skutečný posunový znak.

Tvar hodnoty může být například následující; slova uvnitř nejsou funkční placeholder a musí být nahrazena skutečnými přiřazenými znaky:

```hocon
translations {
  vaultTitle = "<white>SKUTECNY_POSUNOVY_ZNAK_SKUTECNY_ZNAK_OBRAZKU"
}
```

Před úpravou uchovej vlastní konfiguraci. Pokud máš jiný fork nebo starší verzi PlayerVaults, ověř jeho skutečný soubor a klíč; výše uvedená cesta není potvrzením tvé běžící instalace.

## Zdroje a stav ověření

- [Oficiální dokumentace ItemsAdder](https://itemsadder.devs.beer/) a [GUI dokumentace](https://itemsadder.devs.beer/plugin-usage/adding-content/guis): přímé načtení bylo v tomto prostředí zablokované proxy. Oprava uvedená výše vychází z dodaného nastavení, screenshotů a standardních souřadnic bitmapového fontu; není potvrzením konkrétního nastavení na běžícím serveru.
- [Původní PlayerVaults README s odkazem na PlayerVaultsX](https://github.com/drtshock/PlayerVaults/blob/master/README.md).
- [PlayerVaultsX: načítání konfigurace a getVaultTitle](https://github.com/KittehDev/PlayerVaultsX/blob/6446db7dcc7ad71c80e1bb564d97f88e3919047c/src/main/java/com/drtshock/playervaults/PlayerVaults.java), zejména řádky 494 a 692–694.
- [PlayerVaultsX: Translation.java — vaultTitle a MiniMessage](https://github.com/KittehDev/PlayerVaultsX/blob/6446db7dcc7ad71c80e1bb564d97f88e3919047c/src/main/java/com/drtshock/playervaults/config/file/Translation.java), zejména řádky 100–126 a 221.
- [PlayerVaultsX: Loader.java — názvy polí konfigurace](https://github.com/KittehDev/PlayerVaultsX/blob/6446db7dcc7ad71c80e1bb564d97f88e3919047c/src/main/java/com/drtshock/playervaults/config/Loader.java), zejména řádky 115–118.

Souřadnice a rozměry obrázku jsou ověřené. **Pixelově přesné zarovnání v živém menu lze potvrdit až po ověření skutečného vykreslovacího posunu a velikosti na serveru.**
