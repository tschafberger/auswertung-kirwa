// Darstellung der vergangenen Kirwa-Zahlen aus assets/data.js (generiert aus data/kirwa_daten.csv).

function yoyDelta(current, previous) {
  if (current === undefined || previous === undefined || previous === 0) return null;
  return (current - previous) / previous;
}

function deltaBadge(current, previous, invert = false) {
  const d = yoyDelta(current, previous);
  if (d === null) return "";
  const good = invert ? d < 0 : d > 0;
  const arrow = d >= 0 ? "▲" : "▼";
  return `<span class="delta ${good ? "good" : "critical"}">${arrow} ${(d * 100).toFixed(1).replace(".", ",")}% ggü. Vorjahr</span>`;
}

function statTile(label, value, current, previous) {
  const tile = document.createElement("div");
  tile.className = "stat-tile";
  tile.innerHTML = `
    <div class="label">${label}</div>
    <div class="value">${value}</div>
    ${deltaBadge(current, previous)}
  `;
  return tile;
}

function buildDataTable(rowNames, years, dataByName, totalRowName, totalValues) {
  const wrap = document.createElement("div");
  wrap.className = "table-scroll";
  const table = document.createElement("table");
  table.className = "data-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Posten</th>${years.map((y) => `<th>${y}</th>`).join("")}</tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const name of rowNames) {
    const vals = dataByName[name] || {};
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td>${years.map((y) => `<td>${vals[y] !== undefined ? fmtEUR(vals[y]) : "–"}</td>`).join("")}`;
    tbody.appendChild(tr);
  }
  if (totalRowName) {
    const tr = document.createElement("tr");
    tr.className = "total-row";
    tr.innerHTML = `<td>${totalRowName}</td>${years.map((y) => `<td>${totalValues[y] !== undefined ? fmtEUR(totalValues[y]) : "–"}</td>`).join("")}`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderHistorie() {
  const D = window.KIRWA_DATA;
  const root = document.getElementById("view-historie");
  if (!D || !root) return;

  const allYears = D.years.map(String);
  const umsatzYears = allYears.filter((y) => D.umsatz_tag.Gesamtumsatz[y] !== undefined);
  const latestYear = umsatzYears[umsatzYears.length - 1];
  const prevYear = umsatzYears[umsatzYears.length - 2];

  const gesamtkosten = D.kosten_lieferant["Gesamtkosten Kirwa"] || {};
  const gewinn = D.ergebnis["Gewinn (vor Steuer, inkl. Spenden)"] || {};

  root.innerHTML = "";

  // --- KPI-Kacheln ---
  const statRow = document.createElement("div");
  statRow.className = "stat-row";
  statRow.appendChild(
    statTile(`Umsatz ${latestYear}`, fmtEUR(D.umsatz_tag.Gesamtumsatz[latestYear]), D.umsatz_tag.Gesamtumsatz[latestYear], D.umsatz_tag.Gesamtumsatz[prevYear])
  );
  statRow.appendChild(
    statTile(`Gesamtkosten ${latestYear}`, fmtEUR(gesamtkosten[latestYear]), gesamtkosten[latestYear], gesamtkosten[prevYear])
  );
  statRow.appendChild(
    statTile(`Gewinn ${latestYear}`, fmtEUR(gewinn[latestYear]), gewinn[latestYear], gewinn[prevYear])
  );
  root.appendChild(statRow);

  // --- Chart A: Umsatz / Kosten / Gewinn je Jahr ---
  const cardA = document.createElement("div");
  cardA.className = "card";
  cardA.innerHTML = `<h2>Umsatz, Kosten und Gewinn je Jahr</h2>`;
  const chartA = document.createElement("div");
  chartA.className = "chart-wrap";
  cardA.appendChild(chartA);
  root.appendChild(cardA);
  lineChart(chartA, {
    categories: allYears,
    series: [
      { name: "Umsatz", color: "var(--series-1)", values: D.umsatz_tag.Gesamtumsatz },
      { name: "Gesamtkosten", color: "var(--series-2)", values: gesamtkosten },
      { name: "Gewinn", color: "var(--series-3)", values: gewinn },
    ],
  });

  // --- Chart B: Umsatz nach Wochentag je Jahr ---
  const cardB = document.createElement("div");
  cardB.className = "card";
  cardB.innerHTML = `<h2>Umsatz nach Wochentag</h2>`;
  const chartB = document.createElement("div");
  chartB.className = "chart-wrap";
  cardB.appendChild(chartB);
  root.appendChild(cardB);
  const dayCats = ["Donnerstag", "Freitag", "Samstag", "Sonntag"];
  const yearColors = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
  groupedBarChart(chartB, {
    categories: dayCats,
    series: umsatzYears.map((y, i) => ({
      name: y,
      color: yearColors[i % yearColors.length],
      values: Object.fromEntries(dayCats.map((d) => [d, (D.umsatz_tag[d] || {})[y]])),
    })),
  });

  // --- Chart C: Umsatz nach Bereich je Jahr (gestapelt) ---
  const cardC = document.createElement("div");
  cardC.className = "card";
  cardC.innerHTML = `<h2>Umsatz nach Bereich</h2>`;
  const chartC = document.createElement("div");
  chartC.className = "chart-wrap";
  cardC.appendChild(chartC);
  root.appendChild(cardC);
  const bereichNames = Object.keys(D.umsatz_bereich).filter((n) => n !== "Summe Bereiche");
  const bereichColors = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];
  stackedBarChart(chartC, {
    categories: umsatzYears,
    series: bereichNames.map((n, i) => ({ name: n, color: bereichColors[i % bereichColors.length], values: D.umsatz_bereich[n] })),
  });

  // --- Tabelle: Kosten nach Lieferant ---
  const cardD = document.createElement("div");
  cardD.className = "card";
  cardD.innerHTML = `<h2>Kosten nach Lieferant / Posten</h2>`;
  const supplierNames = Object.keys(D.kosten_lieferant)
    .filter((n) => n !== "Gesamtkosten Kirwa")
    .sort((a, b) => (D.kosten_lieferant[b][latestYear] || 0) - (D.kosten_lieferant[a][latestYear] || 0));
  cardD.appendChild(buildDataTable(supplierNames, allYears, D.kosten_lieferant, "Gesamtkosten Kirwa", gesamtkosten));
  root.appendChild(cardD);

  // --- Tabelle: Musik-Kosten nach Band ---
  const cardE = document.createElement("div");
  cardE.className = "card";
  cardE.innerHTML = `<h2>Musik-Kosten nach Band</h2>`;
  const bandNames = Object.keys(D.musik_band)
    .filter((n) => n !== "Summe Musik (Bands)")
    .sort((a, b) => (D.musik_band[b][latestYear] || 0) - (D.musik_band[a][latestYear] || 0));
  cardE.appendChild(buildDataTable(bandNames, allYears, D.musik_band, "Summe Musik (Bands)", D.musik_band["Summe Musik (Bands)"]));
  root.appendChild(cardE);
}
