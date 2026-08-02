// ======================================
// HKK Meta – fekete/arany felület
// ======================================

Chart.register(ChartDataLabels);

Chart.defaults.color = "#a9a18f";
Chart.defaults.borderColor = "rgba(216, 180, 83, 0.10)";
Chart.defaults.font.family = 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const colorMap = {
  "Színtelen": "#F9ECE5",
  "Bufa": "#D6B6A7",
  "Raia": "#F5F8FA",
  "Elenios": "#0B78B3",
  "Rhatt": "#A5FAB9",
  "Fairlight": "#FAEB48",
  "Sheran": "#395738",
  "Tharr": "#68150A",
  "Leah": "#111111",
  "Dornodon": "#D73220",
  "Chara-din": "#662E82"
};

const goldPalette = [
  "#f2dc85",
  "#e7c965",
  "#d8b453",
  "#c59a3a",
  "#ad812b",
  "#936820",
  "#76501a",
  "#5e3d15",
  "#493011",
  "#38260f",
  "#c9b77e",
  "#a8945b",
  "#806f43",
  "#655632",
  "#4d432b"
];

const orangePalette = [
  "#f0d778",
  "#d8b453",
  "#ad812b",
  "#76501a"
];

const valueLabels = {
  "Főpakli összesen": "Főpakli",
  "Side összesen": "Side",
  "TOP": "TOP20%",
  "SUM": "Összesen"
};



const charts = {};

const state = {
  currentFormat: "classic",
  currentView: "orange",
  orangeValueKey: "Főpakli összesen",
  allCards: [],
  orangeCards: [],
  filter: {
    selectedColors: [],
    selectedFlag: "Összes",
    selectedIcon: "Összes",
    valueKey: "Főpakli összesen"
  }
};

// ======================================
// Általános segédfüggvények
// ======================================

function getArrayValue(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function getCardValue(card, valueKey) {
  return Number(card?.[valueKey]) || 0;
}

function getRankingValue(card, valueKey) {
  return Number(getCardValue(card, valueKey).toFixed(2));
}

function sumCardValues(cards, valueKey) {
  return cards.reduce((sum, card) => sum + getCardValue(card, valueKey), 0);
}

function formatNumber(value) {
  const number = Number(value) || 0;
  const hasDecimals = Math.abs(number - Math.round(number)) > 0.001;

  return new Intl.NumberFormat("hu-HU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0
  }).format(number);
}

function formatPercent(value, digits = 1) {
  const number = Number.isFinite(value) ? value : 0;
  return `${number.toFixed(digits).replace(".", ",")}%`;
}

