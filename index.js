import fs from "fs";
import pLimit from "p-limit";
import * as cheerio from "cheerio";
import ora, { oraPromise } from "ora";
import chalk from "chalk";
import readline from "readline";

const MAX_CONCURRENT_REQUESTS = 15; // NOTA: No és recomanable fer més de 15 peticions simultànies a la web de la FEEC. Això pot saturar la web i provocar més lentitud
const FEEC_API = "https://www.feec.cat/wp-admin/admin-ajax.php"; // URL de l'API de la FEEC
const ESSENCIAL_TEXT = "Cim essencial"; // Aquest text apareix a la web de la FEEC quan un cim és essencial
const OUTPUT_FILE = "muntanyesRepte100CimsFEEC.json"; // Nom del fitxer on es guardaran les dades

// Crear una interfície per a llegir la consola
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Escurçar el console.log per a un ús més fàcil
const log = console.log;

// Limitar el nombre de peticions simultànies a la web per obtenir informació extra de les muntanyes
const limit = pLimit(MAX_CONCURRENT_REQUESTS);

/**
 * Aquesta funció realitza una petició POST a l'API de la FEEC per obtenir la informació dels 100 cims
 *
 * @param {Number} pageNumber - Número de la pàgina de l'API que volem obtenir
 * @param {String} nonce - Aquesta cadena de text és un token de seguretat que s'utilitza per prevenir atacs CSRF
 * @returns {Promise<String>} - Retorna la resposta de l'API en format de text
 */
const getApiData = async (pageNumber, nonce) => {
  const response = await fetch(FEEC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `action=load_100cims&nonce=${nonce}&cims_query=cims_actius&current_page=${pageNumber}`,
  });
  return await response.text();
};

/**
 * Aquesta funció realitza una petició GET a la web de la FEEC per obtenir més informació d'una muntanya (Geolocalització, etc.)
 *
 * @param {String} url - URL de la muntanya de la FEEC
 * @returns {Promise<String>} - Retorna la resposta de la web en format de text
 */
const getMountainDataFromWebsite = async (url) => {
  const response = await fetch(url);
  return await response.text();
};

/**
 * Aquesta funció rep les dades de l'API de la FEEC i retorna un array amb la informació bàsica de les muntanyes
 *
 * @param {String} data - Dades de l'API de la FEEC
 * @returns {Array<Object>} - Retorna un array amb la informació de les muntanyes
 */
const parseMountainsFromAPI = (data) => {
  const $ = cheerio.load(data);

  const items = $(".item-100cims");
  if (!items.length) return [];

  return items
    .map((_, element) => {
      const url = $(element).attr("href");
      const image = $(element).find("img").attr("src");
      const name = $(element).find("h3").text();
      const height = $(element).find("h5").first().text();
      const region = $(element).find("h5").last().text();
      const essencial = $(element).find("strong").text() === ESSENCIAL_TEXT;

      return {
        id: url
          .split("/")
          .filter((segment) => segment)
          .pop(),
        url,
        image,
        name,
        height: +height.match(/\d+/)[0],
        region,
        essencial,
      };
    })
    .get();
};

/**
 * Aquesta funció obté el nonce de la web de la FEEC. Aquest nonce és necessari per fer peticions a l'API de la FEEC
 * @returns {Promise<String>} - Retorna el nonce de la web de la FEEC
 */
const getAPINonce = async () => {
  const response = await fetch("https://www.feec.cat/activitats/100-cims/");
  const data = await response.text();
  const $ = cheerio.load(data);
  const scriptContent = $("script")
    .filter((_, el) => $(el).html().includes("var ajaxcustom"))
    .html();
  const nonce = scriptContent.match(/"nonce":"([a-zA-Z0-9]+)"/)[1];
  return nonce;
};

/**
 * Aquesta funció rep les dades de la web de la FEEC i retorna la latitud i longitud de la muntanya
 * @param {String} data - Dades de la web de la FEEC
 * @returns {Object} - Retorna un objecte amb la latitud i longitud de la muntanya
 */
const parseMountainFromWebsite = (data) => {
  const $ = cheerio.load(data);

  const container = $(".row.no-gutters.fw-light.lh-1-2");

  const latitude = container
    .find('div:contains("Latitud:")')
    .next()
    .text()
    .trim()
    .replace("º", "");
  const longitude = container
    .find('div:contains("Longitud:")')
    .next()
    .text()
    .trim()
    .replace("º", "");

  return { latitude, longitude };
};

