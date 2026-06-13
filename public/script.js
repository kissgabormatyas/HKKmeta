// ======================================
// Chart.js plugin regisztrálása
// ======================================

Chart.register(ChartDataLabels);


// ======================================
// Színkódok
// ======================================

const colorMap = {
  "Színtelen": "#F9ECE5",
  "Bufa": "#D6B6A7",
  "Raia": "#F5F8FA",
  "Elenios": "#0B78B3",
  "Rhatt": "#A5FAB9",
  "Fairlight": "#FAEB48",
  "Sheran": "#395738",
  "Tharr": "#68150A",
  "Leah": "#33100C",
  "Dornodon": "#D73220",
  "Chara-din": "#662E82"
};

const dashboardPalette = [
  "#5B3514",
  "#7B4F1D",
  "#9A642A",
  "#B87C34",
  "#D79B4D",
  "#E5B96D",
  "#C06A2B",
  "#8A4B20",
  "#B58A5A",
  "#6D4A2B"
];


// ======================================
// Chart példányok tárolása
// ======================================

const charts = {};


// ======================================
// Adatok összesítése szín szerint
// ======================================

function getColorCounts(cards, valueKey) {
  const colorCounts = {};

  cards.forEach((card) => {
    if (!card.color) {
      return;
    }

    const value = Number(card[valueKey]) || 0;

    card.color.forEach((color) => {
      if (color === "Nincs") {
        return;
      }

      if (colorCounts[color]) {
        colorCounts[color] += value;
      } else {
        colorCounts[color] = value;
      }
    });
  });

  return colorCounts;
}


// ======================================
// Adatok összesítése típus szerint
// ======================================

function getTypeCounts(cards, valueKey) {
  const typeCounts = {};

  cards.forEach((card) => {
    if (!card.type) {
      return;
    }

    const type = card.type[0];

    if (type === "Követő") {
      return;
    }

    const value = Number(card[valueKey]) || 0;

    if (typeCounts[type]) {
      typeCounts[type] += value;
    } else {
      typeCounts[type] = value;
    }
  });

  return typeCounts;
}


// ======================================
// Adatok összesítése kiadás szerint
// ======================================

function getEditionCounts(cards, valueKey) {
  const editionCounts = {};

  cards.forEach((card) => {
    if (!card.edition) {
      return;
    }

    const edition = card.edition;
    const value = Number(card[valueKey]) || 0;

    if (editionCounts[edition]) {
      editionCounts[edition] += value;
    } else {
      editionCounts[edition] = value;
    }
  });

  return editionCounts;
}


// ======================================
// Adatok összesítése funkció szerint
// ======================================

function getFlagCounts(cards, valueKey) {
  const flagCounts = {};

  cards.forEach((card) => {
    if (!card.flag) {
      return;
    }

    const value = Number(card[valueKey]) || 0;

    card.flag.forEach((flag) => {
      if (flag === "Nincs") {
        return;
      }

      if (flagCounts[flag]) {
        flagCounts[flag] += value;
      } else {
        flagCounts[flag] = value;
      }
    });
  });

  return flagCounts;
}


// ======================================
// Narancslapok összesítése típus szerint
// ======================================

function getOrangeTypeCounts(orangeCards, valueKey) {
  const orangeTypeCounts = {};

  orangeCards.forEach((card) => {
    if (!card.orangeType) {
      return;
    }

    const value = Number(card[valueKey]) || 0;

    if (value === 0) {
      return;
    }

    if (orangeTypeCounts[card.orangeType]) {
      orangeTypeCounts[card.orangeType] += value;
    } else {
      orangeTypeCounts[card.orangeType] = value;
    }
  });

  return orangeTypeCounts;
}


// ======================================
// Objektum rendezése és chart-adattá alakítása
// ======================================

function prepareChartData(counts, useColorMap = false) {
  const entries = Object.entries(counts);

  entries.sort((a, b) => {
    return b[1] - a[1];
  });

  const labels = entries.map((entry) => entry[0]);
  const values = entries.map((entry) => entry[1]);
  const total = values.reduce((sum, value) => sum + value, 0);

  const colors = useColorMap
  ? labels.map((label) => colorMap[label])
  : labels.map((_, index) =>
      dashboardPalette[index % dashboardPalette.length]
    );

  return {
    labels: labels,
    values: values,
    colors: colors,
    total: total
  };
}


// ======================================
// Képek
// ======================================

function getCardImageUrl(card) {
  return `https://lapkereso.hkk.hu/HKKCardImage.php?cardID=${card.ID}`;
}

function getCardPageUrl(card) {
  return `https://lapkereso.hkk.hu/lap/${card.link}/${card.ID}`;
}

function renderCards(containerId, cards) {
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  container.innerHTML = cards
    .map((card) => {
      return `
        <a href="${getCardPageUrl(card)}" target="_blank">
          <img
            src="${getCardImageUrl(card)}"
            alt="${card.name}"
            class="card-image"
          >
        </a>
      `;
    })
    .join("");
}

