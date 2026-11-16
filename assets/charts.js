// Kleine, abhaengigkeitsfreie SVG-Chart-Helfer (Liniendiagramm, gruppierte und gestapelte Balken).
// Bewusst ohne externe Bibliothek, damit die Seite auch offline per Doppelklick funktioniert.

const fmtEUR = (v) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtEURPrecise = (v) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
const fmtNum = (v) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(v);

function niceMax(max) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / exp;
  let step;
  if (n <= 1) step = 1;
  else if (n <= 2) step = 2;
  else if (n <= 5) step = 5;
  else step = 10;
  return step * exp;
}

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function ensureTooltip() {
  let tip = document.querySelector(".chart-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "chart-tooltip";
    document.body.appendChild(tip);
  }
  return tip;
}

function showTooltip(evt, html) {
  const tip = ensureTooltip();
  tip.innerHTML = html;
  tip.style.opacity = "1";
  const pad = 14;
  tip.style.left = evt.clientX + pad + window.scrollX + "px";
  tip.style.top = evt.clientY + pad + window.scrollY + "px";
}

function hideTooltip() {
  const tip = document.querySelector(".chart-tooltip");
  if (tip) tip.style.opacity = "0";
}

function legend(container, items) {
  const wrap = document.createElement("div");
  wrap.className = "legend";
  for (const it of items) {
    const span = document.createElement("span");
    span.className = "item";
    span.innerHTML = `<span class="swatch" style="background:${it.color}"></span>${it.name}`;
    wrap.appendChild(span);
  }
  container.appendChild(wrap);
}

/**
 * Multi-Serien-Liniendiagramm. series: [{name, color, values: {label: number|undefined}}]
 * categories: geordnete Liste der Labels (z.B. Jahre).
 */
