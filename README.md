# ⛰️ Scraper 100 Cims FEEC

Aquest projecte és una eina per obtenir dades de les muntanyes que formen part del repte dels 100 cims de la FEEC (Federació d'Entitats Excursionistes de Catalunya). Pot ser útil per a usuaris que vulguin crear el seu mapa interactiu o una pàgina web amb el seu progrés del repte.

## 📋 Descripció

Aquest script fa servir diverses biblioteques de Node.js per fer peticions a l'API de la FEEC i obtenir informació detallada sobre les muntanyes que formen part del repte. Les dades obtingudes es guarden en un fitxer JSON.

## 🛠️ Requeriments

- Node.js (v12 o superior)
- npm (v6 o superior)

## 📦 Instal·lació

1. Clona aquest repositori:

   ```bash
   git clone https://github.com/mcmontseny/scraper-100-cims-feec.git
   ```

2. Navega al directori del projecte:

   ```bash
   cd scraper-100-cims-feec
   ```

3. Instal·la les dependències:

   ```bash
   npm install
   ```

## 🚀 Ús

Executa l'script amb la següent comanda:

```bash
npm start
```

Aquesta comanda iniciarà el procés d'obtenció de dades de les muntanyes. Se't demanarà confirmació per continuar amb l'execució de l'scraper. Assegura't de fer servir aquesta eina amb responsabilitat per no saturar la web de la FEEC.

## 📊 Resultats

Les dades obtingudes es guardaran en un fitxer anomenat `muntanyesRepte100CimsFEEC.json` dins del directori del projecte.

## 📚 Biblioteques Utilitzades

- [chalk](https://www.npmjs.com/package/chalk)
- [cheerio](https://www.npmjs.com/package/cheerio)
- [ora](https://www.npmjs.com/package/ora)
- [p-limit](https://www.npmjs.com/package/p-limit)

## 🤝 Contribucions

Les contribucions són benvingudes! Si tens alguna millora o correcció, si us plau, fes un fork d'aquest repositori, crea una branca amb els teus canvis i fes un pull request.

## 📝 Llicència

Aquest projecte està llicenciat sota la llicència ISC.

## ⚠️ Advertència

Fes servir aquesta eina amb responsabilitat per no saturar la web de la FEEC. El creador d'aquesta eina no es fa responsable de l'ús que se'n pugui fer.

## 🙏 Acknowledgments

Gràcies a la Federació d'Entitats Excursionistes de Catalunya (FEEC) per la seva tasca en la promoció de l'excursionisme i el coneixement del territori català.
