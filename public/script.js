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
  "#4A2B11",
  "#563114",
  "#623817",
  "#6E3F1A",
  "#7A461D",
  "#864D20",
  "#925423",
  "#9E5B26",
  "#AA6229",
  "#B6692C",
  "#C27030",
  "#C97A3C",
  "#D08448",
  "#D78E54",
  "#DE9860",
  "#E3A56F",
  "#E8B27E",
  "#EDBF8D",
  "#F2CC9C",
  "#F7D9AB",
  "#F9E0B7",
  "#FBE6C3",
  "#FCECCF",
  "#FEF2DB"
];

const orangePalette = [
  "#8A5722", // bronz
  "#C27030", // réz/arany
  "#E8B27E", // világos arany
  "#5B3514"  // mélybarna
];

const valueLabels = {
  "Alap összesen": "Főpakli",
  "Side összesen": "Side",
  "TOP": "TOP20%",
  "SUM": "Összesen"
};


// ======================================
// Állapot
// ======================================

const charts = {};

const filterState = {
  selectedColors: [],
  selectedFlag: "Összes",
  valueKey: "Alap összesen"
};

let allCards = [];
let currentFormat = "classic";


// ======================================
// Segédfüggvények
// ======================================

function getArrayValue(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

function getCardValue(card, valueKey) {
  return Number(card[valueKey]) || 0;
}

function getComparableTopValue(card) {
  return Number(getCardValue(card, "TOP").toFixed(2));
}

function isRenderableCard(card) {
  return card && card.ID && card.link && card.name;
}

function getSelectedCards(cards) {
  return cards.filter((card) => {
    const colors = getArrayValue(card.color);
    const flags = getArrayValue(card.flag);

    const colorMatches =
      filterState.selectedColors.length === 0 ||
      filterState.selectedColors.some((selectedColor) => colors.includes(selectedColor));

    const flagMatches =
      filterState.selectedFlag === "Összes" ||
      flags.includes(filterState.selectedFlag);

    return colorMatches && flagMatches;
  });
}

function resetFilters() {
  filterState.selectedColors = [];
  filterState.selectedFlag = "Összes";

  const flagSelect = document.getElementById("flagSelect");

  if (flagSelect) {
    flagSelect.value = "Összes";
  }

  updateColorFilterButtons();
}


// ======================================
// Formátumváltó
// ======================================

function setupFormatSwitcher() {
  const buttons = document.querySelectorAll("[data-format]");

  if (buttons.length === 0) {
    return;
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedFormat = button.dataset.format;

      if (!selectedFormat || selectedFormat === currentFormat) {
        return;
      }

      currentFormat = selectedFormat;

      buttons.forEach((formatButton) => {
        formatButton.classList.toggle(
          "active",
          formatButton.dataset.format === currentFormat
        );
      });

      resetFilters();
      loadDashboardData();
    });
  });
}


// ======================================
// Szűrő UI
// ======================================

function renderColorFilters(cards) {
  const container = document.getElementById("colorFilters");

  if (!container) {
    return;
  }

  const colors = Object.keys(colorMap).filter((color) => {
    return cards.some((card) => getArrayValue(card.color).includes(color));
  });

  container.innerHTML = `
    <button
      type="button"
      class="color-filter-button color-filter-reset active"
      data-color=""
      title="Összes szín"
      aria-label="Összes szín"
    ></button>
    ${colors
      .map((color) => {
        return `
          <button
            type="button"
            class="color-filter-button"
            data-color="${color}"
            title="${color}"
            aria-label="${color}"
            style="--filter-color: ${colorMap[color]}"
          ></button>
        `;
      })
      .join("")}
  `;

  container.querySelectorAll(".color-filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;

      if (!color) {
        filterState.selectedColors = [];
      } else if (filterState.selectedColors.includes(color)) {
        filterState.selectedColors = filterState.selectedColors.filter((selectedColor) => {
          return selectedColor !== color;
        });
      } else {
        filterState.selectedColors.push(color);
      }

      updateColorFilterButtons();
      refreshDashboard();
    });
  });
}

function updateColorFilterButtons() {
  const buttons = document.querySelectorAll(".color-filter-button");

  buttons.forEach((button) => {
    const color = button.dataset.color;

    if (!color) {
      button.classList.toggle("active", filterState.selectedColors.length === 0);
      return;
    }

    button.classList.toggle("active", filterState.selectedColors.includes(color));
  });
}

