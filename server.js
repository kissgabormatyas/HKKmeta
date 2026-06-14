import express from "express";
import Papa from "papaparse";
import fs from "fs";

const app = express();
const port = 3000;

let cards = [];
let orangeCards = [];

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

// ======================================
// Topcards.csv beolvasása
// ======================================

fs.readFile("./data/Topcards.csv", "utf8", (err, data) => {
  if (err) {
    console.error("Topcards.csv beolvasási hiba:", err);
    return;
  }

  const result = Papa.parse(data, {
    header: true,
    skipEmptyLines: true
  });

  cards = result.data;

  cards.forEach((card) => {
    prepareCsvCard(card);
  });

  fs.readFile("./data/cards.json", "utf8", (err, jsonData) => {
    if (err) {
      console.error("cards.json beolvasási hiba:", err);
      return;
    }

    const jsonCards = JSON.parse(jsonData);

    fs.readFile("./data/editions.json", "utf8", (err, editionData) => {
      if (err) {
        console.error("editions.json beolvasási hiba:", err);
        return;
      }

      const editions = JSON.parse(editionData);

      cards.forEach((card) => {
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
    });
  });
});

// ======================================
// OrangeCards.csv beolvasása
// ======================================

fs.readFile("./data/OrangeCards.csv", "utf8", (err, data) => {
  if (err) {
    console.error("OrangeCards.csv beolvasási hiba:", err);
    return;
  }

  const result = Papa.parse(data, {
    header: true,
    skipEmptyLines: true
  });

  orangeCards = result.data;

  orangeCards.forEach((card) => {
    prepareCsvCard(card);
  });

  fs.readFile("./data/cards.json", "utf8", (err, jsonData) => {
    if (err) {
      console.error("cards.json beolvasási hiba narancslapokhoz:", err);
      return;
    }

    const jsonCards = JSON.parse(jsonData);

    orangeCards.forEach((card) => {

      const match = findJsonCard(jsonCards, card["Lap"]);

  if (match) {
    card["ID"] = match.ID;
    card["name"] = match.name;
    card["link"] = match.link;
  }

      card["orangeType"] = getOrangeType(card["Lap"], jsonCards);
    });
  });

  
});

// ======================================
// API végpontok
// ======================================

app.get("/api/cards", (req, res) => {
  res.json(cards);
});

app.get("/api/orange-cards", (req, res) => {
  res.json(orangeCards);
});

// ======================================
// Szerver indítása
// ======================================

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

server.on("error", (err) => {
  console.error("Szerver hiba:", err);
});

server.on("close", () => {
  console.log("A szerver bezáródott");
});