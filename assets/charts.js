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
 * Einfaches Liniendiagramm mit Nulllinie und Break-even-Marker (fuer die Nullrechnung).
 * points: [{x: Anzahl, y: Ergebnis}]
 */
function breakEvenChart(container, { points, breakEvenX, color = "var(--series-1)", height = 260 }) {
  const width = Math.max(560, container.clientWidth || 640);
  const marginL = 70, marginR = 20, marginT = 20, marginB = 32;
  const plotW = width - marginL - marginR;
  const plotH = height - marginT - marginB;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const maxX = Math.max(...xs, 1);
  const maxAbsY = niceMax(Math.max(...ys.map(Math.abs), 1));
  const minY = -maxAbsY, maxY = maxAbsY;

  const x = (v) => marginL + (v / maxX) * plotW;
  const y = (v) => marginT + plotH - ((v - minY) / (maxY - minY)) * plotH;

  const svg = el("svg", { class: "chart", viewBox: `0 0 ${width} ${height}`, width: "100%", height });

  [minY, minY / 2, 0, maxY / 2, maxY].forEach((v) => {
    const gy = y(v);
    el("line", { class: "grid-line", x1: marginL, x2: width - marginR, y1: gy, y2: gy }, svg);
    el("text", { class: "tick-label", x: marginL - 8, y: gy + 4, "text-anchor": "end" }, svg).textContent = fmtEUR(v);
  });

  // Nulllinie betont
  el("line", { class: "baseline", x1: marginL, x2: width - marginR, y1: y(0), y2: y(0), "stroke-width": 1.5 }, svg);

  [0, maxX * 0.25, maxX * 0.5, maxX * 0.75, maxX].forEach((v) => {
    el("text", { class: "tick-label", x: x(v), y: height - 8, "text-anchor": "middle" }, svg).textContent = fmtNum(v);
  });

  const d = points.map((p, i) => (i === 0 ? "M" : "L") + x(p.x).toFixed(1) + "," + y(p.y).toFixed(1)).join(" ");
  el("path", { d, fill: "none", stroke: color, "stroke-width": 2.5, "stroke-linecap": "round" }, svg);

  // Hover-Layer: Crosshair + Tooltip, Wert linear zwischen den Stuetzpunkten interpoliert.
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const interpolateY = (vx) => {
    if (vx <= sorted[0].x) return sorted[0].y;
    if (vx >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (vx >= a.x && vx <= b.x) {
        const t = (vx - a.x) / (b.x - a.x);
        return a.y + t * (b.y - a.y);
      }
    }
    return 0;
  };
  const crosshair = el("line", {
    x1: 0, x2: 0, y1: marginT, y2: marginT + plotH, stroke: "var(--text-muted)",
    "stroke-width": 1, opacity: 0,
  }, svg);
  const hoverDot = el("circle", { r: 4, fill: color, opacity: 0 }, svg);
  const overlay = el("rect", {
    x: marginL, y: marginT, width: plotW, height: plotH, fill: "transparent", style: "cursor:crosshair",
  }, svg);
  overlay.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const scale = width / rect.width;
    const px = (e.clientX - rect.left) * scale;
    const vx = Math.max(0, Math.min(maxX, ((px - marginL) / plotW) * maxX));
    const vy = interpolateY(vx);
    crosshair.setAttribute("x1", x(vx));
    crosshair.setAttribute("x2", x(vx));
    crosshair.setAttribute("opacity", 1);
    hoverDot.setAttribute("cx", x(vx));
    hoverDot.setAttribute("cy", y(vy));
    hoverDot.setAttribute("opacity", 1);
    showTooltip(e, `${fmtNum(vx)} Getränke<br><b>Ergebnis: ${fmtEUR(vy)}</b>`);
  });
  overlay.addEventListener("mouseleave", () => {
    crosshair.setAttribute("opacity", 0);
    hoverDot.setAttribute("opacity", 0);
    hideTooltip();
  });

  if (breakEvenX !== null && breakEvenX <= maxX) {
    const bx = x(breakEvenX);
    el("line", {
      x1: bx, x2: bx, y1: marginT, y2: marginT + plotH, stroke: "var(--text-muted)",
      "stroke-width": 1, "stroke-dasharray": "4 4",
    }, svg);
    el("circle", { cx: bx, cy: y(0), r: 5, fill: "var(--good)" }, svg);
    const label = el("text", {
      class: "tick-label", x: bx, y: marginT - 4, "text-anchor": breakEvenX > maxX * 0.75 ? "end" : "middle",
      fill: "var(--text-primary)", "font-weight": "600",
    }, svg);
    label.textContent = `Break-even: ${fmtNum(breakEvenX)} Getränke`;
  }

  container.innerHTML = "";
  container.appendChild(svg);
}