/**
 * Aquesta funció obté el nombre total de pàgines de l'API de la FEEC.
 * Aquest nombre de pàgines ens servirà per saber quantes pàgines hem de recórrer per obtenir totes les muntanyes
 *
 * @param {String} nonce - Aquesta cadena de text és un token de seguretat que s'utilitza per prevenir atacs CSRF
 * @returns {Promise<String>} - Retorna el nombre total de pàgines de l'API de la FEEC
 */
const getTotalPages = async (nonce) => {
  const data = await getApiData(1, nonce);
  const $ = cheerio.load(data);
  return $("a").last().attr("data-page");
};

/**
 * Aquesta funció rep el nonce de la web de la FEEC i el nombre total de pàgines de l'API de la FEEC.
 * Recorre totes les pàgines de l'API de la FEEC per obtenir la informació bàsica de totes les muntanyes
 *
 * @param {String} nonce - Aquesta cadena de text és un token de seguretat que s'utilitza per prevenir atacs CSRF
 * @param {Number} totalPages - Nombre total de pàgines de l'API de la FEEC
 * @returns {Promise<Array<Object>>} - Retorna un array amb la informació bàsica de les muntanyes
 */
const getBasicInfoMountain = async (nonce, totalPages) => {
  let pageNumber = 1;

  const requestToAPI = [];

  while (pageNumber <= totalPages) {
    // Push the request to the API to the stack of promises
    requestToAPI.push(getApiData(pageNumber, nonce));
    pageNumber++;
  }

  const responses = await Promise.all(requestToAPI);

  const basicMountain = responses
    .map((data) => parseMountainsFromAPI(data))
    .flat();

  return basicMountain;
};

/**
 * Aquesta funció rep les dades de les muntanyes i realitza una petició a la web de la FEEC per obtenir més informació de les muntanyes
 *
 * @param {Array<Object>} mountains - Dades de les muntanyes
 * @returns {Promise<Array<Object>>} - Retorna un array amb la informació de les muntanyes amb la informació extra
 */
const getExtraInfoMountain = async (mountains) => {
  const requestToWebsite = [];

  for (const mountain of mountains) {
    // Get the data from the website of the mountain
    requestToWebsite.push(
      limit(() => getMountainDataFromWebsite(mountain.url))
    );
  }

  const responses = await Promise.all(requestToWebsite);

  const mountainsDataTest = responses.map((data, index) => {
    const parsedMountainDetail = parseMountainFromWebsite(data);
    return { ...mountains[index], ...parsedMountainDetail };
  });

  return mountainsDataTest;
};

/**
 * Aquesta funció rep les dades de les muntanyes i les guarda en un fitxer JSON
 * @param {Array<Object>} data - Dades de les muntanyes
 * @returns {void}
 * @throws {Error} - Llança un error si no es pot guardar les dades en el fitxer JSON
 */
const saveDataToJSONFile = (data) => {
  fs.writeFile(OUTPUT_FILE, JSON.stringify(data), function (err) {
    if (err) throw err;
  });
};

/**
 * Aquesta funció envia un missatge per consola a l'usuari i espera una resposta
 *
 * @param {String} question - Se li fa una pregunta a l'usuari
 * @returns {Promise<String>} - Retorna la resposta de l'usuari
 */
const askQuestionToUser = (question) => {
  return new Promise((resolve) => rl.question(question, resolve));
};

/**
 * Aquesta funció comprova si l'usuari vol continuar amb l'execució de l'scraper
 * Si l'usuari no vol continuar, l'scraper s'atura
 * @returns {void}
 */
const checkIfUserWantsToContinue = async () => {
  const answer = await askQuestionToUser(
    "Vols continuar amb l'execució del scraper, sota la teva responsabilitat? (S/N) "
  );
  if (answer.toUpperCase() !== "S") {
    log(
      chalk.redBright(
        `Has decidit aturar l'execució. Si la vols tornar a executar, torna a executar!`
      )
    );
    process.exit(0);
  }
};

