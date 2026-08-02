import express from "express";
import Papa from "papaparse";
import fs from "fs";

const app = express();
const port = 3000;

const formats = {
  classic: {
    topcardsPath: "./data/topcards-classic.csv",
    orangeCardsPath: "./data/orange-classic.csv",
    period: "2026.06.15 - 2026.08.02."
  },
  tm: {
    topcardsPath: "./data/topcards-tm.csv",
    orangeCardsPath: "./data/orange-tm.csv",
    period: "2026.06.15 - 2026.07.26."
  }
};

const SUBTYPE_TYPES = [
  "alakváltó",
  "angyal",
  "burástya",
  "chara-din fattya",
  "csontváz",
  "cápa",
  "dinó",
  "elementál",
  "elf",
  "ember",
  "fókuszkristály",
  "főnix",
  "ganüid",
  "gnóm",
  "goblin",
  "gólem",
  "hajó",
  "hideg",
  "kalóz",
  "kobudera",
  "krabber",
  "kísértet",
  "manó",
  "minotaurusz",
  "moa",
  "morf",
  "motyogó",
  "mutáns",
  "orgling",
  "ork",
  "pegazus",
  "polip",
  "pók",
  "quwarg",
  "reakció",
  "sav",
  "szirén",
  "sárkány",
  "teknős",
  "termik",
  "thargodan",
  "triklem drakolder",
  "troll",
  "törpe",
  "tűz",
  "varkaudar",
  "villám",
  "vámpír",
  "vízió",
  "womath",
  "xenó",
  "yeti",
  "árnymanó",
  "éjfatty",
  "óriás"

];

const ICON_TYPES = [
  "ereklye",
  "horgony",
  "háló",
  "köd",
  "legendás",
  "oltalom: 0",
  "oltalom: 1",
  "oltalom: 2",
  "reakció drágítás",
  "repül",
  "védekezés",
  "élőholt",
  "ősmágia"

];

app.get("/api/format-info", (req, res) => {
  const format = getRequestedFormat(req);

  res.json({
    period: formats[format].period
  });
});

const formatData = {
  classic: {
    cards: [],
    orangeCards: []
  },
  tm: {
    cards: [],
    orangeCards: []
  }
};

app.use(express.static("public"));

// ======================================
// Segédfüggvények
// ======================================

function getNumber(value) {
  return Number(value) || 0;
}

function getPercent(value) {
  if (!value) {
    return 0;
  }

  return Number(value.replace("%", "")) / 100;
}

function normalizeCardName(name) {
  return name
    .replace(/\(epikus\)/g, "")
    .trim();
}

function prepareCsvCard(card) {
  card["Főpakli összesen"] = getNumber(card["Főpakli összesen"]);
  card["Side összesen"] = getNumber(card["Side összesen"]);
  card["Főpakli top%"] = getPercent(card["Főpakli top%"]);

  card["SUM"] = card["Főpakli összesen"] + card["Side összesen"];

  // Nem kerekítjük, hogy egyezzen az Excel-számolással
  card["TOP"] = card["Főpakli összesen"] * card["Főpakli top%"];

  card["rank"] = card[""];
  delete card[""];
}

function findJsonCard(jsonCards, name) {
  const cleanName = normalizeCardName(name).toLowerCase();

  return jsonCards.find((jsonCard) => {
    return normalizeCardName(jsonCard.name).toLowerCase() === cleanName;
  });
}

function readTextFile(path) {
  return fs.promises.readFile(path, "utf8");
}

function parseCsv(data) {
  const result = Papa.parse(data, {
    header: true,
    skipEmptyLines: true
  });

  return result.data;
}

function getRequestedFormat(req) {
  const requestedFormat = req.query.format;

  if (formats[requestedFormat]) {
    return requestedFormat;
  }

  return "classic";
}

function getMatchingTypes(cardTypes, allowedTypes) {
  if (!Array.isArray(cardTypes)) {
    return [];
  }

  return cardTypes.filter((type) => {
    return allowedTypes.includes(type);
  });
}

// ======================================
// Narancslap JSON-találatok keresése
// ======================================

function findOrangeMatches(cardName, jsonCards) {
  const cleanCardName = normalizeCardName(cardName).toLowerCase();

  const fullMatch = jsonCards.find((jsonCard) => {
    return normalizeCardName(jsonCard.name).toLowerCase() === cleanCardName;
  });

  if (fullMatch) {
    return [fullMatch];
  }

  return jsonCards.filter((jsonCard) => {
    const cleanJsonName = normalizeCardName(jsonCard.name).toLowerCase();

    return cleanCardName.includes(cleanJsonName);
  });
}

// ======================================
// Narancslap típus meghatározása
// ======================================

