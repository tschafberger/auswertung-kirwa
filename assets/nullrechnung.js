// Nullrechnung / Break-even-Kalkulation mit Reglern.
// Ausgangswerte (EK/VK/Fixkosten) stammen aus data/KVE_Getraenke_Fest_Kalkulation_Regler.xlsx.

const FIXKOSTEN_DEFAULT = [
  { key: "freitag", name: "Freitag", value: 4703.86 },
  { key: "samstag", name: "Samstag", value: 4922.86 },
  { key: "sonntag", name: "Sonntag", value: 5343.87 },
  { key: "allgemein", name: "Allgemein", value: 19442.72 },
  { key: "helfer", name: "Helfer", value: 2112.05 },
  { key: "bereiche", name: "Bereiche (Kuchen, Grill, Bier/Weizen-Fix, Wein, Bar-Fix)", value: 8535.0 },
  { key: "sonstiges", name: "Sonstiges", value: 0 },
];

const DRINKS_DEFAULT = [
  { key: "bier", name: "Bier", ek: 1.38, vk: 8.2, anzahl: 3000 },
  { key: "weizen", name: "Weizen", ek: 0.69, vk: 5.0, anzahl: 4820 },
  { key: "afg", name: "AfG (Wasser)", ek: 0.46, vk: 2.9, anzahl: 1000 },
  { key: "weinglas", name: "Wein (Glas)", ek: 1.25, vk: 4.5, anzahl: 1888 },
  { key: "mische", name: "Mische (Jack Cola)", ek: 0.84, vk: 7.5, anzahl: 2666 },
  { key: "klopfer", name: "Klopfer (Herberts Nuss)", ek: 0.52, vk: 3.0, anzahl: 2000 },
];

const SLIDER_MAX = 10000;
const SLIDER_STEP = 10;
const drinkColors = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

const state = {
  fixkosten: FIXKOSTEN_DEFAULT.map((f) => ({ ...f })),
  drinks: DRINKS_DEFAULT.map((d) => ({ ...d })),
};

function fixkostenTotal() {
  return state.fixkosten.reduce((sum, f) => sum + (Number(f.value) || 0), 0);
}

function drinkMargin(d) {
  return Number(d.vk) - Number(d.ek);
}

function computeTotals() {
  const fix = fixkostenTotal();
  let anzahl = 0, umsatz = 0, ekSumme = 0, db = 0;
  for (const d of state.drinks) {
    const a = Number(d.anzahl) || 0;
    anzahl += a;
    umsatz += a * Number(d.vk);
    ekSumme += a * Number(d.ek);
    db += a * drinkMargin(d);
  }
  const gesamtkosten = fix + ekSumme;
  const ergebnis = umsatz - gesamtkosten;
  return { fix, anzahl, umsatz, ekSumme, db, gesamtkosten, ergebnis };
}

function renderFixkostenPanel(container) {
  const details = document.createElement("details");
  details.className = "calc-settings";
  details.innerHTML = `<summary>Fixkosten-Aufschlüsselung anzeigen / anpassen</summary>`;
  const grid = document.createElement("div");
  grid.className = "fixkosten-grid";
  state.fixkosten.forEach((f) => {
    const label = document.createElement("label");
    label.innerHTML = `${f.name}`;
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.01";
    input.value = f.value;
    input.addEventListener("input", () => {
      f.value = parseFloat(input.value) || 0;
      recalc();
    });
    label.appendChild(input);
    grid.appendChild(label);
  });
  details.appendChild(grid);
  container.appendChild(details);
}

function renderDrinkRow(d, idx) {
  const row = document.createElement("div");
  row.className = "drink-row";

  const nameCell = document.createElement("div");
  nameCell.innerHTML = `
    <div class="drink-name" style="color:${drinkColors[idx % drinkColors.length]}">${d.name}</div>
    <div class="ekvk-row">
      <label>EK <input type="number" step="0.01" value="${d.ek}" data-field="ek"></label>
      <label>VK <input type="number" step="0.01" value="${d.vk}" data-field="vk"></label>
    </div>
  `;
  nameCell.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", () => {
      d[inp.dataset.field] = parseFloat(inp.value) || 0;
      recalc();
    });
  });

  const sliderCell = document.createElement("div");
  sliderCell.className = "slider-cell";
  sliderCell.innerHTML = `
    <input type="range" min="0" max="${SLIDER_MAX}" step="${SLIDER_STEP}" value="${d.anzahl}" data-role="range">
    <div class="slider-readout">
      <span>Anzahl verkauft</span>
      <input type="number" min="0" max="${SLIDER_MAX}" value="${d.anzahl}" data-role="number">
    </div>
  `;
  const range = sliderCell.querySelector('[data-role="range"]');
  const number = sliderCell.querySelector('[data-role="number"]');
  range.addEventListener("input", () => {
    d.anzahl = Number(range.value);
    number.value = d.anzahl;
    recalc();
  });
  number.addEventListener("input", () => {
    d.anzahl = Number(number.value) || 0;
    if (d.anzahl <= SLIDER_MAX) range.value = d.anzahl;
    recalc();
  });

  const resultCell = document.createElement("div");
  resultCell.className = "result-cell";
  resultCell.dataset.resultFor = d.key;

  row.appendChild(nameCell);
  row.appendChild(sliderCell);
  row.appendChild(resultCell);
  return row;
}