function renderTop10Cards(cards, valueKey) {
  const top10Cards = cards
    .filter((card) => Number(card[valueKey]) > 0)
    .sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]))
    .slice(0, 10);

  renderCards("top10Cards", top10Cards);
}

function renderOrangeTopCards(orangeCards) {
  const topEpicCards = orangeCards
    .filter((card) => card.orangeType === "Epikus")
    .filter((card) => Number(card.TOP) > 0)
    .sort((a, b) => Number(b.TOP) - Number(a.TOP))
    .slice(0, 3);

  const topFollowerCards = orangeCards
    .filter((card) => card.orangeType === "Követő")
    .filter((card) => Number(card.TOP) > 0)
    .sort((a, b) => Number(b.TOP) - Number(a.TOP))
    .slice(0, 3);

  const topRuleCards = orangeCards
    .filter((card) => card.orangeType === "Szabálylap")
    .filter((card) => Number(card.TOP) > 0)
    .sort((a, b) => Number(b.TOP) - Number(a.TOP))
    .slice(0, 3);

  renderCards("topEpicCards", topEpicCards);
  renderCards("topFollowerCards", topFollowerCards);
  renderCards("topRuleCards", topRuleCards);
}


// ======================================
// Oszlopdiagram / sávdiagram létrehozása
// ======================================

function createBarChart(canvasId, title, chartData, horizontal = false) {
  const ctx = document.getElementById(canvasId);

  if (!ctx) {
    return;
  }

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: title,
          data: chartData.values,
          backgroundColor: chartData.colors,
          borderColor: "#4A2B11",
          borderWidth: 1
        }
      ]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title
        },
        datalabels: {
          font: {
            size: 10
          },
          anchor: "end",
          align: "end",
          formatter: (value) => {
            if (!chartData.total) {
              return "0%";
            }

            return ((value / chartData.total) * 100).toFixed(1) + "%";
          }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            display: horizontal ? false : true,
            font: {
              size: 8
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            display: horizontal ? true : false,
            font: {
              size: 8
            }
          }
        }
      }
    }
  });
}


// ======================================
// Kördiagram létrehozása
// ======================================

function createPieChart(canvasId, title, chartData) {
  const ctx = document.getElementById(canvasId);

  if (!ctx) {
    return;
  }

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(ctx, {
    type: "pie",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: title,
          data: chartData.values,
          backgroundColor: chartData.colors,
          borderColor: "#ffffff",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title
        },
        datalabels: {
            color: "#ffffff",
            textStrokeColor: "#000000",
            textStrokeWidth: 3,

          formatter: (value) => {
            if (!chartData.total) {
              return "0%";
            }

            return ((value / chartData.total) * 100).toFixed(1) + "%";
          }
        },
        legend: {
          position: "bottom"
        }
      }
    }
  });
}


// ======================================
// Összes normál chart frissítése
// ======================================

function updateCharts(cards, valueKey) {
  const colorCounts = getColorCounts(cards, valueKey);
  const colorData = prepareChartData(colorCounts, true);

  createBarChart(
    "colorChart",
    "Színek szerinti eloszlás",
    colorData
  );

  const typeCounts = getTypeCounts(cards, valueKey);
  const typeData = prepareChartData(typeCounts);

  createBarChart(
    "typeChart",
    "Laptípus szerinti eloszlás",
    typeData
  );

  const editionCounts = getEditionCounts(cards, valueKey);
  const editionData = prepareChartData(editionCounts);

  createBarChart(
    "editionChart",
    "Kiegészítő szerinti eloszlás",
    editionData,
    true
  );

  const flagCounts = getFlagCounts(cards, valueKey);
  const flagData = prepareChartData(flagCounts);

  createBarChart(
    "functionChart",
    "Funkció szerinti eloszlás",
    flagData
  );

  renderTop10Cards(cards, valueKey);
}


// ======================================
// Narancslap chartok frissítése
// ======================================

function updateOrangeCharts(orangeCards) {
  const orangeCounts = getOrangeTypeCounts(orangeCards, "Alap összesen");
  const orangeData = prepareChartData(orangeCounts);

  createPieChart(
    "orangeChart",
    "Narancslapok eloszlása",
    orangeData
  );

  const orangeTopCounts = getOrangeTypeCounts(orangeCards, "TOP");
  const orangeTopData = prepareChartData(orangeTopCounts);

  createPieChart(
    "orangeTopChart",
    "Narancslapok eloszlása TOP20%",
    orangeTopData
  );
}


// ======================================
// Fő program
// ======================================

fetch("/api/cards")
  .then((response) => response.json())
  .then((cards) => {
    const valueSelect = document.getElementById("valueSelect");

    updateCharts(cards, valueSelect.value);

    valueSelect.addEventListener("change", () => {
      updateCharts(cards, valueSelect.value);
    });
  });

fetch("/api/orange-cards")
  .then((response) => response.json())
  .then((orangeCards) => {
    updateOrangeCharts(orangeCards);
    renderOrangeTopCards(orangeCards);
  });