function getOrangeType(cardName, jsonCards) {
  const matchedCards = findOrangeMatches(cardName, jsonCards);

  const hasRule = matchedCards.some((card) => {
    return card.type && card.type.some((type) => {
      return type.toLowerCase().includes("szabálylap");
    });
  });

  const hasFollower = matchedCards.some((card) => {
    return card.type && card.type.some((type) => {
      return type.toLowerCase().includes("követő");
    });
  });

  const hasEpic = matchedCards.some((card) => {
    return card.type && card.type.some((type) => {
      return type.toLowerCase().includes("epikus");
    });
  });

  if (hasRule && hasFollower) {
    return "Szabálylap + Követő";
  }

  if (hasEpic) {
    return "Epikus";
  }

  if (hasRule) {
    return "Szabálylap";
  }

  if (hasFollower) {
    return "Követő";
  }

  return null;
}

function getOrangeParts(cardName, jsonCards) {
  const matchedCards = findOrangeMatches(cardName, jsonCards);

  const uniqueCards = [];

  matchedCards.forEach((card) => {
    if (!uniqueCards.some((item) => item.ID === card.ID)) {
      uniqueCards.push(card);
    }
  });

  const ruleCard = uniqueCards.find((card) => {
    return card.type && card.type.some((type) =>
      type.toLowerCase().includes("szabálylap")
    );
  });

  const followerCard = uniqueCards.find((card) => {
    return card.type && card.type.some((type) =>
      type.toLowerCase().includes("követő")
    );
  });

  if (ruleCard && followerCard) {
    return [ruleCard, followerCard];
  }

  return uniqueCards.slice(0, 1);
}

function shouldKeepTopCard(card) {
  if (!card.type) {
    return true;
  }

  return !card.type.some((type) => {
    const cleanType = type.toLowerCase();

    return (
      cleanType.includes("követő") ||
      cleanType.includes("szabálylap")
    );
  });
}

// ======================================
// Topcards feldolgozása
// ======================================

function buildTopCards(csvCards, jsonCards, editions) {
  csvCards.forEach((card) => {
    prepareCsvCard(card);
  });

  csvCards.forEach((card) => {
    const match = findJsonCard(jsonCards, card["Lap"]);

    if (match) {
      const editionId = Math.max(...match.editions.map(Number));

      card["ID"] = match.ID;
      card["name"] = match.name;
      card["link"] = match.link;

      card["type"] = match.type;

card["subtypes"] = getMatchingTypes(
  match.type,
  SUBTYPE_TYPES
);

card["icons"] = getMatchingTypes(
  match.type,
  ICON_TYPES
);

card["color"] = match.color;
card["edition"] = editions[editionId];
card["flag"] = match.flags || "Nincs";
    }
  });

  return csvCards.filter((card) => {
    return shouldKeepTopCard(card);
  });
}

// ======================================
// Narancslapok feldolgozása
// ======================================

function buildOrangeCards(csvCards, jsonCards) {
  csvCards.forEach((card) => {
    prepareCsvCard(card);
  });

  csvCards.forEach((card) => {
    const orangeParts = getOrangeParts(card["Lap"], jsonCards);

    if (orangeParts.length > 0) {
      card["ID"] = orangeParts[0].ID;
      card["name"] = orangeParts[0].name;
      card["link"] = orangeParts[0].link;

      card["orangeParts"] = orangeParts.map((part) => {
        return {
          ID: part.ID,
          name: part.name,
          link: part.link,
          type: part.type
        };
      });
    }

    card["orangeType"] = getOrangeType(card["Lap"], jsonCards);
  });

  return csvCards;
}

// ======================================
// Formátum betöltése
// ======================================

async function loadFormat(formatKey, jsonCards, editions) {
  const format = formats[formatKey];

  const topcardsCsv = await readTextFile(format.topcardsPath);
  const orangeCardsCsv = await readTextFile(format.orangeCardsPath);

  const topcardsRows = parseCsv(topcardsCsv);
  const orangeCardsRows = parseCsv(orangeCardsCsv);

  formatData[formatKey].cards = buildTopCards(
    topcardsRows,
    jsonCards,
    editions
  );

  formatData[formatKey].orangeCards = buildOrangeCards(
    orangeCardsRows,
    jsonCards
  );

  console.log(`${formatKey} formátum betöltve`);
}

async function loadAllData() {
  try {
    const jsonData = await readTextFile("./data/cards.json");
    const editionData = await readTextFile("./data/editions.json");

const jsonCards = JSON.parse(jsonData);
const editions = JSON.parse(editionData);


    await loadFormat("classic", jsonCards, editions);
    await loadFormat("tm", jsonCards, editions);

    console.log("Minden adat betöltve");
  } catch (err) {
    console.error("Adatbetöltési hiba:", err);
  }
}

// ======================================
// API végpontok
// ======================================

app.get("/api/cards", (req, res) => {
  const format = getRequestedFormat(req);

  res.json(formatData[format].cards);
});

app.get("/api/orange-cards", (req, res) => {
  const format = getRequestedFormat(req);

  res.json(formatData[format].orangeCards);
});

// ======================================
// Szerver indítása
// ======================================

loadAllData();

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on("error", (err) => {
  console.error("Szerver hiba:", err);
});

server.on("close", () => {
  console.log("A szerver bezáródott");
});