function renderFlagFilter(cards) {
  const flagSelect = document.getElementById("flagSelect");

  if (!flagSelect) {
    return;
  }

  const flags = new Set();

  cards.forEach((card) => {
    getArrayValue(card.flag).forEach((flag) => {
      if (flag && flag !== "Nincs") {
        flags.add(flag);
      }
    });
  });

  const sortedFlags = Array.from(flags).sort((a, b) => {
    return a.localeCompare(b, "hu");
  });

  flagSelect.innerHTML = `
    <option value="Összes">Összes</option>
    ${sortedFlags
      .map((flag) => `<option value="${flag}">${flag}</option>`)
      .join("")}
  `;

  flagSelect.value = filterState.selectedFlag;

  flagSelect.onchange = () => {
    filterState.selectedFlag = flagSelect.value;
    refreshDashboard();
  };
}

function setupValueFilter() {
  const valueSelect = document.getElementById("valueSelect");

  if (!valueSelect) {
    return;
  }

  filterState.valueKey = valueSelect.value;

  valueSelect.onchange = () => {
    filterState.valueKey = valueSelect.value;
    refreshDashboard();
  };
}


// ======================================
// Adatok összesítése szín szerint
// ======================================

function getColorCounts(cards, valueKey) {
  const colorCounts = {};

  cards.forEach((card) => {
    const colors = getArrayValue(card.color);
    const value = getCardValue(card, valueKey);

    colors.forEach((color) => {
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
    const types = getArrayValue(card.type);

    if (types.length === 0) {
      return;
    }

    const type = types[0];

    if (type === "Követő") {
      return;
    }

    const value = getCardValue(card, valueKey);

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
    const value = getCardValue(card, valueKey);

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
    const flags = getArrayValue(card.flag);
    const value = getCardValue(card, valueKey);

    flags.forEach((flag) => {
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

    const value = getCardValue(card, valueKey);

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

function prepareChartData(counts, useColorMap = false, customPalette = null) {
  const entries = Object.entries(counts).filter((entry) => Number(entry[1]) > 0);

  entries.sort((a, b) => {
    return b[1] - a[1];
  });

  const labels = entries.map((entry) => entry[0]);
  const values = entries.map((entry) => entry[1]);
  const total = values.reduce((sum, value) => sum + value, 0);

  const palette = customPalette || dashboardPalette;

  const colors = useColorMap
    ? labels.map((label) => colorMap[label] || "#B58A5A")
    : labels.map((_, index) => palette[index % palette.length]);

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

  const renderableCards = cards.filter(isRenderableCard);

  if (renderableCards.length === 0) {
    container.innerHTML = `<p class="empty-state">Nincs megjeleníthető lap.</p>`;
    return;
  }

  container.innerHTML = renderableCards
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
    .filter((card) => getCardValue(card, valueKey) > 0)
    .sort((a, b) => getCardValue(b, valueKey) - getCardValue(a, valueKey))
    .slice(0, 10);

  renderCards("top10Cards", top10Cards);
}


// ======================================
// Legjobb narancslapok holtversennyel
// ======================================

function getBestOrangeCardsWithTies(orangeCards, limit = 10) {
  const validCards = orangeCards
    .filter(isRenderableCard)
    .filter((card) => getComparableTopValue(card) > 0)
    .sort((a, b) => getComparableTopValue(b) - getComparableTopValue(a));

  const includedCards = [];

  for (const card of validCards) {
    const value = getComparableTopValue(card);

    const betterCardCount = validCards.filter((otherCard) => {
      return getComparableTopValue(otherCard) > value;
    }).length;

    const rank = betterCardCount + 1;

    if (rank <= limit) {
      includedCards.push(card);
    }
  }

  return includedCards;
}

function getOrangeRank(card, cards) {
  const value = getComparableTopValue(card);

  const betterCardCount = cards.filter((otherCard) => {
    return getComparableTopValue(otherCard) > value;
  }).length;

  return betterCardCount + 1;
}

function getOrangeTieCount(card, cards) {
  const value = getComparableTopValue(card);

  return cards.filter((otherCard) => {
    return getComparableTopValue(otherCard) === value;
  }).length;
}

function renderBestOrangeCards(orangeCards) {
  const container = document.getElementById("bestOrangeCards");

  if (!container) {
    return;
  }

  const bestCards = getBestOrangeCardsWithTies(orangeCards, 10);

  if (bestCards.length === 0) {
    container.innerHTML = `<p class="empty-state">Nincs megjeleníthető narancslap.</p>`;
    return;
  }

  container.innerHTML = bestCards
    .map((card) => {
      const rank = getOrangeRank(card, bestCards);
      const tieCount = getOrangeTieCount(card, bestCards);

      return `
  <article class="best-orange-card rank-${rank} ${tieCount > 1 ? "is-tie" : ""}">
          <div class="best-orange-rank">
            <span class="rank-number">${rank}.</span>
          </div>

          <a href="${getCardPageUrl(card)}" target="_blank" class="best-orange-image-link">
            <img
              src="${getCardImageUrl(card)}"
              alt="${card.name}"
              class="card-image"
            >
          </a>

          <div class="best-orange-info">
            <div class="best-orange-name">${card.name}</div>
            <div class="best-orange-type">${card.orangeType || "Narancslap"}</div>
          </div>
        </article>
      `;
    })
    .join("");
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

  const isEditionChart = canvasId === "editionChart";

  charts[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: title,
          data: chartData.values,
          backgroundColor: chartData.colors,
          borderColor: "#3A220D",
          borderWidth: 0.5
        }
      ]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          right: isEditionChart ? 42 : 10,
          top: 8
        }
      },
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 14
          }
        },
        datalabels: {
          display: chartData.total > 0,
          font: {
            size: 10
          },
          color: "#2d1b0f",
          anchor: "end",
          align: "end",
          offset: isEditionChart ? 4 : 2,
          clamp: true,
          clip: false,
          formatter: (value) => {
            if (!chartData.total) {
              return "";
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
              size: 11
            }
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            display: horizontal ? true : false,
            autoSkip: false,
            font: {
              size: window.innerWidth < 768 ? 8 : 11
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
          display: chartData.total > 0,
          color: "#ffffff",
          textStrokeColor: "#000000",
          textStrokeWidth: 3,
          formatter: (value) => {
            if (!chartData.total) {
              return "";
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
  const valueLabel = valueLabels[valueKey] || valueKey;

  const colorCounts = getColorCounts(cards, valueKey);
  const colorData = prepareChartData(colorCounts, true);

  createBarChart(
    "colorChart",
    `Színek szerinti eloszlás - ${valueLabel}`,
    colorData
  );

  const typeCounts = getTypeCounts(cards, valueKey);
  const typeData = prepareChartData(typeCounts);

  createBarChart(
    "typeChart",
    `Laptípus szerinti eloszlás - ${valueLabel}`,
    typeData
  );

  const editionCounts = getEditionCounts(cards, valueKey);
  const editionData = prepareChartData(editionCounts);

  createBarChart(
    "editionChart",
    `Kiegészítő szerinti eloszlás - ${valueLabel}`,
    editionData,
    true
  );

  const flagCounts = getFlagCounts(cards, valueKey);
  const flagData = prepareChartData(flagCounts);

  createBarChart(
    "functionChart",
    `Funkció szerinti eloszlás - ${valueLabel}`,
    flagData
  );

  renderTop10Cards(cards, valueKey);
}

function refreshDashboard() {
  const filteredCards = getSelectedCards(allCards);
  updateCharts(filteredCards, filterState.valueKey);
}


// ======================================
// Narancslap chartok frissítése
// ======================================

function updateOrangeCharts(orangeCards) {
  const orangeCounts = getOrangeTypeCounts(orangeCards, "Alap összesen");
  const orangeData = prepareChartData(orangeCounts, false, orangePalette);

  createPieChart(
    "orangeChart",
    "Narancslapok eloszlása",
    orangeData
  );

  const orangeTopCounts = getOrangeTypeCounts(orangeCards, "TOP");
  const orangeTopData = prepareChartData(orangeTopCounts, false, orangePalette);
  createPieChart(
    "orangeTopChart",
    "Narancslapok eloszlása TOP20%",
    orangeTopData
  );
}


// ======================================
// Adatbetöltés
// ======================================

function loadDashboardData() {
fetch(`/api/format-info?format=${currentFormat}`)
  .then((response) => response.json())
  .then((info) => {
    const periodElement = document.getElementById("dataPeriod");

    if (periodElement) {
      periodElement.textContent = info.period;
    }
  });

  fetch(`/api/cards?format=${currentFormat}`)
    .then((response) => response.json())
    .then((cards) => {
      allCards = cards;

      renderColorFilters(allCards);
      renderFlagFilter(allCards);
      refreshDashboard();
    });

  fetch(`/api/orange-cards?format=${currentFormat}`)
    .then((response) => response.json())
    .then((orangeCards) => {
      updateOrangeCharts(orangeCards);
      renderBestOrangeCards(orangeCards);
    });
}


// ======================================
// Fő program
// ======================================

setupValueFilter();
setupFormatSwitcher();
loadDashboardData();