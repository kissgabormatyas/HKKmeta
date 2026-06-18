import express from "express";
import Papa from "papaparse";
import fs from "fs";

const app = express();
const port = 3000;

const formats = {
  classic: {
    topcardsPath: "./data/topcards-classic.csv",
    orangeCardsPath: "./data/orange-classic.csv",
    period: "2025.12.01 - 2026.05.31"
  },
  tm: {
    topcardsPath: "./data/topcards-tm.csv",
    orangeCardsPath: "./data/orange-tm.csv",
    period: "2026.01.01 - 2026.06.18"
  }
};

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
  card["Alap összesen"] = getNumber(card["Alap összesen"]);
  card["Side összesen"] = getNumber(card["Side összesen"]);
  card["Alap top%"] = getPercent(card["Alap top%"]);

  card["SUM"] = card["Alap összesen"] + card["Side összesen"];

  // Nem kerekítjük, hogy egyezzen az Excel-számolással
  card["TOP"] = card["Alap összesen"] * card["Alap top%"];

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
    const match = findJsonCard(jsonCards, card["Lap"]);

    if (match) {
      card["ID"] = match.ID;
      card["name"] = match.name;
      card["link"] = match.link;
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