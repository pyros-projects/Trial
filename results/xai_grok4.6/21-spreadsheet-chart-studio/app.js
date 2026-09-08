(function () {
  "use strict";
  var engine = SheetEngine.createEngine();
  var active = { col: 0, row: 1 };
  var sel = { c1: 0, r1: 1, c2: 0, r2: 1 };
  var selectedChartId = null;
  var editing = null;
  var barDirty = false;
  var draggingSel = false;
  var statusTimer = 0;
  var painted = Object.create(null);
  var suppressChartForm = false;

  var sheet = document.getElementById("sheet");
  var gridWrap = document.getElementById("grid-wrap");
  var editor = document.getElementById("cell-editor");
  var formulaBar = document.getElementById("formula-bar");
  var addrBox = document.getElementById("addr-box");
  var selStats = document.getElementById("sel-stats");
  var inspector = document.getElementById("inspector");
  var statusText = document.getElementById("status-text");
  var workbookName = document.getElementById("workbook-name");
  var chartSelect = document.getElementById("chart-select");
  var chartTitle = document.getElementById("chart-title");
  var chartType = document.getElementById("chart-type");
  var chartRange = document.getElementById("chart-range");
  var chartLegend = document.getElementById("chart-legend");
  var chartColors = document.getElementById("chart-colors");
  var chartSvgHost = document.getElementById("chart-svg-host");
  var chartEmpty = document.getElementById("chart-empty");
  var chartOmitted = document.getElementById("chart-omitted");
  var chartInspectLine = document.getElementById("chart-inspect-line");
  var chartTip = document.getElementById("chart-tip");
  var newChartRange = document.getElementById("new-chart-range");
  var newChartType = document.getElementById("new-chart-type");
  var btnUndo = document.getElementById("btn-undo");
  var btnRedo = document.getElementById("btn-redo");
  var modal = document.getElementById("modal");
  var modalTitle = document.getElementById("modal-title");
  var modalText = document.getElementById("modal-text");
  var modalMode = "json";

  function addrOf(col, row) {
    return SheetEngine.addrKey(col, row);
  }
  function activeAddr() {
    return addrOf(active.col, active.row);
  }
  function normSel() {
    return {
      c1: Math.min(sel.c1, sel.c2),
      r1: Math.min(sel.r1, sel.r2),
      c2: Math.max(sel.c1, sel.c2),
      r2: Math.max(sel.r1, sel.r2)
    };
  }
  function inSel(col, row) {
    var s = normSel();
    return col >= s.c1 && col <= s.c2 && row >= s.r1 && row <= s.r2;
  }

  function setStatus(msg, isErr) {
    statusText.textContent = msg;
    statusText.className = isErr ? "err" : "";
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      if (statusText.textContent === msg) statusText.textContent = "Ready";
      statusText.className = "";
    }, 6000);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime || "text/plain" }), filename);
  }

  function buildGrid() {
    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var corner = document.createElement("th");
    corner.className = "corner";
    corner.scope = "col";
    hr.appendChild(corner);
    var c;
    for (c = 0; c < 26; c++) {
      var th = document.createElement("th");
      th.className = "col-h";
      th.scope = "col";
      th.textContent = SheetEngine.indexToCol(c);
      th.dataset.col = String(c);
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    var tbody = document.createElement("tbody");
    var r;
    for (r = 1; r <= 100; r++) {
      var tr = document.createElement("tr");
      var rh = document.createElement("th");
      rh.className = "row-h";
      rh.scope = "row";
      rh.textContent = String(r);
      rh.dataset.row = String(r);
      tr.appendChild(rh);
      for (c = 0; c < 26; c++) {
        var td = document.createElement("td");
        var addr = addrOf(c, r);
        td.dataset.addr = addr;
        td.dataset.col = String(c);
        td.dataset.row = String(r);
        td.id = "cell-" + addr;
        td.setAttribute("role", "gridcell");
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    sheet.appendChild(thead);
    sheet.appendChild(tbody);
  }

  function cellKindClass(kind, value) {
    if (SheetEngine.isErr(value)) return "err";
    if (kind === "boolean") return "bool";
    if (kind === "text") return "text";
    if (kind === "formula") return "formula";
    if (kind === "number") return "num";
    return "";
  }

  function paintCell(td) {
    var addr = td.dataset.addr;
    var kind = engine.kindOf(addr);
    var value = engine.computedValue(addr);
    var display = SheetEngine.displayValue(value);
    var raw = engine.cellRaw(addr);
    var stamp = kind + "\0" + display + "\0" + raw;
    var selOn = inSel(+td.dataset.col, +td.dataset.row);
    var act = +td.dataset.col === active.col && +td.dataset.row === active.row;
    var ui = (selOn ? "s" : "") + (act ? "a" : "");
    if (painted[addr] === stamp + ui) return;
    painted[addr] = stamp + ui;
    td.textContent = display;
    td.className = cellKindClass(kind, value);
    if (selOn) td.classList.add("in-range");
    if (act) td.classList.add("active");
    var label = addr + (display ? ", " + display : ", blank");
    if (raw && raw !== display) label += ", raw " + raw;
    td.setAttribute("aria-label", label);
    td.title = raw ? raw + (display && display !== raw ? " → " + display : "") : display;
  }

  function refreshGrid() {
    var tds = sheet.querySelectorAll("td");
    for (var i = 0; i < tds.length; i++) paintCell(tds[i]);
    var hotCols = {};
    var hotRows = {};
    var s = normSel();
    var c, r;
    for (c = s.c1; c <= s.c2; c++) hotCols[c] = true;
    for (r = s.r1; r <= s.r2; r++) hotRows[r] = true;
    var chs = sheet.querySelectorAll("th.col-h");
    for (i = 0; i < chs.length; i++) {
      chs[i].classList.toggle("hot", !!hotCols[+chs[i].dataset.col]);
    }
    var rhs = sheet.querySelectorAll("th.row-h");
    for (i = 0; i < rhs.length; i++) {
      rhs[i].classList.toggle("hot", !!hotRows[+rhs[i].dataset.row]);
    }
  }

  function updateStats() {
    var s = normSel();
    var st = engine.selectionStats(s.c1, s.r1, s.c2, s.r2);
    selStats.textContent = st.cells + " cells · count " + st.count + " · sum " + SheetEngine.formatNumber(st.sum);
    addrBox.textContent = activeAddr();
    if (!editing && !barDirty) formulaBar.value = engine.cellRaw(activeAddr());
    btnUndo.disabled = !engine.canUndo();
    btnRedo.disabled = !engine.canRedo();
  }

  function updateInspector() {
    var info = engine.inspect(activeAddr());
    var lines = [];
    lines.push(info.addr + "  (" + info.kind + ")");
    lines.push("raw: " + (info.raw === "" ? "(blank)" : info.raw));
    lines.push("value: " + info.display);
    if (info.error) lines.push("error: " + info.error);
    if (info.parse) lines.push("parse: " + info.parse);
    lines.push("precedents: " + (info.precedents.length ? info.precedents.join(", ") : "—"));
    lines.push("dependents: " + (info.dependents.length ? info.dependents.join(", ") : "—"));
    inspector.textContent = lines.join("\n");
  }

  function selectCell(col, row, extend) {
    if (col < 0) col = 0;
    if (col > 25) col = 25;
    if (row < 1) row = 1;
    if (row > 100) row = 100;
    if (extend) {
      sel.c2 = col;
      sel.r2 = row;
      active.col = col;
      active.row = row;
    } else {
      active.col = col;
      active.row = row;
      sel = { c1: col, r1: row, c2: col, r2: row };
    }
    var td = document.getElementById("cell-" + activeAddr());
    if (td) {
      td.scrollIntoView({ block: "nearest", inline: "nearest" });
      var wrap = gridWrap.getBoundingClientRect();
      var rec = td.getBoundingClientRect();
      var headerW = 40;
      var headerH = 26;
      if (rec.left < wrap.left + headerW) gridWrap.scrollLeft -= wrap.left + headerW - rec.left;
      if (rec.right > wrap.right) gridWrap.scrollLeft += rec.right - wrap.right + 8;
      if (rec.top < wrap.top + headerH) gridWrap.scrollTop -= wrap.top + headerH - rec.top;
      if (rec.bottom > wrap.bottom) gridWrap.scrollTop += rec.bottom - wrap.bottom + 8;
    }
    if (!editing && document.activeElement !== formulaBar && document.activeElement !== editor) {
      sheet.focus({ preventScroll: true });
    }
    refreshGrid();
    updateStats();
    updateInspector();
    var s = normSel();
    if (s.c1 !== s.c2 || s.r1 !== s.r2) {
      newChartRange.value = SheetEngine.addrKey(s.c1, s.r1) + ":" + SheetEngine.addrKey(s.c2, s.r2);
    }
  }

  function commitEditor(move) {
    if (!editing) return;
    var raw = editor.hidden ? formulaBar.value : editor.value;
    var addr = editing.addr;
    editing = null;
    barDirty = false;
    editor.hidden = true;
    if (document.activeElement === formulaBar || document.activeElement === editor) {
      formulaBar.blur();
      editor.blur();
      sheet.focus({ preventScroll: true });
    }
    engine.setRaw(addr, raw);
    if (move === "down") selectCell(active.col, active.row + 1, false);
    else if (move === "up") selectCell(active.col, active.row - 1, false);
    else if (move === "right") selectCell(active.col + 1, active.row, false);
    else if (move === "left") selectCell(active.col - 1, active.row, false);
    else {
      refreshGrid();
      updateStats();
      updateInspector();
    }
  }

  function cancelEditor() {
    if (!editing) {
      barDirty = false;
      formulaBar.value = engine.cellRaw(activeAddr());
      return;
    }
    editing = null;
    barDirty = false;
    editor.hidden = true;
    formulaBar.value = engine.cellRaw(activeAddr());
  }

  function placeEditor() {
    var td = document.getElementById("cell-" + activeAddr());
    if (!td) return;
    var wrap = gridWrap.getBoundingClientRect();
    var rec = td.getBoundingClientRect();
    editor.style.left = rec.left - wrap.left + gridWrap.scrollLeft + "px";
    editor.style.top = rec.top - wrap.top + gridWrap.scrollTop + "px";
    editor.style.width = Math.max(76, rec.width) + "px";
    editor.style.height = rec.height + "px";
  }

  function startEdit(initial, fromBar) {
    var addr = activeAddr();
    editing = { addr: addr, start: engine.cellRaw(addr) };
    barDirty = true;
    var val = initial != null ? initial : engine.cellRaw(addr);
    formulaBar.value = val;
    if (fromBar) {
      editor.hidden = true;
      formulaBar.focus();
      return;
    }
    editor.hidden = false;
    editor.value = val;
    placeEditor();
    editor.focus();
    if (initial != null) {
      editor.selectionStart = editor.value.length;
      editor.selectionEnd = editor.value.length;
    } else {
      editor.select();
    }
  }

  function buildChartSelect() {
    var charts = engine.getCharts();
    var prev = selectedChartId;
    chartSelect.innerHTML = "";
    if (!charts.length) {
      selectedChartId = null;
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(none)";
      chartSelect.appendChild(opt);
      return;
    }
    if (!prev || !charts.some(function (c) { return c.id === prev; })) {
      selectedChartId = charts[0].id;
    }
    for (var i = 0; i < charts.length; i++) {
      var o = document.createElement("option");
      o.value = charts[i].id;
      o.textContent = charts[i].title + " (" + charts[i].type + ")";
      chartSelect.appendChild(o);
    }
    chartSelect.value = selectedChartId;
  }

  function currentChart() {
    var charts = engine.getCharts();
    for (var i = 0; i < charts.length; i++) if (charts[i].id === selectedChartId) return charts[i];
    return null;
  }

  function fillChartForm() {
    suppressChartForm = true;
    var ch = currentChart();
    var disabled = !ch;
    chartTitle.disabled = disabled;
    chartType.disabled = disabled;
    chartRange.disabled = disabled;
    chartLegend.disabled = disabled;
    document.getElementById("btn-delete-chart").disabled = disabled;
    document.getElementById("btn-export-svg").disabled = disabled;
    document.getElementById("btn-export-png").disabled = disabled;
    if (!ch) {
      chartTitle.value = "";
      chartRange.value = "";
      chartColors.innerHTML = "";
      suppressChartForm = false;
      return;
    }
    chartTitle.value = ch.title;
    chartType.value = ch.type;
    chartRange.value = ch.range;
    chartLegend.checked = !!ch.legend;
    var model = engine.chartModel(ch);
    chartColors.innerHTML = "";
    var n = model.series.length || ch.colors.length;
    var i;
    for (i = 0; i < n; i++) {
      var lab = document.createElement("label");
      var name = model.series[i] ? model.series[i].name : "Series " + (i + 1);
      lab.appendChild(document.createTextNode(name));
      var inp = document.createElement("input");
      inp.type = "color";
      inp.value = toColor(ch.colors[i] || "#2F6F6A");
      inp.setAttribute("aria-label", name + " color");
      inp.dataset.index = String(i);
      inp.addEventListener("change", onColorChange);
      lab.appendChild(inp);
      chartColors.appendChild(lab);
    }
    suppressChartForm = false;
  }

  function toColor(c) {
    if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c;
    return "#2F6F6A";
  }

  function onColorChange(ev) {
    var ch = currentChart();
    if (!ch) return;
    var idx = +ev.target.dataset.index;
    var colors = ch.colors.slice();
    while (colors.length <= idx) colors.push("#2F6F6A");
    colors[idx] = ev.target.value;
    engine.updateChart(ch.id, { colors: colors });
  }

  function niceTicks(min, max, count) {
    if (min === max) {
      min -= 1;
      max += 1;
    }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = (span / count) / step;
    if (err >= 7.5) step *= 10;
    else if (err >= 3) step *= 5;
    else if (err >= 1.5) step *= 2;
    var t0 = Math.ceil(min / step) * step;
    var ticks = [];
    for (var t = t0; t <= max + step * 0.01; t += step) ticks.push(Number(t.toPrecision(12)));
    if (ticks.indexOf(0) < 0 && min <= 0 && max >= 0) ticks.push(0);
    ticks.sort(function (a, b) { return a - b; });
    return ticks;
  }

  function renderChart() {
    var ch = currentChart();
    chartSvgHost.innerHTML = "";
    chartTip.style.display = "none";
    if (!ch) {
      chartEmpty.style.display = "block";
      chartEmpty.textContent = "No chart selected. Create one from a headered range.";
      chartOmitted.textContent = "";
      chartInspectLine.textContent = "";
      return;
    }
    var model = engine.chartModel(ch);
    if (model.error) {
      chartEmpty.style.display = "block";
      chartEmpty.textContent = model.error;
      chartOmitted.textContent = "";
      return;
    }
    chartEmpty.style.display = "none";
    var svg = buildChartSVG(ch, model, 640, 360, true);
    chartSvgHost.appendChild(svg);
    var om = model.omitted;
    if (om.length) {
      var counts = {};
      for (var i = 0; i < om.length; i++) {
        counts[om[i].reason] = (counts[om[i].reason] || 0) + 1;
      }
      var bits = [];
      for (var k in counts) bits.push(counts[k] + " " + k);
      chartOmitted.innerHTML = "";
      var strong = document.createElement("strong");
      strong.textContent = om.length + " point" + (om.length === 1 ? "" : "s") + " omitted";
      chartOmitted.appendChild(strong);
      chartOmitted.appendChild(document.createTextNode(" (" + bits.join(", ") + "). Zero is plotted; missing/error values are not treated as zero."));
    } else {
      chartOmitted.textContent = "All series points plotted from calculated cells.";
    }
  }

  function buildChartSVG(ch, model, W, H, interactive) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", ch.title + " " + ch.type + " chart");
    var padL = 52;
    var padR = 16;
    var padT = 36;
    var padB = ch.legend ? 56 : 40;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;
    var vals = [];
    var s, p;
    for (s = 0; s < model.series.length; s++) {
      for (p = 0; p < model.series[s].points.length; p++) {
        var pt = model.series[s].points[p];
        if (!pt.omitted && typeof pt.value === "number") vals.push(pt.value);
      }
    }
    var ymin = 0;
    var ymax = 0;
    if (ch.type === "column") {
      ymin = 0;
      ymax = 0;
    }
    if (vals.length) {
      ymin = Math.min.apply(null, vals);
      ymax = Math.max.apply(null, vals);
    }
    if (ch.type === "column") {
      ymin = Math.min(0, ymin);
      ymax = Math.max(0, ymax);
    }
    if (ymin === ymax) {
      ymin = Math.min(0, ymin - 1);
      ymax = Math.max(0, ymax + 1);
    }
    var ySpan = ymax - ymin || 1;
    function yx(v) {
      return padT + innerH - ((v - ymin) / ySpan) * innerH;
    }
    function el(name, attrs, text) {
      var n = document.createElementNS(ns, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text != null) n.textContent = text;
      return n;
    }
    svg.appendChild(el("rect", { x: "0", y: "0", width: String(W), height: String(H), fill: "#fffdf7" }));
    svg.appendChild(el("text", {
      x: String(W / 2), y: "22", "text-anchor": "middle",
      fill: "#1c1610", "font-size": "15", "font-family": "Palatino, Georgia, serif", "font-weight": "700"
    }, ch.title));
    var ticks = niceTicks(ymin, ymax, 5);
    for (var t = 0; t < ticks.length; t++) {
      var yy = yx(ticks[t]);
      svg.appendChild(el("line", {
        x1: String(padL), x2: String(padL + innerW), y1: String(yy), y2: String(yy),
        stroke: "#e6dcc4", "stroke-width": "1"
      }));
      svg.appendChild(el("text", {
        x: String(padL - 6), y: String(yy + 4), "text-anchor": "end",
        fill: "#6d5f50", "font-size": "10", "font-family": "Trebuchet MS, sans-serif"
      }, SheetEngine.formatNumber(ticks[t])));
    }
    var zeroY = yx(0);
    if (zeroY >= padT - 1 && zeroY <= padT + innerH + 1) {
      svg.appendChild(el("line", {
        x1: String(padL), x2: String(padL + innerW), y1: String(zeroY), y2: String(zeroY),
        stroke: "#3b2f24", "stroke-width": "1.2"
      }));
    }
    var cats = model.categories;
    var nCat = Math.max(cats.length, 1);
    var groupW = innerW / nCat;
    for (var ci = 0; ci < cats.length; ci++) {
      var cx = padL + groupW * (ci + 0.5);
      svg.appendChild(el("text", {
        x: String(cx), y: String(H - (ch.legend ? 28 : 12)), "text-anchor": "middle",
        fill: "#3b2f24", "font-size": "11", "font-family": "Trebuchet MS, sans-serif"
      }, cats[ci].label));
    }
    function attachHit(node, seriesName, pt) {
      if (!interactive) return;
      node.style.cursor = pt.omitted ? "default" : "pointer";
      node.addEventListener("pointerenter", function (ev) {
        var valText = pt.omitted ? "omitted (" + pt.reason + ")" : SheetEngine.formatNumber(pt.value);
        chartTip.style.display = "block";
        chartTip.textContent = pt.category + " · " + seriesName + " · " + valText + " · " + pt.addr;
        var stage = document.getElementById("chart-stage").getBoundingClientRect();
        chartTip.style.left = ev.clientX - stage.left + 8 + "px";
        chartTip.style.top = ev.clientY - stage.top + 8 + "px";
        chartInspectLine.textContent = "Inspect: category " + pt.category + ", series " + seriesName + ", value " + valText + ", source " + pt.addr;
      });
      node.addEventListener("pointerleave", function () {
        chartTip.style.display = "none";
      });
      node.addEventListener("click", function (ev) {
        ev.preventDefault();
        var a = SheetEngine.parseAddrStrict(pt.addr);
        if (a) selectCell(a.col, a.row, false);
        var valText = pt.omitted ? "omitted (" + pt.reason + ")" : SheetEngine.formatNumber(pt.value);
        chartInspectLine.textContent = "Selected source " + pt.addr + " · " + pt.category + " · " + seriesName + " · " + valText;
      });
    }
    var nSer = Math.max(model.series.length, 1);
    var barW = Math.max(6, (groupW * 0.7) / nSer);
    if (ch.type === "column") {
      for (s = 0; s < model.series.length; s++) {
        for (p = 0; p < model.series[s].points.length; p++) {
          var cpt = model.series[s].points[p];
          if (cpt.omitted) continue;
          var gx = padL + groupW * p + groupW * 0.15 + s * barW;
          var y0 = yx(0);
          var y1 = yx(cpt.value);
          var y = Math.min(y0, y1);
          var h = Math.max(1, Math.abs(y1 - y0));
          var rect = el("rect", {
            x: String(gx), y: String(y), width: String(Math.max(barW - 2, 2)), height: String(h),
            fill: model.series[s].color, "data-addr": cpt.addr, "data-series": model.series[s].name
          });
          attachHit(rect, model.series[s].name, cpt);
          svg.appendChild(rect);
        }
      }
    } else {
      for (s = 0; s < model.series.length; s++) {
        var d = "";
        var drawing = false;
        var pts = model.series[s].points;
        for (p = 0; p < pts.length; p++) {
          var lpt = pts[p];
          if (lpt.omitted) {
            drawing = false;
            continue;
          }
          var lx = padL + groupW * (p + 0.5);
          var ly = yx(lpt.value);
          d += (drawing ? "L" : "M") + lx + " " + ly + " ";
          drawing = true;
        }
        if (d) {
          svg.appendChild(el("path", {
            d: d.trim(), fill: "none", stroke: model.series[s].color, "stroke-width": "2.4",
            "stroke-linejoin": "round", "stroke-linecap": "round"
          }));
        }
        for (p = 0; p < pts.length; p++) {
          if (pts[p].omitted) continue;
          var dot = el("circle", {
            cx: String(padL + groupW * (p + 0.5)), cy: String(yx(pts[p].value)), r: "4.5",
            fill: "#fffdf7", stroke: model.series[s].color, "stroke-width": "2",
            "data-addr": pts[p].addr
          });
          attachHit(dot, model.series[s].name, pts[p]);
          svg.appendChild(dot);
        }
      }
    }
    if (ch.legend) {
      var lx0 = padL;
      for (s = 0; s < model.series.length; s++) {
        svg.appendChild(el("rect", {
          x: String(lx0), y: String(H - 18), width: "10", height: "10", fill: model.series[s].color
        }));
        svg.appendChild(el("text", {
          x: String(lx0 + 14), y: String(H - 9), fill: "#1c1610", "font-size": "11",
          "font-family": "Trebuchet MS, sans-serif"
        }, model.series[s].name));
        lx0 += 18 + model.series[s].name.length * 6.4 + 12;
      }
    }
    return svg;
  }

  function exportCurrentSVG() {
    var ch = currentChart();
    if (!ch) return null;
    var model = engine.chartModel(ch);
    if (model.error) return null;
    var svg = buildChartSVG(ch, model, 640, 360, false);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  }

  function exportCurrentPNG(cb) {
    var xml = exportCurrentSVG();
    if (!xml) {
      cb(new Error("No chart"));
      return;
    }
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdf7";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        cb(null, blob);
      }, "image/png");
    };
    img.onerror = function () {
      cb(new Error("PNG encode failed"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  function refreshAll() {
    if (workbookName !== document.activeElement) workbookName.value = engine.getName();
    buildChartSelect();
    fillChartForm();
    renderChart();
    refreshGrid();
    updateStats();
    updateInspector();
  }

  engine.onChange(function () {
    refreshAll();
  });

  function onSheetPointer(ev) {
    var td = ev.target.closest("td");
    var th = ev.target.closest("th");
    if (ev.type === "mousedown" && ev.button !== 0) return;
    if (td) {
      if (editing && editing.addr !== td.dataset.addr) commitEditor(null);
      var col = +td.dataset.col;
      var row = +td.dataset.row;
      if (ev.type === "mousedown") {
        draggingSel = true;
        selectCell(col, row, ev.shiftKey);
        ev.preventDefault();
      } else if (ev.type === "dblclick") {
        startEdit(null, false);
      }
      return;
    }
    if (th && ev.type === "mousedown") {
      if (th.classList.contains("col-h")) {
        var c = +th.dataset.col;
        sel = { c1: c, r1: 1, c2: c, r2: 100 };
        active.col = c;
        active.row = 1;
        refreshGrid();
        updateStats();
        updateInspector();
      } else if (th.classList.contains("row-h")) {
        var r = +th.dataset.row;
        sel = { c1: 0, r1: r, c2: 25, r2: r };
        active.col = 0;
        active.row = r;
        refreshGrid();
        updateStats();
        updateInspector();
      }
    }
  }

  sheet.addEventListener("mousedown", onSheetPointer);
  sheet.addEventListener("dblclick", onSheetPointer);
  window.addEventListener("mousemove", function (ev) {
    if (!draggingSel) return;
    var td = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!td) return;
    td = td.closest && td.closest("td");
    if (!td || !sheet.contains(td)) return;
    selectCell(+td.dataset.col, +td.dataset.row, true);
  });
  window.addEventListener("mouseup", function () {
    draggingSel = false;
  });

  gridWrap.addEventListener("scroll", function () {
    if (editing && !editor.hidden) placeEditor();
  });
  window.addEventListener("resize", function () {
    if (editing && !editor.hidden) placeEditor();
    updateStickyOffset();
  });

  function updateStickyOffset() {
    var h = document.getElementById("masthead").offsetHeight;
    document.querySelector(".formula-row").style.top = h + "px";
  }

  formulaBar.addEventListener("focus", function () {
    if (!editing) startEdit(formulaBar.value, true);
  });
  formulaBar.addEventListener("input", function () {
    barDirty = true;
    if (editing && !editor.hidden) editor.value = formulaBar.value;
  });
  editor.addEventListener("input", function () {
    formulaBar.value = editor.value;
    barDirty = true;
  });

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    return el.isContentEditable;
  }

  document.addEventListener("keydown", function (ev) {
    if (modal.classList.contains("open")) {
      if (ev.key === "Escape") closeModal();
      return;
    }
    var inField = isTypingTarget(ev.target);
    var inEdit = !!editing || ev.target === formulaBar || ev.target === editor;
    var meta = ev.ctrlKey || ev.metaKey;

    if (meta && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      if (ev.shiftKey) engine.redo();
      else engine.undo();
      return;
    }
    if (meta && ev.key.toLowerCase() === "y") {
      ev.preventDefault();
      engine.redo();
      return;
    }
    if (meta && ev.key.toLowerCase() === "c" && !inField) {
      ev.preventDefault();
      doCopy();
      return;
    }
    if (meta && ev.key.toLowerCase() === "v" && !inField) {
      ev.preventDefault();
      doPaste();
      return;
    }

    if (inEdit && (ev.target === formulaBar || ev.target === editor)) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commitEditor(ev.shiftKey ? "up" : "down");
        return;
      }
      if (ev.key === "Tab") {
        ev.preventDefault();
        commitEditor(ev.shiftKey ? "left" : "right");
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancelEditor();
        return;
      }
      return;
    }
    if (inField && ev.target !== document.body) return;

    if (ev.key === "F2") {
      ev.preventDefault();
      startEdit(null, false);
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      selectCell(active.col, ev.shiftKey ? active.row - 1 : active.row + 1, false);
      return;
    }
    if (ev.key === "Tab") {
      ev.preventDefault();
      selectCell(ev.shiftKey ? active.col - 1 : active.col + 1, active.row, false);
      return;
    }
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      selectCell(active.col - 1, active.row, ev.shiftKey);
      return;
    }
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      selectCell(active.col + 1, active.row, ev.shiftKey);
      return;
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      selectCell(active.col, active.row - 1, ev.shiftKey);
      return;
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      selectCell(active.col, active.row + 1, ev.shiftKey);
      return;
    }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      doClear();
      return;
    }
    if (ev.key === "Escape") {
      cancelEditor();
      return;
    }
    if (!meta && ev.key.length === 1 && !ev.altKey) {
      ev.preventDefault();
      startEdit(ev.key, false);
    }
  });

  function doCopy() {
    var s = normSel();
    engine.copyRect(s.c1, s.r1, s.c2, s.r2);
    setStatus("Copied " + (s.c2 - s.c1 + 1) + "×" + (s.r2 - s.r1 + 1) + " from " + addrOf(s.c1, s.r1));
  }
  function doPaste() {
    if (editing) commitEditor(null);
    var res = engine.pasteAt(active.col, active.row);
    if (!res.ok) setStatus(res.error, true);
    else setStatus("Pasted at " + activeAddr());
  }
  function doClear() {
    if (editing) cancelEditor();
    var s = normSel();
    engine.clearRange(s.c1, s.r1, s.c2, s.r2);
    setStatus("Cleared selection");
  }

  document.getElementById("btn-reset").addEventListener("click", function () {
    if (editing) cancelEditor();
    engine.resetToSeed();
    gridWrap.scrollLeft = 0;
    gridWrap.scrollTop = 0;
    newChartRange.value = "H1:J4";
    selectCell(0, 1, false);
    selectedChartId = engine.getCharts()[0] ? engine.getCharts()[0].id : null;
    setStatus("Reset to seed workbook; undo history cleared");
  });
  document.getElementById("btn-undo").addEventListener("click", function () { engine.undo(); });
  document.getElementById("btn-redo").addEventListener("click", function () { engine.redo(); });
  document.getElementById("btn-copy").addEventListener("click", doCopy);
  document.getElementById("btn-paste").addEventListener("click", doPaste);
  document.getElementById("btn-clear").addEventListener("click", doClear);

  document.getElementById("btn-export-json").addEventListener("click", function () {
    var data = JSON.stringify(engine.exportJSON(), null, 2);
    downloadText(data, sanitizeFile(engine.getName()) + ".json", "application/json");
    setStatus("Downloaded JSON workbook");
  });
  document.getElementById("btn-export-csv").addEventListener("click", function () {
    downloadText(engine.exportCSV(), sanitizeFile(engine.getName()) + ".csv", "text/csv");
    setStatus("Downloaded CSV of evaluated values");
  });
  document.getElementById("btn-import-json-file").addEventListener("click", function () {
    document.getElementById("file-json").click();
  });
  document.getElementById("btn-import-csv-file").addEventListener("click", function () {
    document.getElementById("file-csv").click();
  });
  document.getElementById("file-json").addEventListener("change", function (ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      importJSONText(String(reader.result));
    };
    reader.readAsText(f);
  });
  document.getElementById("file-csv").addEventListener("change", function (ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      importCSVText(String(reader.result));
    };
    reader.readAsText(f);
  });

  function importJSONText(text) {
    var obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      setStatus("JSON parse error: " + e.message, true);
      return false;
    }
    var res = engine.importJSON(obj);
    if (!res.ok) {
      setStatus("Import rejected: " + res.error, true);
      return false;
    }
    selectedChartId = engine.getCharts()[0] ? engine.getCharts()[0].id : null;
    setStatus("Imported JSON workbook");
    return true;
  }
  function importCSVText(text) {
    var res = engine.importCSV(text);
    if (!res.ok) {
      setStatus("CSV rejected: " + res.error, true);
      return false;
    }
    selectedChartId = null;
    setStatus("Imported CSV; charts cleared");
    return true;
  }

  function openModal(mode, title, placeholder) {
    modalMode = mode;
    modalTitle.textContent = title;
    modalText.value = placeholder || "";
    modal.classList.add("open");
    modalText.focus();
  }
  function closeModal() {
    modal.classList.remove("open");
  }
  document.getElementById("btn-import-json-text").addEventListener("click", function () {
    openModal("json", "Import JSON text", "");
  });
  document.getElementById("btn-import-csv-text").addEventListener("click", function () {
    openModal("csv", "Import CSV text", "");
  });
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-ok").addEventListener("click", function () {
    var ok = modalMode === "json" ? importJSONText(modalText.value) : importCSVText(modalText.value);
    if (ok) closeModal();
  });
  modal.addEventListener("click", function (ev) {
    if (ev.target === modal) closeModal();
  });

  document.getElementById("btn-create-chart").addEventListener("click", function () {
    var range = (newChartRange.value || "").trim();
    var rng = SheetEngine.parseRangeA1(range);
    if (!rng || rng.r2 - rng.r1 < 1 || rng.c2 - rng.c1 < 1) {
      setStatus("Chart range needs a header row and at least one series", true);
      return;
    }
    var id = engine.addChart({
      type: newChartType.value,
      range: range,
      title: newChartType.value === "line" ? "Line chart" : "Column chart"
    });
    selectedChartId = id;
    setStatus("Created chart");
  });
  document.getElementById("btn-delete-chart").addEventListener("click", function () {
    if (!selectedChartId) return;
    engine.deleteChart(selectedChartId);
    setStatus("Deleted chart");
  });
  chartSelect.addEventListener("change", function () {
    selectedChartId = chartSelect.value || null;
    fillChartForm();
    renderChart();
  });
  function applyChartPatch(patch) {
    if (suppressChartForm || !selectedChartId) return;
    var res = engine.updateChart(selectedChartId, patch);
    if (!res.ok) setStatus(res.error, true);
  }
  chartTitle.addEventListener("change", function () { applyChartPatch({ title: chartTitle.value }); });
  chartType.addEventListener("change", function () { applyChartPatch({ type: chartType.value }); });
  chartRange.addEventListener("change", function () { applyChartPatch({ range: chartRange.value }); });
  chartLegend.addEventListener("change", function () { applyChartPatch({ legend: chartLegend.checked }); });

  document.getElementById("btn-export-svg").addEventListener("click", function () {
    var xml = exportCurrentSVG();
    if (!xml) {
      setStatus("Nothing to export", true);
      return;
    }
    var ch = currentChart();
    downloadText(xml, sanitizeFile(ch.title) + ".svg", "image/svg+xml");
    setStatus("Downloaded SVG");
  });
  document.getElementById("btn-export-png").addEventListener("click", function () {
    exportCurrentPNG(function (err, blob) {
      if (err) {
        setStatus(String(err.message || err), true);
        return;
      }
      var ch = currentChart();
      downloadBlob(blob, sanitizeFile(ch.title) + ".png");
      setStatus("Downloaded PNG");
    });
  });

  workbookName.addEventListener("change", function () {
    engine.setName(workbookName.value);
  });

  function sanitizeFile(s) {
    return String(s || "workbook").replace(/[^\w\-]+/g, "_").slice(0, 60) || "workbook";
  }

  var splitter = document.getElementById("splitter");
  var draggingSplit = false;
  splitter.addEventListener("mousedown", function (ev) {
    draggingSplit = true;
    splitter.classList.add("dragging");
    ev.preventDefault();
  });
  window.addEventListener("mousemove", function (ev) {
    if (!draggingSplit) return;
    var ws = document.getElementById("workspace").getBoundingClientRect();
    var w = ws.right - ev.clientX;
    w = Math.max(260, Math.min(640, w));
    document.documentElement.style.setProperty("--chart-w", w + "px");
    if (editing && !editor.hidden) placeEditor();
  });
  window.addEventListener("mouseup", function () {
    draggingSplit = false;
    splitter.classList.remove("dragging");
  });
  splitter.addEventListener("keydown", function (ev) {
    var cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--chart-w"), 10) || 420;
    if (ev.key === "ArrowLeft") {
      document.documentElement.style.setProperty("--chart-w", Math.min(640, cur + 20) + "px");
    } else if (ev.key === "ArrowRight") {
      document.documentElement.style.setProperty("--chart-w", Math.max(260, cur - 20) + "px");
    }
  });

  buildGrid();
  selectedChartId = engine.getCharts()[0] ? engine.getCharts()[0].id : null;
  refreshAll();
  updateStickyOffset();
  selectCell(0, 1, false);

  window.SheetStudio = {
    engine: engine,
    select: function (a) {
      var p = SheetEngine.parseAddrStrict(a);
      if (p) selectCell(p.col, p.row, false);
    },
    selectRange: function (a, b) {
      var p = SheetEngine.parseAddrStrict(a);
      var q = SheetEngine.parseAddrStrict(b);
      if (!p || !q) return;
      sel = { c1: p.col, r1: p.row, c2: q.col, r2: q.row };
      active.col = p.col;
      active.row = p.row;
      refreshGrid();
      updateStats();
    },
    getRaw: function (a) { return engine.cellRaw(a); },
    getValue: function (a) { return engine.computedValue(a); },
    getDisplay: function (a) { return engine.displayOf(a); },
    setRaw: function (a, v) { return engine.setRaw(a, v); },
    copy: doCopy,
    paste: doPaste,
    undo: function () { return engine.undo(); },
    redo: function () { return engine.redo(); },
    reset: function () {
      engine.resetToSeed();
      gridWrap.scrollLeft = 0;
      gridWrap.scrollTop = 0;
      newChartRange.value = "H1:J4";
      selectCell(0, 1, false);
    },
    chartModel: function (id) {
      var charts = engine.getCharts();
      var ch = null;
      for (var i = 0; i < charts.length; i++) if (charts[i].id === (id || selectedChartId)) ch = charts[i];
      return ch ? engine.chartModel(ch) : null;
    },
    exportJSON: function () { return engine.exportJSON(); },
    exportCSV: function () { return engine.exportCSV(); },
    exportSVG: exportCurrentSVG,
    selectedChartId: function () { return selectedChartId; },
    setSelectedChart: function (id) { selectedChartId = id; fillChartForm(); renderChart(); },
    inspect: function (a) { return engine.inspect(a); },
    getCharts: function () { return engine.getCharts(); }
  };
})();
