# Bílé obdélníky místo čísel — ověřené načtení fontu

[Stáhnout připravené nastavení](../releases/1.0.0/OrangeDamageNumbers-font-loading-fix-1.0.0.zip?raw=true)

Předchozí ItemsAdder ZIP nastavoval `font.assume-installed: true`. Tím plugin
používal vlastní font i pro klienty, kteří jej ve skutečnosti nemuseli mít.
To může způsobit chybějící znaky. Samotná definice fontu a jeho textura byly
ověřeny původním bitmapovým loaderem Minecraftu 1.20.4: všech 15 znaků prošlo.
Bez výsledného ItemsAdder packu nelze potvrdit příčinu jeho nedoručení.

Připravený opravný ZIP používá již dostupnou funkci pluginu 1.0.0:
`font.assume-installed: false` a samostatný malý fontový pack s přesnou
adresou a SHA-1. Odesílá jej přes `Player.addResourcePack`, takže přidává
fontový doplněk k ostatním packům. Obsahuje vlastní namespace a licence,
nikoli modely nebo textury ItemsAdderu.

1. Rozbal složku `plugins` ze ZIPu do kořene serveru.
2. Ve hře spusť `/dn reload` a přijmi nabídnutý pack. Nabídku lze zopakovat
   přes `/dn pack`.
3. Po dokončení načtení otestuj `/dn test 12.5` a `/dn test 0`.

ZIP nahrazuje config DamageNumbers výchozími hodnotami s novým doručováním
packu. Pokud si chceš zachovat vlastní nastavení, změň ve svém configu pouze:

```yaml
font:
  assume-installed: false
resource-pack:
  url: 'https://raw.githubusercontent.com/MaftynosOupenSiource/obrazky/c525a7eb7113c22673e3c60298b548d33c20dda5/damage-numbers/releases/1.0.0/OrangeDamageNumbers-resource-pack.zip'
  sha1: '40f68175beec7e3b0738a9691c7332ef6a866e09'
  required: false
```

Vlastní font se začne používat až po klientském `SUCCESSFULLY_LOADED` se
správným UUID packu. Samotné přijetí nabídky, stažení souboru nebo úspěšné
načtení jiného packu nestačí. Při odmítnutí, chybě nebo odebrání našeho packu
se používá běžný oranžový text. Pokud jiný plugin později při reloadu packů
tento doplněk odebere, nabídni jej znovu přes `/dn pack`.

Jde o alternativní doručení fontu, které nevyžaduje sloučení do ItemsAdderu.
Pro diagnostiku původního sloučení je stále potřeba zkontrolovat
`plugins/ItemsAdder/output/generated.zip` a případné chyby v klientském logu.

Obnovení opravného ZIPu ze zdrojů: `python3 tools/package_font_fix.py`.