function getShare(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isRenderableCard(card) {
  return Boolean(card && card.ID && card.link && card.name);
}

function isRenderableOrangeCard(card) {
  return isRenderableCard(card) || getArrayValue(card?.orangeParts).length > 0;
}

function getCardImageUrl(card) {
  return `https://lapkereso.hkk.hu/HKKCardImage.php?cardID=${encodeURIComponent(card.ID)}`;
}

function getCardPageUrl(card) {
  return `https://lapkereso.hkk.hu/lap/${encodeURIComponent(card.link)}/${encodeURIComponent(card.ID)}`;
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function destroyChart(canvasId) {
  if (charts[canvasId]) {
    charts[canvasId].destroy();
    delete charts[canvasId];
  }
}

function showError(containerId, message) {
  const container = document.getElementById(containerId);

  if (container) {
    container.innerHTML = `<p class="error-state">${escapeHtml(message)}</p>`;
  }
}

// ======================================
// Fő nézetváltó és formátumválasztó
// ======================================

function setupViewNavigation() {
  const buttons = document.querySelectorAll("[data-view]");
  const panels = document.querySelectorAll("[data-view-panel]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedView = button.dataset.view;

      if (!selectedView || selectedView === state.currentView) {
        return;
      }

      state.currentView = selectedView;

      buttons.forEach((item) => {
        item.classList.toggle("active", item.dataset.view === selectedView);
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.viewPanel === selectedView;
        panel.hidden = !isActive;
        panel.classList.toggle("active", isActive);
      });

      if (selectedView === "orange") {
        refreshOrangeView();
      } else {
        refreshCardsView();
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function setupFormatSwitcher() {
  const buttons = document.querySelectorAll("[data-format]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const selectedFormat = button.dataset.format;

      if (!selectedFormat || selectedFormat === state.currentFormat) {
        return;
      }

      state.currentFormat = selectedFormat;

      buttons.forEach((item) => {
        item.classList.toggle("active", item.dataset.format === selectedFormat);
      });

      resetCardFilters();
      loadDashboardData();
    });
  });
}

function setupMetricSwitchers() {
  document.querySelectorAll("[data-orange-value]").forEach((button) => {
    button.addEventListener("click", () => {
      const valueKey = button.dataset.orangeValue;

      if (!valueKey || valueKey === state.orangeValueKey) {
        return;
      }

      state.orangeValueKey = valueKey;

      document.querySelectorAll("[data-orange-value]").forEach((item) => {
        item.classList.toggle("active", item.dataset.orangeValue === valueKey);
      });

      refreshOrangeView();
    });
  });

  document.querySelectorAll("[data-card-value]").forEach((button) => {
    button.addEventListener("click", () => {
      const valueKey = button.dataset.cardValue;

      if (!valueKey || valueKey === state.filter.valueKey) {
        return;
      }

      state.filter.valueKey = valueKey;

      document.querySelectorAll("[data-card-value]").forEach((item) => {
        item.classList.toggle("active", item.dataset.cardValue === valueKey);
      });

      refreshCardsView();
    });
  });
}

// ======================================
// Normál lapok szűrői
// ======================================

function getSelectedCards(cards) {
  return cards.filter((card) => {
    const colors = getArrayValue(card.color);
    const flags = getArrayValue(card.flag);
    const icons = getArrayValue(card.icons);

    const colorMatches =
      state.filter.selectedColors.length === 0 ||
      state.filter.selectedColors.some((selectedColor) => colors.includes(selectedColor));

    const flagMatches =
      state.filter.selectedFlag === "Összes" ||
      flags.includes(state.filter.selectedFlag);

    const iconMatches =
      state.filter.selectedIcon === "Összes" ||
      icons.includes(state.filter.selectedIcon);

    return colorMatches && flagMatches && iconMatches;
  });
}

function resetCardFilters() {
  state.filter.selectedColors = [];
  state.filter.selectedFlag = "Összes";
  state.filter.selectedIcon = "Összes";

  const flagSelect = document.getElementById("flagSelect");
  const iconSelect = document.getElementById("iconSelect");

  if (flagSelect) {
    flagSelect.value = "Összes";
  }

  if (iconSelect) {
    iconSelect.value = "Összes";
  }

  updateColorFilterButtons();
}

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
    ${colors.map((color) => `
      <button
        type="button"
        class="color-filter-button"
        data-color="${escapeHtml(color)}"
        title="${escapeHtml(color)}"
        aria-label="${escapeHtml(color)}"
        style="--filter-color: ${colorMap[color]}"
      ></button>
    `).join("")}
  `;

  container.querySelectorAll(".color-filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      const color = button.dataset.color;

      if (!color) {
        state.filter.selectedColors = [];
      } else if (state.filter.selectedColors.includes(color)) {
        state.filter.selectedColors = state.filter.selectedColors.filter((item) => item !== color);
      } else {
        state.filter.selectedColors.push(color);
      }

      updateColorFilterButtons();
      refreshCardsView();
    });
  });

  updateColorFilterButtons();
}

function updateColorFilterButtons() {
  document.querySelectorAll(".color-filter-button").forEach((button) => {
    const color = button.dataset.color;

    if (!color) {
      button.classList.toggle("active", state.filter.selectedColors.length === 0);
      return;
    }

    button.classList.toggle("active", state.filter.selectedColors.includes(color));
  });
}

function renderFlagFilter(cards) {
  const select = document.getElementById("flagSelect");

  if (!select) {
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

  const sortedFlags = Array.from(flags).sort((a, b) => a.localeCompare(b, "hu"));

  select.innerHTML = `
    <option value="Összes">Összes</option>
    ${sortedFlags.map((flag) => `<option value="${escapeHtml(flag)}">${escapeHtml(flag)}</option>`).join("")}
  `;

  select.value = state.filter.selectedFlag;
  select.onchange = () => {
    state.filter.selectedFlag = select.value;
    refreshCardsView();
  };
}

function renderIconFilter(cards) {
  const select = document.getElementById("iconSelect");

  if (!select) {
    return;
  }

  const icons = new Set();

  cards.forEach((card) => {
    getArrayValue(card.icons).forEach((icon) => {
      if (icon) {
        icons.add(icon);
      }
    });
  });

  const sortedIcons = Array.from(icons).sort((a, b) => a.localeCompare(b, "hu"));

  select.innerHTML = `
    <option value="Összes">Összes</option>
    ${sortedIcons.map((icon) => `<option value="${escapeHtml(icon)}">${escapeHtml(icon)}</option>`).join("")}
  `;

  select.value = state.filter.selectedIcon;
  select.onchange = () => {
    state.filter.selectedIcon = select.value;
    refreshCardsView();
  };
}

// ======================================
// Adatösszesítések
// ======================================

function addCount(target, key, value) {
  if (!key || key === "Nincs" || value <= 0) {
    return;
  }

  target[key] = (target[key] || 0) + value;
}

function getColorCounts(cards, valueKey) {
  const counts = {};

  cards.forEach((card) => {
    const value = getCardValue(card, valueKey);
    getArrayValue(card.color).forEach((color) => addCount(counts, color, value));
  });

  return counts;
}

function getTypeCounts(cards, valueKey) {
  const counts = {};

  cards.forEach((card) => {
    const firstType = getArrayValue(card.type)[0];

    if (firstType === "Követő") {
      return;
    }

    addCount(counts, firstType, getCardValue(card, valueKey));
  });

  return counts;
}

function getEditionCounts(cards, valueKey) {
  const counts = {};

  cards.forEach((card) => {
    addCount(counts, card.edition, getCardValue(card, valueKey));
  });

  return counts;
}

function getArrayPropertyCounts(cards, propertyName, valueKey) {
  const counts = {};

  cards.forEach((card) => {
    const value = getCardValue(card, valueKey);
    getArrayValue(card[propertyName]).forEach((item) => addCount(counts, item, value));
  });

  return counts;
}

function getOrangeTypeCounts(cards, valueKey) {
  const counts = {};

  cards.forEach((card) => {
    addCount(counts, card.orangeType, getCardValue(card, valueKey));
  });

  return counts;
}

function prepareChartData(counts, palette = goldPalette, colorResolver = null) {
  const entries = Object.entries(counts)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => b[1] - a[1]);

  const labels = entries.map(([label]) => label);
  const values = entries.map(([, value]) => value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const colors = labels.map((label, index) => {
    if (colorResolver) {
      return colorResolver(label, index);
    }

    return palette[index % palette.length];
  });

  return { labels, values, total, colors };
}

// ======================================
// Chartok
// ======================================

function getChartFontSize() {
  return window.innerWidth < 580 ? 9 : 11;
}

function createBarChart(canvasId, chartData, horizontal = false) {
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    return;
  }

  destroyChart(canvasId);

  charts[canvasId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: chartData.labels,
      datasets: [{
        data: chartData.values,
        backgroundColor: chartData.colors,
        borderColor: chartData.values.map(() => "rgba(240, 215, 120, 0.92)"),
        borderWidth: 1.6,
        borderRadius: 5,
        borderSkipped: false,
        maxBarThickness: 46
      }]
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 420
      },
      layout: {
        padding: {
          top: 20,
          right: horizontal ? 50 : 12,
          bottom: 4,
          left: 4
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#161510",
          borderColor: "#5f4d1e",
          borderWidth: 1,
          titleColor: "#f6f1e4",
          bodyColor: "#cbc1ab",
          padding: 12,
          callbacks: {
            label: (context) => {
              const value = Number(context.raw) || 0;
              return `${formatNumber(value)} · ${formatPercent(getShare(value, chartData.total))}`;
            }
          }
        },
        datalabels: {
          display: (context) => getShare(context.dataset.data[context.dataIndex], chartData.total) >= 2,
          color: "#f0d778",
          anchor: "end",
          align: "end",
          offset: 3,
          clamp: true,
          clip: false,
          font: {
            size: getChartFontSize(),
            weight: "700"
          },
          formatter: (value) => formatPercent(getShare(value, chartData.total))
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            display: horizontal,
            color: "rgba(216, 180, 83, 0.07)"
          },
          border: { display: false },
          ticks: {
            display: horizontal ? false : true,
            color: "#918977",
            autoSkip: false,
            maxRotation: window.innerWidth < 580 ? 45 : 25,
            minRotation: 0,
            font: { size: getChartFontSize() }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            display: !horizontal,
            color: "rgba(216, 180, 83, 0.07)"
          },
          border: { display: false },
          ticks: {
            display: horizontal,
            color: "#aaa18f",
            autoSkip: false,
            font: { size: getChartFontSize() }
          }
        }
      }
    }
  });
}

function createOrangeDoughnutChart(chartData) {
  const canvasId = "orangeChart";
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    return;
  }

  destroyChart(canvasId);

  charts[canvasId] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: chartData.labels,
      datasets: [{
        data: chartData.values,
        backgroundColor: chartData.colors,
        borderColor: "#11110f",
        borderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      animation: { duration: 450 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#161510",
          borderColor: "#5f4d1e",
          borderWidth: 1,
          titleColor: "#f6f1e4",
          bodyColor: "#cbc1ab",
          padding: 12,
          callbacks: {
            label: (context) => {
              const value = Number(context.raw) || 0;
              return `${context.label}: ${formatNumber(value)} · ${formatPercent(getShare(value, chartData.total))}`;
            }
          }
        },
        datalabels: {
          display: (context) => getShare(context.dataset.data[context.dataIndex], chartData.total) >= 5,
          color: "#080807",
          font: {
            size: window.innerWidth < 580 ? 10 : 12,
            weight: "900"
          },
          formatter: (value) => formatPercent(getShare(value, chartData.total), 0)
        }
      }
    }
  });
}

function renderOrangeLegend(chartData) {
  const container = document.getElementById("orangeLegend");

  if (!container) {
    return;
  }

  if (chartData.labels.length === 0) {
    container.innerHTML = `<p class="empty-state">Nincs megjeleníthető adat.</p>`;
    return;
  }

  container.innerHTML = chartData.labels.map((label, index) => {
    const value = chartData.values[index];
    const share = getShare(value, chartData.total);

    return `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${chartData.colors[index]}"></span>
        <span class="legend-name">${escapeHtml(label)}</span>
        <span class="legend-value">
          ${formatNumber(value)}
          <small>${formatPercent(share)}</small>
        </span>
      </div>
    `;
  }).join("");
}

// ======================================
// Rangsorok
// ======================================

function getRankedCardsWithTies(cards, valueKey, limit = 10) {
  const validCards = cards
    .filter(isRenderableOrangeCard)
    .filter((card) => getRankingValue(card, valueKey) > 0)
    .sort((a, b) => getRankingValue(b, valueKey) - getRankingValue(a, valueKey));

  const rankedCards = [];
  let previousValue = null;
  let currentRank = 0;

  validCards.forEach((card, index) => {
    const value = getRankingValue(card, valueKey);

    if (value !== previousValue) {
      currentRank = index + 1;
      previousValue = value;
    }

    if (currentRank <= limit) {
      rankedCards.push({ card, rank: currentRank, value });
    }
  });

  return rankedCards;
}

function renderBestOrangeCards(cards) {
  const container = document.getElementById("bestOrangeCards");

  if (!container) {
    return;
  }

  const valueKey = state.orangeValueKey;
  const rankedCards = getRankedCardsWithTies(cards, valueKey, 10);
  const total = sumCardValues(cards.filter(isRenderableOrangeCard), valueKey);

  if (rankedCards.length === 0) {
    container.innerHTML = `<p class="empty-state">Nincs megjeleníthető narancslap ebben a formátumban.</p>`;
    return;
  }

  container.innerHTML = rankedCards.map(({ card, rank, value }) => {
    const parts = getArrayValue(card.orangeParts).length > 0 ? card.orangeParts : [card];
    const isCombo = card.orangeType === "Szabálylap + Követő" || parts.length > 1;
    const names = parts.length > 1
      ? parts.map((part) => `<div>${escapeHtml(part.name)}</div>`).join("")
      : escapeHtml(card.name || card.Lap || "Narancslap");

    const images = parts
      .filter(isRenderableCard)
      .map((part) => `
        <a href="${getCardPageUrl(part)}" target="_blank" rel="noopener noreferrer" class="best-orange-image-link">
          <img src="${getCardImageUrl(part)}" alt="${escapeHtml(part.name)}" class="card-image" loading="lazy">
        </a>
      `)
      .join("");

    return `
      <article class="best-orange-card ${isCombo ? "is-orange-combo" : ""} rank-${rank}">
        <div class="best-orange-rank">
          <span class="rank-number">${rank}.</span>
        </div>
        <div class="best-orange-images">${images}</div>
        <div class="best-orange-info">
          <div class="best-orange-name">${names}</div>
          <div class="best-orange-type">${escapeHtml(card.orangeType || "Narancslap")}</div>
          <div class="card-stat-line">
            <span class="card-stat-value">${formatNumber(value)}</span>
            <span class="card-stat-share">${formatPercent(getShare(value, total))} az összesből</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function getRankedTopCards(cards, valueKey, limit = 100) {
  const validCards = cards
    .filter(isRenderableCard)
    .filter((card) => getRankingValue(card, valueKey) > 0)
    .sort((a, b) => getRankingValue(b, valueKey) - getRankingValue(a, valueKey));

  const result = [];
  let previousValue = null;
  let currentRank = 0;

  validCards.forEach((card, index) => {
    const value = getRankingValue(card, valueKey);

    if (value !== previousValue) {
      currentRank = index + 1;
      previousValue = value;
    }

    if (currentRank <= limit) {
      result.push({ card, rank: currentRank, value });
    }
  });

  return result;
}

function renderTopCards(cards, valueKey) {
  const container = document.getElementById("top10Cards");

  if (!container) {
    return;
  }

  const total = sumCardValues(cards, valueKey);
  const rankedCards = getRankedTopCards(cards, valueKey, 100);

  if (rankedCards.length === 0) {
    container.innerHTML = `<p class="empty-state">Az aktív szűrőkkel nincs megjeleníthető lap.</p>`;
    return;
  }

  container.innerHTML = rankedCards.map(({ card, rank, value }) => `
    <article class="top-card">
      <span class="top-card-rank">${rank}.</span>
      <a class="top-card-link" href="${getCardPageUrl(card)}" target="_blank" rel="noopener noreferrer">
        <img src="${getCardImageUrl(card)}" alt="${escapeHtml(card.name)}" class="card-image" loading="lazy">
        <div class="top-card-info">
          <div class="top-card-name">${escapeHtml(card.name)}</div>
          <div class="top-card-stats">
            <span class="top-card-value">${formatNumber(value)}</span>
            <span class="top-card-share">${formatPercent(getShare(value, total))}</span>
          </div>
        </div>
      </a>
    </article>
  `).join("");
}

// ======================================
// Narancslap nézet frissítése
// ======================================

function refreshOrangeView() {
  const cards = state.orangeCards;
  const valueKey = state.orangeValueKey;
  const valueLabel = valueLabels[valueKey] || valueKey;
  const renderableCards = cards.filter(isRenderableOrangeCard);
  const total = sumCardValues(renderableCards, valueKey);
  setText("orangeChartHeading", `Narancslaptípusok – ${valueLabel}`);
  setText("orangeChartMeta", `${formatNumber(total)} összérték`);
  setText("orangeRankingTitle", `Leggyakoribb narancslapok – ${valueLabel}`);

  const chartData = prepareChartData(getOrangeTypeCounts(cards, valueKey), orangePalette);
  createOrangeDoughnutChart(chartData);
  renderOrangeLegend(chartData);
  renderBestOrangeCards(cards);
}

// ======================================
// TOP100 nézet frissítése
// ======================================

function updateCardsCharts(cards, valueKey) {
  createBarChart(
    "colorChart",
    prepareChartData(
      getColorCounts(cards, valueKey),
      goldPalette,
      (label) => colorMap[label] || goldPalette[0]
    )
  );
  createBarChart("typeChart", prepareChartData(getTypeCounts(cards, valueKey)));
  createBarChart("functionChart", prepareChartData(getArrayPropertyCounts(cards, "flag", valueKey)));
  createBarChart("subtypeChart", prepareChartData(getArrayPropertyCounts(cards, "subtypes", valueKey)), true);
  createBarChart("iconChart", prepareChartData(getArrayPropertyCounts(cards, "icons", valueKey)));
  createBarChart("editionChart", prepareChartData(getEditionCounts(cards, valueKey)), true);
}

function refreshCardsView() {
  const filteredCards = getSelectedCards(state.allCards);
  const valueKey = state.filter.valueKey;
  const positiveCards = filteredCards.filter((card) => getCardValue(card, valueKey) > 0);
  const total = sumCardValues(positiveCards, valueKey);
  const valueLabel = valueLabels[valueKey] || valueKey;

  setText("cardsResultCount", formatNumber(positiveCards.length));
  setText("chartsMetricMeta", `${valueLabel} · ${formatNumber(total)} összérték`);
  setText("topCardsTitle", `TOP100 lap – ${valueLabel}`);

  updateCardsCharts(filteredCards, valueKey);
  renderTopCards(filteredCards, valueKey);
}

// ======================================
// Adatbetöltés
// ======================================

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Sikertelen kérés: ${response.status}`);
  }

  return response.json();
}

async function loadDashboardData() {
  setText("dataPeriod", "Betöltés…");

  try {
    const [formatInfo, cards, orangeCards] = await Promise.all([
      fetchJson(`/api/format-info?format=${state.currentFormat}`),
      fetchJson(`/api/cards?format=${state.currentFormat}`),
      fetchJson(`/api/orange-cards?format=${state.currentFormat}`)
    ]);

    state.allCards = Array.isArray(cards) ? cards : [];
    state.orangeCards = Array.isArray(orangeCards) ? orangeCards : [];

    setText("dataPeriod", formatInfo.period || "Nincs megadva");

    renderColorFilters(state.allCards);
    renderFlagFilter(state.allCards);
    renderIconFilter(state.allCards);

    if (state.currentView === "orange") {
      refreshOrangeView();
    } else {
      refreshCardsView();
    }
  } catch (error) {
    console.error("Adatbetöltési hiba:", error);
    setText("dataPeriod", "Az adatok nem tölthetők be");
    showError("bestOrangeCards", "Az adatok betöltése sikertelen. Ellenőrizd a szervert és az API-végpontokat.");
    showError("top10Cards", "Az adatok betöltése sikertelen. Ellenőrizd a szervert és az API-végpontokat.");
  }
}

// ======================================
// Indítás
// ======================================

setupViewNavigation();
setupFormatSwitcher();
setupMetricSwitchers();
loadDashboardData();

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    Object.values(charts).forEach((chart) => chart.resize());
  }, 120);
});