function lineChart(container, { categories, series, yFormat = fmtEUR, height = 280 }) {
  const width = Math.max(560, container.clientWidth || 640);
  const marginL = 64, marginR = 20, marginT = 16, marginB = 32;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;

  const allVals = series.flatMap((s) => categories.map((c) => s.values[c]).filter((v) => v !== undefined));
  const maxV = niceMax(Math.max(...allVals, 0));
  const minV = Math.min(0, ...allVals);

  const x = (i) => marginL + (categories.length <= 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
  const y = (v) => marginT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  const svg = el("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, width: "100%", height });

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = minV + ((maxV - minV) * i) / steps;
    const gy = y(v);
    el("line", { class: "grid-line", x1: marginL, x2: width - marginR, y1: gy, y2: gy }, svg);
    el("text", { class: "tick-label", x: marginL - 8, y: gy + 4, "text-anchor": "end" }, svg).textContent = yFormat(v);
  }
  el("line", { class: "baseline", x1: marginL, x2: width - marginR, y1: marginT + plotH, y2: marginT + plotH }, svg);

  categories.forEach((c, i) => {
    el("text", { class: "tick-label", x: x(i), y: height - 8, "text-anchor": "middle" }, svg).textContent = c;
  });

  for (const s of series) {
    const pts = categories.map((c, i) => (s.values[c] !== undefined ? [x(i), y(s.values[c])] : null)).filter(Boolean);
    if (pts.length === 0) continue;
    const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linecap": "round" }, svg);
    categories.forEach((c, i) => {
      if (s.values[c] === undefined) return;
      const cx = x(i), cy = y(s.values[c]);
      const dot = el("circle", { cx, cy, r: 4, fill: s.color, stroke: "var(--surface-1)", "stroke-width": 1.5 }, svg);
      dot.style.cursor = "pointer";
      dot.addEventListener("mousemove", (e) =>
        showTooltip(e, `<b>${c}</b><br>${s.name}: ${yFormat(s.values[c])}`)
      );
      dot.addEventListener("mouseleave", hideTooltip);
    });
  }

  container.innerHTML = "";
  container.appendChild(svg);
  if (series.length > 1) legend(container, series);
}

/**
 * Gruppierte Balken. categories = x-Achse (z.B. Wochentage), series = [{name,color,values:{cat:val}}]
 */
function groupedBarChart(container, { categories, series, yFormat = fmtEUR, height = 280 }) {
  const width = Math.max(560, container.clientWidth || 640);
  const marginL = 64, marginR = 20, marginT = 16, marginB = 32;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;

  const allVals = series.flatMap((s) => categories.map((c) => s.values[c] || 0));
  const maxV = niceMax(Math.max(...allVals, 1));
  const y = (v) => marginT + plotH - (v / maxV) * plotH;

  const groupW = plotW / categories.length;
  const barGap = 2;
  const barW = (groupW - 12) / series.length;

  const svg = el("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, width: "100%", height });

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = (maxV * i) / steps;
    const gy = y(v);
    el("line", { class: "grid-line", x1: marginL, x2: width - marginR, y1: gy, y2: gy }, svg);
    el("text", { class: "tick-label", x: marginL - 8, y: gy + 4, "text-anchor": "end" }, svg).textContent = yFormat(v);
  }
  el("line", { class: "baseline", x1: marginL, x2: width - marginR, y1: marginT + plotH, y2: marginT + plotH }, svg);

  categories.forEach((cat, ci) => {
    const groupX = marginL + ci * groupW + 6;
    el("text", {
      class: "tick-label", x: marginL + ci * groupW + groupW / 2, y: height - 8, "text-anchor": "middle",
    }, svg).textContent = cat;

    series.forEach((s, si) => {
      const v = s.values[cat] || 0;
      const bx = groupX + si * (barW + barGap);
      const by = y(v);
      const bh = marginT + plotH - by;
      const rect = el("rect", {
        x: bx, y: by, width: Math.max(barW - barGap, 1), height: Math.max(bh, 0),
        fill: s.color, rx: 3,
      }, svg);
      rect.style.cursor = "pointer";
      rect.addEventListener("mousemove", (e) => showTooltip(e, `<b>${cat} · ${s.name}</b><br>${yFormat(v)}`));
      rect.addEventListener("mouseleave", hideTooltip);
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
  legend(container, series);
}

/**
 * Gestapelte Balken je Kategorie (z.B. Jahr), Segmente = series.
 */
function stackedBarChart(container, { categories, series, yFormat = fmtEUR, height = 320 }) {
  const width = Math.max(560, container.clientWidth || 640);
  const marginL = 70, marginR = 20, marginT = 16, marginB = 32;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;

  const totals = categories.map((c) => series.reduce((sum, s) => sum + (s.values[c] || 0), 0));
  const maxV = niceMax(Math.max(...totals, 1));
  const y = (v) => marginT + plotH - (v / maxV) * plotH;

  const barW = Math.min(64, plotW / categories.length - 16);

  const svg = el("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, width: "100%", height });

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = (maxV * i) / steps;
    const gy = y(v);
    el("line", { class: "grid-line", x1: marginL, x2: width - marginR, y1: gy, y2: gy }, svg);
    el("text", { class: "tick-label", x: marginL - 8, y: gy + 4, "text-anchor": "end" }, svg).textContent = yFormat(v);
  }
  el("line", { class: "baseline", x1: marginL, x2: width - marginR, y1: marginT + plotH, y2: marginT + plotH }, svg);

  const slotW = plotW / categories.length;
  categories.forEach((cat, ci) => {
    const cx = marginL + ci * slotW + slotW / 2;
    el("text", { class: "tick-label", x: cx, y: height - 8, "text-anchor": "middle" }, svg).textContent = cat;

    let acc = 0;
    series.forEach((s) => {
      const v = s.values[cat] || 0;
      if (v === 0) return;
      const yTop = y(acc + v);
      const yBottom = y(acc);
      const rect = el("rect", {
        x: cx - barW / 2, y: yTop, width: barW, height: Math.max(yBottom - yTop - 2, 0),
        fill: s.color, rx: 2,
      }, svg);
      rect.style.cursor = "pointer";
      rect.addEventListener("mousemove", (e) => showTooltip(e, `<b>${cat} · ${s.name}</b><br>${yFormat(v)}`));
      rect.addEventListener("mouseleave", hideTooltip);
      acc += v;
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
  legend(container, series);
}

/**
 * Meter: zeigt einen Wert (z.B. erreichter Deckungsbeitrag) im Verhaeltnis zu
 * einem Zielwert (z.B. Fixkosten) als gefuellten Balken mit Ziel-Markierung.
 * Direkt an die aktuellen Reglerwerte gekoppelt - keine Hochrechnung/Extrapolation.
 */
function meterChart(container, { value, target, good, valueLabel = "Deckungsbeitrag", targetLabel = "Fixkosten", targetShort = targetLabel, height = 150 }) {
  const width = Math.max(560, container.clientWidth || 640);
  const marginL = 24, marginR = 24, marginT = 48;
  const plotW = width - marginL - marginR;
  const barH = 32;
  const barY = marginT;

  const maxV = niceMax(Math.max(value, target, 1));
  const x = (v) => marginL + (Math.min(Math.max(v, 0), maxV) / maxV) * plotW;

  const color = good ? "var(--good)" : "var(--critical)";
  const trackColor = `color-mix(in srgb, ${color} 14%, var(--surface-1))`;

  const svg = el("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, width: "100%", height });

  // Track (volle Skala) + Fuellung (aktueller Wert)
  el("rect", { x: marginL, y: barY, width: plotW, height: barH, rx: 8, fill: trackColor }, svg);
  const fillW = Math.max(x(value) - marginL, 0);
  const fillRect = el("rect", { x: marginL, y: barY, width: fillW, height: barH, rx: 8, fill: color }, svg);
  fillRect.style.cursor = "pointer";
  fillRect.addEventListener("mousemove", (e) => showTooltip(e, `<b>${valueLabel}</b><br>${fmtEUR(value)}`));
  fillRect.addEventListener("mouseleave", hideTooltip);

  // Ziel-Markierung (Fixkosten)
  const tx = x(target);
  el("line", {
    x1: tx, x2: tx, y1: barY - 10, y2: barY + barH + 10, stroke: "var(--text-primary)", "stroke-width": 2,
  }, svg);
  const targetHit = el("rect", {
    x: tx - 7, y: barY - 10, width: 14, height: barH + 20, fill: "transparent",
  }, svg);
  targetHit.style.cursor = "pointer";
  targetHit.addEventListener("mousemove", (e) => showTooltip(e, `<b>${targetLabel}</b><br>${fmtEUR(target)}`));
  targetHit.addEventListener("mouseleave", hideTooltip);

  const targetAnchor = tx > width - marginR - 70 ? "end" : tx < marginL + 70 ? "start" : "middle";
  el("text", {
    class: "tick-label", x: tx, y: barY + barH + 26, "text-anchor": targetAnchor,
  }, svg).textContent = `${targetLabel}: ${fmtEUR(target)}`;

  // Abstand zum Ziel - die eigentliche Antwort auf "wie weit darueber/darunter".
  const gap = value - target;
  const gapX = x(value);
  const gapAnchor = gapX > width - marginR - 90 ? "end" : gapX < marginL + 90 ? "start" : "middle";
  const gapText = el("text", {
    x: gapX, y: barY - 18, "text-anchor": gapAnchor, "font-weight": "700", "font-size": "15px", fill: color,
  }, svg);
  gapText.textContent = good
    ? `▲ ${fmtEUR(gap)} über den ${targetShort}`
    : `▼ ${fmtEUR(-gap)} unter den ${targetShort}`;

  container.innerHTML = "";
  container.appendChild(svg);
}