function updateDrinkResults() {
  for (const d of state.drinks) {
    const cell = document.querySelector(`[data-result-for="${d.key}"]`);
    if (!cell) continue;
    const umsatz = d.anzahl * d.vk;
    const db = d.anzahl * drinkMargin(d);
    cell.innerHTML = `
      <div class="umsatz">Umsatz: ${fmtEURPrecise(umsatz)}</div>
      <div class="db">DB: ${fmtEURPrecise(db)}</div>
    `;
  }
}

function renderStatusBanner(container, totals) {
  const good = totals.ergebnis >= 0;
  const banner = document.createElement("div");
  banner.className = `status-banner ${good ? "good" : "critical"}`;
  if (good) {
    banner.innerHTML = `<span>✓ Fixkosten gedeckt — Überschuss:</span><span class="big">${fmtEUR(totals.ergebnis)}</span>`;
  } else {
    let extra = "";
    const avgMargin = totals.anzahl > 0 ? totals.db / totals.anzahl : 0;
    if (avgMargin > 0) {
      const weitere = Math.ceil(-totals.ergebnis / avgMargin);
      extra = ` (bei gleicher Getränke-Mischung noch ca. ${fmtNum(weitere)} Getränke nötig)`;
    }
    banner.innerHTML = `<span>✗ Fixkosten noch nicht gedeckt — es fehlen:</span><span class="big">${fmtEUR(-totals.ergebnis)}</span><span style="font-weight:400">${extra}</span>`;
  }
  container.appendChild(banner);
}

function renderSummaryTiles(container, totals) {
  const row = document.createElement("div");
  row.className = "stat-row";
  const tiles = [
    ["Fixkosten gesamt", fmtEUR(totals.fix)],
    ["Verkaufte Getränke", fmtNum(totals.anzahl)],
    ["Umsatz Getränke", fmtEUR(totals.umsatz)],
    ["Deckungsbeitrag gesamt", fmtEUR(totals.db)],
    ["Gesamtkosten (Fix + Einkauf)", fmtEUR(totals.gesamtkosten)],
    ["Ergebnis", fmtEUR(totals.ergebnis)],
  ];
  for (const [label, value] of tiles) {
    const tile = document.createElement("div");
    tile.className = "stat-tile";
    tile.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    row.appendChild(tile);
  }
  container.appendChild(row);
}

function renderBreakevenList(container) {
  const wrap = document.createElement("div");
  wrap.className = "breakeven-list";
  const fix = fixkostenTotal();
  for (const d of state.drinks) {
    const margin = drinkMargin(d);
    const item = document.createElement("div");
    item.className = "item";
    if (margin <= 0) {
      item.innerHTML = `${d.name}: <b>nie im Plus</b> (VK ≤ EK)`;
    } else {
      const units = Math.ceil(fix / margin);
      item.innerHTML = `${d.name}: im Plus ab <b>${fmtNum(units)} Stk.</b> <span style="color:var(--text-muted)">(wenn nur ${d.name} verkauft würde)</span>`;
    }
    wrap.appendChild(item);
  }
  container.appendChild(wrap);
}

function renderChart(container, totals) {
  meterChart(container, {
    value: totals.umsatz,
    target: totals.gesamtkosten,
    good: totals.ergebnis >= 0,
    valueLabel: "Umsatz Getränke",
    targetLabel: "Gesamtkosten (Fix + Einkauf)",
    targetShort: "Gesamtkosten",
  });
}

function recalc() {
  const totals = computeTotals();
  updateDrinkResults();

  const statusWrap = document.getElementById("null-status");
  statusWrap.innerHTML = "";
  renderStatusBanner(statusWrap, totals);

  const summaryWrap = document.getElementById("null-summary");
  summaryWrap.innerHTML = "";
  renderSummaryTiles(summaryWrap, totals);

  const breakevenWrap = document.getElementById("null-breakeven-list");
  breakevenWrap.innerHTML = "";
  renderBreakevenList(breakevenWrap);

  const chartWrap = document.getElementById("null-chart");
  renderChart(chartWrap, totals);
}

function renderNullrechnung() {
  const root = document.getElementById("view-nullrechnung");
  if (!root) return;
  root.innerHTML = `
    <div id="null-status"></div>
    <div id="null-summary"></div>

    <div class="card">
      <h2>Fixkosten</h2>
      <div id="null-fixkosten"></div>
    </div>

    <div class="card">
      <h2>Getränke — Anzahl mit Regler einstellen</h2>
      <div id="null-drinks"></div>
    </div>

    <div class="card">
      <h2>Wie weit bin ich von der Nullrechnung entfernt?</h2>
      <p style="color:var(--text-secondary); font-size:0.85rem; margin-top:-4px;">
        Balken = Umsatz deiner aktuellen Reglereinstellung. Strich = Gesamtkosten (Fixkosten + Einkaufspreise der
        verkauften Getränke) - der Strich wandert also mit, wenn du mehr Getränke einstellst, da auch mehr
        eingekauft werden muss. Der Text darüber zeigt, wie weit Umsatz und Gesamtkosten auseinanderliegen.
      </p>
      <div class="chart-wrap" id="null-chart"></div>
    </div>

    <div class="card">
      <h2>Break-even je Getränkesorte</h2>
      <div id="null-breakeven-list"></div>
    </div>
  `;

  renderFixkostenPanel(document.getElementById("null-fixkosten"));
  const drinksWrap = document.getElementById("null-drinks");
  state.drinks.forEach((d, i) => drinksWrap.appendChild(renderDrinkRow(d, i)));

  recalc();
}