/**
 * Funció principal que executa el scraper, aquesta funció fa servir les funcions anteriors per obtenir les dades de les muntanyes.
 * un cop obtingudes les dades les guarda en un fitxer JSON
 *
 * @returns {void}
 */
const getMountains = async () => {
  try {
    log(
      chalk.greenBright(`
       /\\                                                         /\\
      /  \\      Benvingut, ets a punt d'obtenir les dades de     /  \\
     /    \\  les muntanyes del repte dels 100 cims de la FEEC!  /    \\
    /______\\___________________________________________________/______\\
    `)
    );

    log(
      chalk.redBright(
        `Si us plau, fes servir aquesta eina amb responsabilitat! Ja que pot saturar la web de la FEEC! \n`
      )
    );
    log(
      chalk.yellowBright(
        `El creador d'aquesta eina no es fa responsable de l'ús que se'n pugui fer! \n`
      )
    );

    // Preguntem a l'usuari si vol continuar amb l'execució de l'scraper
    await checkIfUserWantsToContinue();

    log(
      chalk.greenBright(
        `\nComencem a obtenir les dades de les muntanyes del repte dels 100 cims de la FEEC! \n`
      )
    );

    // Obtenir el nonce de l'API de la FEEC, aquest nonce és necessari per fer peticions
    const nonce = await oraPromise(getAPINonce(), {
      text: "Obtenint el nonce per a poder fer peticions a l'API de la FEEC...",
      successText: "Obtenir el nonce OK!",
      failText: "Alguna cosa ha anat malament en obtenir el nonce \n",
    });

    // Obtenir el nombre total de pàgines de l'API de la FEEC, això ens servirà per saber quantes pàgines hem de recórrer per obtenir totes les muntanyes
    const totalPages = await oraPromise(getTotalPages(nonce), {
      text: "Obtenint el nombre total de pàgines de l'API de la FEEC...",
      successText: "Obtenir el nombre total de pàgines de l'API OK!",
      failText:
        "Alguna cosa ha anat malament en obtenir el nombre total de pàgines \n",
    });

    // Obtenir la informació bàsica de totes les muntanyes
    const basicMountainsInfo = await oraPromise(
      getBasicInfoMountain(nonce, totalPages),
      {
        text: "Obtenint la informació bàsica de totes les muntanyes...",
        successText: "Informació bàsica de les muntanyes OK!",
        failText:
          "Alguna cosa ha anat malament en obtenir la informació bàsica de les muntanyes \n",
      }
    );

    log(
      chalk.green(
        `\nS'han obtingut les dades de ${basicMountainsInfo.length} muntanyes correctament! \n`
      )
    );

    log(
      chalk.yellowBright(
        `Pot ser que el següent pas trigui una bona estona, ja que s'han de fer moltes peticions. Relaxa't i pren-te un cafè! \n`
      )
    );

    // Obtenir la informació extra de totes les muntanyes
    const mountainsData = await oraPromise(
      getExtraInfoMountain(basicMountainsInfo),
      {
        text: "Obtenint la informació extra de totes les muntanyes...",
        successText: "Informació extra de les muntanyes OK!",
        failText:
          "Alguna cosa ha anat malament en obtenir la informació extra de les muntanyes \n",
      }
    );

    saveDataToJSONFile(mountainsData);

    // Guardar les dades en un fitxer JSON
    const spinner = ora(`Desant totes les dades en un fitxer JSON...`).start();
    saveDataToJSONFile(mountainsData);
    spinner.succeed(
      `Totes les dades s'han desat correctament. Pots consultar-les al fitxer ${OUTPUT_FILE}! \n`
    );

    log(
      chalk.greenBright(
        `Espero que aquesta eina t'hagi estat d'utilitat! Si tens algun dubte o suggeriment pots contactar amb mi a GitHub: @mcmontseny \n`
      )
    );

    log(chalk.greenBright(`Molta sort amb el repte dels 100 cims! \n`));
  } catch (error) {
    log(
      chalk.redBright(
        `Alguna cosa ha anat malament a l'execució de l'scraper! \n`
      )
    );
    console.error("Error:", error);
    log(
      chalk.redBright(
        `Si us plau, contacta amb el creador de l'eina a GitHub: @mcmontseny \n`
      )
    );
  }
};

/** Execució de la funció principal */
getMountains();
