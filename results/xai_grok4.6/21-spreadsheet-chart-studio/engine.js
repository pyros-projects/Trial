/* Spreadsheet & Chart Studio — formula engine, workbook, CSV/JSON, charts data.
   No eval/Function. Works in Node (tests) and as a browser global. */
(function (global) {
  "use strict";

  var COLS = 26;
  var ROWS = 100;
  var VERSION = 1;

  var ERR = {
    DIV0: { error: "#DIV/0!" },
    REF: { error: "#REF!" },
    NAME: { error: "#NAME?" },
    VALUE: { error: "#VALUE!" },
    PARSE: { error: "#PARSE!" },
    NUM: { error: "#NUM!" },
    CYCLE: { error: "#CYCLE!" }
  };

  function isErr(v) {
    return v && typeof v === "object" && typeof v.error === "string";
  }

  function cloneErr(v) {
    return { error: v.error };
  }

  function colLettersToIndex(letters) {
    var n = 0;
    var u = letters.toUpperCase();
    for (var i = 0; i < u.length; i++) {
      var c = u.charCodeAt(i);
      if (c < 65 || c > 90) return -1;
      n = n * 26 + (c - 64);
    }
    return n - 1;
  }

  function indexToCol(i) {
    if (i < 0 || i >= COLS) return null;
    return String.fromCharCode(65 + i);
  }

  function inSheetColRow(col, row) {
    return col >= 0 && col < COLS && row >= 1 && row <= ROWS;
  }

  function addrKey(col, row) {
    return indexToCol(col) + String(row);
  }

  function parseAddr(text) {
    if (typeof text !== "string") return null;
    var m = text.trim().match(/^\$?([A-Za-z]+)\$?([0-9]+)$/);
    if (!m) return null;
    var col = colLettersToIndex(m[1]);
    var row = parseInt(m[2], 10);
    if (col < 0 || row < 1) return null;
    return { col: col, row: row };
  }

  function parseAddrStrict(text) {
    var a = parseAddr(text);
    if (!a || !inSheetColRow(a.col, a.row)) return null;
    return a;
  }

  function parseRangeA1(text) {
    if (typeof text !== "string") return null;
    var t = text.trim();
    var parts = t.split(":");
    if (parts.length === 1) {
      var one = parseAddrStrict(parts[0]);
      if (!one) return null;
      return { c1: one.col, r1: one.row, c2: one.col, r2: one.row };
    }
    if (parts.length !== 2) return null;
    var a = parseAddrStrict(parts[0]);
    var b = parseAddrStrict(parts[1]);
    if (!a || !b) return null;
    return {
      c1: Math.min(a.col, b.col),
      r1: Math.min(a.row, b.row),
      c2: Math.max(a.col, b.col),
      r2: Math.max(a.row, b.row)
    };
  }

  function formatRange(r) {
    return addrKey(r.c1, r.r1) + ":" + addrKey(r.c2, r.r2);
  }

  function formatRef(colAbs, col, rowAbs, row) {
    return (colAbs ? "$" : "") + indexToCol(col) + (rowAbs ? "$" : "") + String(row);
  }

  function isLetter(c) {
    return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z");
  }

  function isDigit(c) {
    return c >= "0" && c <= "9";
  }

  var SIGNED_DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  function isFiniteSignedDecimal(s) {
    if (typeof s !== "string" || !SIGNED_DECIMAL.test(s)) return false;
    var n = Number(s);
    return Number.isFinite(n);
  }

  function classifyInput(raw) {
    if (raw == null) raw = "";
    if (typeof raw !== "string") raw = String(raw);
    if (raw === "") return { kind: "blank", raw: "" };
    if (raw.charAt(0) === "'") {
      return { kind: "text", raw: raw, value: raw.slice(1) };
    }
    if (raw.charAt(0) === "=") {
      return { kind: "formula", raw: raw };
    }
    var trimmed = raw.trim();
    if (/^(true|false)$/i.test(trimmed)) {
      return { kind: "boolean", raw: raw, value: trimmed.toUpperCase() === "TRUE" };
    }
    if (isFiniteSignedDecimal(trimmed)) {
      return { kind: "number", raw: raw, value: Number(trimmed) };
    }
    return { kind: "text", raw: raw, value: raw };
  }

  function tokenize(src) {
    var tokens = [];
    var i = 0;
    var n = src.length;
    function push(t) {
      tokens.push(t);
    }
    while (i < n) {
      var c = src.charAt(i);
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++;
        continue;
      }
      if (c === "#") {
        var rest = src.slice(i, i + 5).toUpperCase();
        if (rest === "#REF!") {
          push({ type: "ERROR", error: "#REF!" });
          i += 5;
          continue;
        }
        return { error: ERR.PARSE, tokens: tokens };
      }
      if (c === '"') {
        i++;
        var str = "";
        var closed = false;
        while (i < n) {
          var ch = src.charAt(i);
          if (ch === '"') {
            if (src.charAt(i + 1) === '"') {
              str += '"';
              i += 2;
              continue;
            }
            closed = true;
            i++;
            break;
          }
          str += ch;
          i++;
        }
        if (!closed) return { error: ERR.PARSE, tokens: tokens };
        push({ type: "STRING", value: str });
        continue;
      }
      if (c === "<") {
        if (src.charAt(i + 1) === ">") {
          push({ type: "NE" });
          i += 2;
          continue;
        }
        if (src.charAt(i + 1) === "=") {
          push({ type: "LE" });
          i += 2;
          continue;
        }
        push({ type: "LT" });
        i++;
        continue;
      }
      if (c === ">") {
        if (src.charAt(i + 1) === "=") {
          push({ type: "GE" });
          i += 2;
          continue;
        }
        push({ type: "GT" });
        i++;
        continue;
      }
      if (c === "=") {
        push({ type: "EQ" });
        i++;
        continue;
      }
      if (c === "+") {
        push({ type: "PLUS" });
        i++;
        continue;
      }
      if (c === "-") {
        push({ type: "MINUS" });
        i++;
        continue;
      }
      if (c === "*") {
        push({ type: "STAR" });
        i++;
        continue;
      }
      if (c === "/") {
        push({ type: "SLASH" });
        i++;
        continue;
      }
      if (c === "(") {
        push({ type: "LPAREN" });
        i++;
        continue;
      }
      if (c === ")") {
        push({ type: "RPAREN" });
        i++;
        continue;
      }
      if (c === ",") {
        push({ type: "COMMA" });
        i++;
        continue;
      }
      if (c === ":") {
        push({ type: "COLON" });
        i++;
        continue;
      }
      if (isDigit(c) || (c === "." && isDigit(src.charAt(i + 1)))) {
        var start = i;
        if (c === ".") {
          i++;
          while (isDigit(src.charAt(i))) i++;
        } else {
          while (isDigit(src.charAt(i))) i++;
          if (src.charAt(i) === ".") {
            i++;
            while (isDigit(src.charAt(i))) i++;
          }
        }
        if (src.charAt(i) === "e" || src.charAt(i) === "E") {
          var epos = i;
          i++;
          if (src.charAt(i) === "+" || src.charAt(i) === "-") i++;
          if (!isDigit(src.charAt(i))) {
            i = epos;
          } else {
            while (isDigit(src.charAt(i))) i++;
          }
        }
        var lex = src.slice(start, i);
        var num = Number(lex);
        push({ type: "NUMBER", value: num, lex: lex });
        continue;
      }
      if (c === "$" || isLetter(c)) {
        var j = i;
        var colAbs = false;
        var rowAbs = false;
        if (src.charAt(j) === "$") {
          colAbs = true;
          j++;
        }
        if (!isLetter(src.charAt(j))) {
          return { error: ERR.PARSE, tokens: tokens };
        }
        var letters = "";
        while (isLetter(src.charAt(j))) {
          letters += src.charAt(j);
          j++;
        }
        var afterLetters = j;
        if (src.charAt(j) === "$") {
          rowAbs = true;
          j++;
        }
        if (isDigit(src.charAt(j))) {
          var digits = "";
          while (isDigit(src.charAt(j))) {
            digits += src.charAt(j);
            j++;
          }
          var col = colLettersToIndex(letters);
          var row = parseInt(digits, 10);
          push({
            type: "REF",
            col: col,
            row: row,
            colAbs: colAbs,
            rowAbs: rowAbs,
            letters: letters.toUpperCase(),
            lex: src.slice(i, j)
          });
          i = j;
          continue;
        }
        if (colAbs || rowAbs) {
          return { error: ERR.PARSE, tokens: tokens };
        }
        var ident = letters;
        i = afterLetters;
        var up = ident.toUpperCase();
        if (up === "TRUE") {
          push({ type: "BOOLEAN", value: true });
        } else if (up === "FALSE") {
          push({ type: "BOOLEAN", value: false });
        } else {
          push({ type: "IDENT", name: up, lex: ident });
        }
        continue;
      }
      return { error: ERR.PARSE, tokens: tokens };
    }
    push({ type: "EOF" });
    return { tokens: tokens };
  }

  function parseFormulaBody(body) {
    var tokRes = tokenize(body);
    if (tokRes.error) return { error: ERR.PARSE };
    var tokens = tokRes.tokens;
    var p = 0;
    var failed = false;

    function peek() {
      return tokens[p] || { type: "EOF" };
    }
    function peekType() {
      return peek().type;
    }
    function consume() {
      return tokens[p++];
    }
    function fail() {
      failed = true;
      return { type: "error", value: ERR.PARSE };
    }

    function parseComparison() {
      var left = parseAdd();
      while (!failed) {
        var t = peekType();
        if (t !== "EQ" && t !== "NE" && t !== "LT" && t !== "LE" && t !== "GT" && t !== "GE") break;
        var op = consume().type;
        var right = parseAdd();
        left = { type: "binary", op: op, left: left, right: right };
      }
      return left;
    }

    function parseAdd() {
      var left = parseMul();
      while (!failed) {
        var t = peekType();
        if (t !== "PLUS" && t !== "MINUS") break;
        var op = consume().type;
        var right = parseMul();
        left = { type: "binary", op: op, left: left, right: right };
      }
      return left;
    }

    function parseMul() {
      var left = parseUnary();
      while (!failed) {
        var t = peekType();
        if (t !== "STAR" && t !== "SLASH") break;
        var op = consume().type;
        var right = parseUnary();
        left = { type: "binary", op: op, left: left, right: right };
      }
      return left;
    }

    function parseUnary() {
      if (peekType() === "PLUS") {
        consume();
        return { type: "unary", op: "+", expr: parseUnary() };
      }
      if (peekType() === "MINUS") {
        consume();
        return { type: "unary", op: "-", expr: parseUnary() };
      }
      return parsePrimary();
    }

    function parsePrimary() {
      var t = peek();
      if (t.type === "NUMBER") {
        consume();
        return { type: "number", value: t.value, lex: t.lex };
      }
      if (t.type === "STRING") {
        consume();
        return { type: "string", value: t.value };
      }
      if (t.type === "BOOLEAN") {
        consume();
        return { type: "boolean", value: t.value };
      }
      if (t.type === "ERROR") {
        consume();
        return { type: "error", value: ERR.REF };
      }
      if (t.type === "REF") {
        consume();
        if (peekType() === "COLON") {
          var nxt = tokens[p + 1];
          if (nxt && nxt.type === "REF") {
            consume();
            var end = consume();
            return {
              type: "range",
              start: {
                type: "ref",
                col: t.col,
                row: t.row,
                colAbs: t.colAbs,
                rowAbs: t.rowAbs,
                letters: t.letters
              },
              end: {
                type: "ref",
                col: end.col,
                row: end.row,
                colAbs: end.colAbs,
                rowAbs: end.rowAbs,
                letters: end.letters
              }
            };
          }
        }
        return {
          type: "ref",
          col: t.col,
          row: t.row,
          colAbs: t.colAbs,
          rowAbs: t.rowAbs,
          letters: t.letters
        };
      }
      if (t.type === "IDENT") {
        consume();
        if (peekType() !== "LPAREN") {
          return { type: "name", name: t.name };
        }
        consume();
        var args = [];
        if (peekType() !== "RPAREN") {
          args.push(parseComparison());
          while (!failed && peekType() === "COMMA") {
            consume();
            args.push(parseComparison());
          }
        }
        if (peekType() !== "RPAREN") return fail();
        consume();
        return { type: "func", name: t.name, args: args };
      }
      if (t.type === "LPAREN") {
        consume();
        var inner = parseComparison();
        if (peekType() !== "RPAREN") return fail();
        consume();
        return inner;
      }
      return fail();
    }

    if (peekType() === "EOF") return { error: ERR.PARSE };
    var ast = parseComparison();
    if (failed || peekType() !== "EOF") return { error: ERR.PARSE };
    return { ast: ast };
  }

  function serializeNode(node) {
    if (!node) return "";
    switch (node.type) {
      case "number":
        return node.lex != null ? node.lex : String(node.value);
      case "string":
        return '"' + String(node.value).replace(/"/g, '""') + '"';
      case "boolean":
        return node.value ? "TRUE" : "FALSE";
      case "error":
        return node.value && node.value.error ? node.value.error : "#REF!";
      case "ref": {
        var colName = node.col >= 0 && node.col < COLS ? indexToCol(node.col) : node.letters;
        if (node.col >= COLS || node.col < 0) colName = node.letters;
        return (node.colAbs ? "$" : "") + (colName || node.letters) + (node.rowAbs ? "$" : "") + String(node.row);
      }
      case "range":
        return serializeNode(node.start) + ":" + serializeNode(node.end);
      case "unary":
        return node.op + serializeNode(node.expr);
      case "binary": {
        var ops = { PLUS: "+", MINUS: "-", STAR: "*", SLASH: "/", EQ: "=", NE: "<>", LT: "<", LE: "<=", GT: ">", GE: ">=" };
        return serializeNode(node.left) + ops[node.op] + serializeNode(node.right);
      }
      case "func": {
        var parts = [];
        for (var i = 0; i < node.args.length; i++) parts.push(serializeNode(node.args[i]));
        return node.name + "(" + parts.join(",") + ")";
      }
      case "name":
        return node.name;
      default:
        return "";
    }
  }

  function rebaseNode(node, dCol, dRow) {
    if (!node) return node;
    switch (node.type) {
      case "ref": {
        var col = node.colAbs ? node.col : node.col + dCol;
        var row = node.rowAbs ? node.row : node.row + dRow;
        if (!inSheetColRow(col, row)) {
          return { type: "error", value: ERR.REF };
        }
        return {
          type: "ref",
          col: col,
          row: row,
          colAbs: node.colAbs,
          rowAbs: node.rowAbs,
          letters: indexToCol(col)
        };
      }
      case "range":
        return {
          type: "range",
          start: rebaseNode(node.start, dCol, dRow),
          end: rebaseNode(node.end, dCol, dRow)
        };
      case "unary":
        return { type: "unary", op: node.op, expr: rebaseNode(node.expr, dCol, dRow) };
      case "binary":
        return {
          type: "binary",
          op: node.op,
          left: rebaseNode(node.left, dCol, dRow),
          right: rebaseNode(node.right, dCol, dRow)
        };
      case "func": {
        var args = [];
        for (var i = 0; i < node.args.length; i++) args.push(rebaseNode(node.args[i], dCol, dRow));
        return { type: "func", name: node.name, args: args };
      }
      case "error":
      case "number":
      case "string":
      case "boolean":
      case "name":
        return node;
      default:
        return node;
    }
  }

  function rebaseFormula(raw, dCol, dRow) {
    if (typeof raw !== "string" || raw.charAt(0) !== "=") return raw;
    var parsed = parseFormulaBody(raw.slice(1));
    if (parsed.error) return raw;
    var next = rebaseNode(parsed.ast, dCol, dRow);
    return "=" + serializeNode(next);
  }

  function numericLike(v) {
    return v === null || typeof v === "number" || typeof v === "boolean";
  }

  function toNumber(v) {
    if (isErr(v)) return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return cloneErr(ERR.NUM);
      return v;
    }
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === null) return 0;
    return cloneErr(ERR.VALUE);
  }

  function applyBinaryArith(op, l, r) {
    if (isErr(l)) return l;
    if (isErr(r)) return r;
    var ln = toNumber(l);
    if (isErr(ln)) return ln;
    var rn = toNumber(r);
    if (isErr(rn)) return rn;
    var out;
    if (op === "PLUS") out = ln + rn;
    else if (op === "MINUS") out = ln - rn;
    else if (op === "STAR") out = ln * rn;
    else if (op === "SLASH") {
      if (rn === 0) return cloneErr(ERR.DIV0);
      out = ln / rn;
    } else return cloneErr(ERR.PARSE);
    if (!Number.isFinite(out)) return cloneErr(ERR.NUM);
    return out;
  }

  function applyCompare(op, l, r) {
    if (isErr(l)) return l;
    if (isErr(r)) return r;
    var lNum = numericLike(l);
    var rNum = numericLike(r);
    var lStr = typeof l === "string";
    var rStr = typeof r === "string";
    var cmp;
    if (lNum && rNum) {
      var ln = toNumber(l);
      if (isErr(ln)) return ln;
      var rn = toNumber(r);
      if (isErr(rn)) return rn;
      cmp = ln < rn ? -1 : ln > rn ? 1 : 0;
    } else if (lStr && rStr) {
      cmp = l < r ? -1 : l > r ? 1 : 0;
    } else {
      return cloneErr(ERR.VALUE);
    }
    if (op === "EQ") return cmp === 0;
    if (op === "NE") return cmp !== 0;
    if (op === "LT") return cmp < 0;
    if (op === "LE") return cmp <= 0;
    if (op === "GT") return cmp > 0;
    if (op === "GE") return cmp >= 0;
    return cloneErr(ERR.PARSE);
  }

  function ifTruthy(v) {
    if (isErr(v)) return v;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return cloneErr(ERR.NUM);
      return v !== 0;
    }
    if (v === null) return false;
    if (typeof v === "string") return cloneErr(ERR.VALUE);
    return cloneErr(ERR.VALUE);
  }

  function formatNumber(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
    if (Object.is(n, -0)) return "0";
    if (Number.isInteger(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER) return String(n);
    var s = n.toPrecision(12);
    var num = Number(s);
    if (!Number.isFinite(num)) return String(n);
    return String(num);
  }

  function displayValue(v) {
    if (v === undefined || v === null) return "";
    if (isErr(v)) return v.error;
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") return formatNumber(v);
    return String(v);
  }

  function createEmptyCells() {
    return Object.create(null);
  }

  function cellRaw(cell) {
    if (!cell) return "";
    return cell.raw || "";
  }

  function createEngine() {
    var name = "Workbook";
    var cells = createEmptyCells();
    var charts = [];
    var cache = Object.create(null);
    var displayCache = Object.create(null);
    var visiting = Object.create(null);
    var deps = Object.create(null);
    var undoStack = [];
    var redoStack = [];
    var clipboard = null;
    var nextChartSeq = 1;
    var listeners = [];

    function emit() {
      for (var i = 0; i < listeners.length; i++) listeners[i]();
    }

    function onChange(fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (x) {
          return x !== fn;
        });
      };
    }

    function snapshotState() {
      return JSON.stringify({
        name: name,
        cells: cells,
        charts: charts,
        nextChartSeq: nextChartSeq
      });
    }

    function restoreState(s) {
      var o = JSON.parse(s);
      name = o.name;
      cells = o.cells;
      charts = o.charts;
      nextChartSeq = o.nextChartSeq;
      invalidate();
    }

    function pushUndo() {
      undoStack.push(snapshotState());
      redoStack = [];
    }

    function invalidate() {
      cache = Object.create(null);
      displayCache = Object.create(null);
      deps = Object.create(null);
    }

    function getCell(key) {
      return cells[key] || null;
    }

    function setCellInternal(key, classified) {
      if (!classified || classified.kind === "blank") {
        delete cells[key];
        return;
      }
      var stored = { kind: classified.kind, raw: classified.raw };
      if (classified.kind === "number") stored.value = classified.value;
      if (classified.kind === "text") stored.value = classified.value;
      if (classified.kind === "boolean") stored.value = classified.value;
      cells[key] = stored;
    }

    function evalRefNode(node, fromAddr) {
      if (node.type === "error") return cloneErr(node.value);
      if (!inSheetColRow(node.col, node.row)) return cloneErr(ERR.REF);
      var key = addrKey(node.col, node.row);
      if (fromAddr) {
        if (!deps[fromAddr]) deps[fromAddr] = [];
        if (deps[fromAddr].indexOf(key) < 0) deps[fromAddr].push(key);
      }
      return evalAddr(key);
    }

    function evalAddr(key) {
      var cell = cells[key];
      if (!cell || cell.kind === "blank") return null;
      if (cell.kind === "number") return cell.value;
      if (cell.kind === "boolean") return cell.value;
      if (cell.kind === "text") return cell.value;
      if (cell.kind === "formula") return evalFormulaKey(key);
      return null;
    }

    function evalFormulaKey(key) {
      if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
      if (visiting[key]) {
        return cloneErr(ERR.CYCLE);
      }
      var cell = cells[key];
      if (!cell || cell.kind !== "formula") {
        cache[key] = evalAddr(key);
        return cache[key];
      }
      visiting[key] = true;
      deps[key] = [];
      var result;
      try {
        var parsed = parseFormulaBody(cell.raw.slice(1));
        if (parsed.error) result = cloneErr(ERR.PARSE);
        else result = evalAst(parsed.ast, key);
      } finally {
        delete visiting[key];
      }
      cache[key] = result;
      return result;
    }

    function evalAst(node, fromAddr) {
      if (!node) return cloneErr(ERR.PARSE);
      switch (node.type) {
        case "number":
          if (!Number.isFinite(node.value)) return cloneErr(ERR.NUM);
          return node.value;
        case "string":
          return node.value;
        case "boolean":
          return node.value;
        case "error":
          return cloneErr(node.value || ERR.REF);
        case "name":
          return cloneErr(ERR.NAME);
        case "ref":
          return evalRefNode(node, fromAddr);
        case "range":
          return cloneErr(ERR.VALUE);
        case "unary": {
          var u = evalAst(node.expr, fromAddr);
          if (isErr(u)) return u;
          var un = toNumber(u);
          if (isErr(un)) return un;
          var ur = node.op === "-" ? -un : un;
          if (!Number.isFinite(ur)) return cloneErr(ERR.NUM);
          return ur;
        }
        case "binary": {
          if (node.op === "PLUS" || node.op === "MINUS" || node.op === "STAR" || node.op === "SLASH") {
            var bl = evalAst(node.left, fromAddr);
            if (isErr(bl)) return bl;
            var br = evalAst(node.right, fromAddr);
            if (isErr(br)) return br;
            return applyBinaryArith(node.op, bl, br);
          }
          var cl = evalAst(node.left, fromAddr);
          if (isErr(cl)) return cl;
          var cr = evalAst(node.right, fromAddr);
          if (isErr(cr)) return cr;
          return applyCompare(node.op, cl, cr);
        }
        case "func":
          return evalFunc(node, fromAddr);
        default:
          return cloneErr(ERR.PARSE);
      }
    }

    function walkRange(start, end, fromAddr, visit) {
      if (start.type === "error") return start.value;
      if (end.type === "error") return end.value;
      if (!inSheetColRow(start.col, start.row) || !inSheetColRow(end.col, end.row)) {
        return cloneErr(ERR.REF);
      }
      var c1 = Math.min(start.col, end.col);
      var r1 = Math.min(start.row, end.row);
      var c2 = Math.max(start.col, end.col);
      var r2 = Math.max(start.row, end.row);
      for (var r = r1; r <= r2; r++) {
        for (var c = c1; c <= c2; c++) {
          var key = addrKey(c, r);
          if (fromAddr) {
            if (!deps[fromAddr]) deps[fromAddr] = [];
            if (deps[fromAddr].indexOf(key) < 0) deps[fromAddr].push(key);
          }
          var cell = cells[key];
          var kind = cell ? cell.kind : "blank";
          var val;
          if (!cell || kind === "blank") val = { skip: true, kind: "blank" };
          else if (kind === "text") val = { skip: true, kind: "text" };
          else if (kind === "number") val = { value: cell.value, kind: "number" };
          else if (kind === "boolean") val = { value: cell.value ? 1 : 0, kind: "boolean" };
          else if (kind === "formula") {
            var ev = evalFormulaKey(key);
            if (isErr(ev)) return ev;
            if (typeof ev === "number") {
              if (!Number.isFinite(ev)) return cloneErr(ERR.NUM);
              val = { value: ev, kind: "number" };
            } else if (typeof ev === "boolean") val = { value: ev ? 1 : 0, kind: "boolean" };
            else val = { skip: true, kind: "text" };
          } else val = { skip: true, kind: "blank" };
          var stop = visit(val);
          if (isErr(stop)) return stop;
        }
      }
      return null;
    }

    function evalFunc(node, fromAddr) {
      var fname = node.name;
      if (fname !== "SUM" && fname !== "MIN" && fname !== "MAX" && fname !== "IF") {
        return cloneErr(ERR.NAME);
      }
      if (fname === "IF") {
        if (node.args.length !== 3) return cloneErr(ERR.VALUE);
        var cond = evalAst(node.args[0], fromAddr);
        var truth = ifTruthy(cond);
        if (isErr(truth)) return truth;
        return evalAst(truth ? node.args[1] : node.args[2], fromAddr);
      }
      if (node.args.length < 1) return cloneErr(ERR.VALUE);
      var nums = [];
      for (var i = 0; i < node.args.length; i++) {
        var arg = node.args[i];
        if (arg.type === "range") {
          var walked = walkRange(arg.start, arg.end, fromAddr, function (item) {
            if (item.skip) return null;
            nums.push(item.value);
            return null;
          });
          if (isErr(walked)) return walked;
        } else {
          var sv = evalAst(arg, fromAddr);
          if (isErr(sv)) return sv;
          var sn = toNumber(sv);
          if (isErr(sn)) return sn;
          nums.push(sn);
        }
      }
      if (nums.length === 0) return 0;
      if (fname === "SUM") {
        var sum = 0;
        for (var s = 0; s < nums.length; s++) sum += nums[s];
        if (!Number.isFinite(sum)) return cloneErr(ERR.NUM);
        return sum;
      }
      if (fname === "MIN") {
        var mn = nums[0];
        for (var a = 1; a < nums.length; a++) if (nums[a] < mn) mn = nums[a];
        return mn;
      }
      var mx = nums[0];
      for (var b = 1; b < nums.length; b++) if (nums[b] > mx) mx = nums[b];
      return mx;
    }

    function computedValue(key) {
      var cell = cells[key];
      if (!cell) return null;
      if (cell.kind === "formula") return evalFormulaKey(key);
      if (cell.kind === "number") return cell.value;
      if (cell.kind === "boolean") return cell.value;
      if (cell.kind === "text") return cell.value;
      return null;
    }

    function recalcAll() {
      invalidate();
      visiting = Object.create(null);
      for (var key in cells) {
        if (cells[key] && cells[key].kind === "formula") evalFormulaKey(key);
      }
    }

    function displayOf(key) {
      return displayValue(computedValue(key));
    }

    function kindOf(key) {
      var cell = cells[key];
      return cell ? cell.kind : "blank";
    }

    function applyRawMap(map, push) {
      if (push) pushUndo();
      for (var key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        var addr = parseAddrStrict(key);
        if (!addr) continue;
        setCellInternal(key, classifyInput(map[key]));
      }
      recalcAll();
      emit();
    }

    function setRaw(key, raw, opts) {
      opts = opts || {};
      if (!parseAddrStrict(key)) return { ok: false, error: "out of sheet" };
      if (!opts.silentUndo) pushUndo();
      setCellInternal(key, classifyInput(raw));
      recalcAll();
      if (!opts.silent) emit();
      return { ok: true };
    }

    function setRangeRaws(entries, opts) {
      opts = opts || {};
      if (!opts.silentUndo) pushUndo();
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!parseAddrStrict(e.key)) continue;
        setCellInternal(e.key, classifyInput(e.raw));
      }
      recalcAll();
      if (!opts.silent) emit();
    }

    function clearRange(c1, r1, c2, r2) {
      var a = Math.min(c1, c2),
        b = Math.max(c1, c2);
      var c = Math.min(r1, r2),
        d = Math.max(r1, r2);
      pushUndo();
      for (var r = c; r <= d; r++) {
        for (var col = a; col <= b; col++) {
          delete cells[addrKey(col, r)];
        }
      }
      recalcAll();
      emit();
    }

    function copyRect(c1, r1, c2, r2) {
      var a = Math.min(c1, c2),
        b = Math.max(c1, c2);
      var c = Math.min(r1, r2),
        d = Math.max(r1, r2);
      var grid = [];
      for (var r = c; r <= d; r++) {
        var row = [];
        for (var col = a; col <= b; col++) {
          var cell = cells[addrKey(col, r)];
          row.push(cell ? cell.raw : "");
        }
        grid.push(row);
      }
      clipboard = {
        rows: d - c + 1,
        cols: b - a + 1,
        grid: grid,
        originCol: a,
        originRow: c
      };
      return clipboard;
    }

    function pasteAt(targetCol, targetRow) {
      if (!clipboard) return { ok: false, error: "Clipboard is empty" };
      var cols = clipboard.cols;
      var rows = clipboard.rows;
      if (targetCol + cols > COLS || targetRow + rows - 1 > ROWS || targetRow < 1 || targetCol < 0) {
        return { ok: false, error: "Paste exceeds sheet bounds (A1:Z100)" };
      }
      var dCol = targetCol - clipboard.originCol;
      var dRow = targetRow - clipboard.originRow;
      pushUndo();
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var raw = clipboard.grid[r][c];
          var key = addrKey(targetCol + c, targetRow + r);
          if (raw && raw.charAt(0) === "=") {
            setCellInternal(key, classifyInput(rebaseFormula(raw, dCol, dRow)));
          } else {
            setCellInternal(key, classifyInput(raw));
          }
        }
      }
      recalcAll();
      emit();
      return { ok: true };
    }

    function undo() {
      if (!undoStack.length) return false;
      redoStack.push(snapshotState());
      restoreState(undoStack.pop());
      emit();
      return true;
    }

    function redo() {
      if (!redoStack.length) return false;
      undoStack.push(snapshotState());
      restoreState(redoStack.pop());
      emit();
      return true;
    }

    function canUndo() {
      return undoStack.length > 0;
    }
    function canRedo() {
      return redoStack.length > 0;
    }

    function clearHistory() {
      undoStack = [];
      redoStack = [];
    }

    function exportJSON() {
      var outCells = Object.create(null);
      for (var key in cells) {
        var cell = cells[key];
        if (!cell) continue;
        var rec = { kind: cell.kind, raw: cell.raw };
        outCells[key] = rec;
      }
      return {
        version: VERSION,
        name: name,
        cells: outCells,
        charts: charts.map(function (ch) {
          return {
            id: ch.id,
            title: ch.title,
            type: ch.type,
            range: ch.range,
            colors: ch.colors.slice(),
            legend: !!ch.legend
          };
        })
      };
    }

    function validateJSON(obj) {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return "Workbook must be an object";
      if (obj.version !== 1) return "Unsupported workbook version (expected 1)";
      if (typeof obj.name !== "string") return "Workbook name must be a string";
      if (!obj.cells || typeof obj.cells !== "object" || Array.isArray(obj.cells)) return "cells must be an object";
      for (var key in obj.cells) {
        if (!Object.prototype.hasOwnProperty.call(obj.cells, key)) continue;
        if (!parseAddrStrict(key)) return "Out-of-bounds or invalid cell address: " + key;
        var rec = obj.cells[key];
        if (!rec || typeof rec !== "object") return "Invalid cell record at " + key;
        var kind = rec.kind;
        if (kind !== "blank" && kind !== "number" && kind !== "text" && kind !== "boolean" && kind !== "formula") {
          return "Invalid cell kind at " + key;
        }
        if (typeof rec.raw !== "string") return "Cell raw must be a string at " + key;
        if (kind === "formula" && rec.raw.charAt(0) !== "=") return "Formula cell must start with = at " + key;
        if (kind === "blank" && rec.raw !== "") return "Blank cell raw must be empty at " + key;
        if (kind === "boolean") {
          if (!/^(true|false)$/i.test(rec.raw.trim())) return "Boolean cell raw invalid at " + key;
        }
        if (kind === "number") {
          if (!isFiniteSignedDecimal(rec.raw.trim())) return "Number cell raw invalid at " + key;
        }
      }
      if (!Array.isArray(obj.charts)) return "charts must be an array";
      var ids = Object.create(null);
      for (var i = 0; i < obj.charts.length; i++) {
        var ch = obj.charts[i];
        if (!ch || typeof ch !== "object") return "Invalid chart definition";
        if (typeof ch.id !== "string" || !ch.id) return "Chart id must be a non-empty string";
        if (ids[ch.id]) return "Duplicate chart id: " + ch.id;
        ids[ch.id] = true;
        if (typeof ch.title !== "string") return "Chart title must be a string";
        if (ch.type !== "column" && ch.type !== "line") return "Chart type must be column or line";
        if (typeof ch.range !== "string") return "Chart range must be a string";
        var rng = parseRangeA1(ch.range);
        if (!rng) return "Invalid chart range: " + ch.range;
        if (rng.r2 - rng.r1 < 1 || rng.c2 - rng.c1 < 1) return "Chart range needs a header row and at least one series: " + ch.range;
        if (!Array.isArray(ch.colors)) return "Chart colors must be an array";
        for (var ci = 0; ci < ch.colors.length; ci++) {
          if (typeof ch.colors[ci] !== "string") return "Chart color must be a string";
        }
        if (typeof ch.legend !== "boolean") return "Chart legend must be a boolean";
      }
      return null;
    }

    function importJSON(obj, opts) {
      opts = opts || {};
      var err = validateJSON(obj);
      if (err) return { ok: false, error: err };
      if (!opts.silentUndo) pushUndo();
      name = obj.name;
      cells = createEmptyCells();
      for (var key in obj.cells) {
        if (!Object.prototype.hasOwnProperty.call(obj.cells, key)) continue;
        var rec = obj.cells[key];
        if (rec.kind === "blank") continue;
        var classified;
        if (rec.kind === "text") {
          classified = { kind: "text", raw: rec.raw, value: rec.raw.charAt(0) === "'" ? rec.raw.slice(1) : rec.raw };
        } else {
          classified = classifyInput(rec.raw);
          if (classified.kind !== rec.kind && rec.kind === "formula") {
            classified = { kind: "formula", raw: rec.raw };
          }
          if (rec.kind === "text") classified = { kind: "text", raw: rec.raw, value: rec.raw };
        }
        if (rec.kind === "formula") classified = { kind: "formula", raw: rec.raw };
        if (rec.kind === "text") {
          classified = {
            kind: "text",
            raw: rec.raw,
            value: rec.raw.charAt(0) === "'" ? rec.raw.slice(1) : rec.raw
          };
        }
        setCellInternal(key, classified);
      }
      charts = obj.charts.map(function (ch) {
        return {
          id: ch.id,
          title: ch.title,
          type: ch.type,
          range: ch.range,
          colors: ch.colors.slice(),
          legend: !!ch.legend
        };
      });
      var maxSeq = 0;
      for (var i = 0; i < charts.length; i++) {
        var m = String(charts[i].id).match(/(\d+)$/);
        if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
      }
      nextChartSeq = maxSeq + 1;
      recalcAll();
      if (!opts.silent) emit();
      return { ok: true };
    }

    function parseCSV(text) {
      if (typeof text !== "string") return { error: "CSV must be text" };
      var rows = [];
      var row = [];
      var field = "";
      var i = 0;
      var inQuotes = false;
      var n = text.length;
      if (n === 0) return { rows: [] };
      while (i < n) {
        var c = text.charAt(i);
        if (inQuotes) {
          if (c === '"') {
            if (text.charAt(i + 1) === '"') {
              field += '"';
              i += 2;
              continue;
            }
            inQuotes = false;
            i++;
            continue;
          }
          field += c;
          i++;
          continue;
        }
        if (c === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (c === ",") {
          row.push(field);
          field = "";
          i++;
          continue;
        }
        if (c === "\n" || c === "\r") {
          if (c === "\r" && text.charAt(i + 1) === "\n") i++;
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
          i++;
          continue;
        }
        field += c;
        i++;
      }
      if (inQuotes) return { error: "Unterminated quoted field" };
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
      }
      if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "" && text.slice(-1) === "\n") {
        /* keep empty trailing row only if it has content; drop a lone empty line from final newline */
        var last = rows[rows.length - 1];
        var empty = true;
        for (var k = 0; k < last.length; k++) if (last[k] !== "") empty = false;
        if (empty) rows.pop();
      }
      if (rows.length > ROWS) return { error: "CSV has too many rows (max 100)" };
      for (var r = 0; r < rows.length; r++) {
        if (rows[r].length > COLS) return { error: "CSV has too many columns (max 26)" };
      }
      return { rows: rows };
    }

    function classifyCsvField(field) {
      if (field === "") return { kind: "blank", raw: "" };
      if (isFiniteSignedDecimal(field)) return { kind: "number", raw: field, value: Number(field) };
      return { kind: "text", raw: field, value: field };
    }

    function importCSV(text, opts) {
      opts = opts || {};
      var parsed = parseCSV(text);
      if (parsed.error) return { ok: false, error: parsed.error };
      if (!opts.silentUndo) pushUndo();
      cells = createEmptyCells();
      charts = [];
      var rows = parsed.rows;
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        for (var c = 0; c < row.length; c++) {
          var classified = classifyCsvField(row[c]);
          if (classified.kind === "blank") continue;
          setCellInternal(addrKey(c, r + 1), classified);
        }
      }
      recalcAll();
      if (!opts.silent) emit();
      return { ok: true };
    }

    function csvEscape(s) {
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    function exportCSV() {
      var maxR = 0;
      var maxC = -1;
      for (var key in cells) {
        var a = parseAddr(key);
        if (!a) continue;
        if (a.row > maxR) maxR = a.row;
        if (a.col > maxC) maxC = a.col;
      }
      if (maxR === 0) return "";
      var lines = [];
      for (var r = 1; r <= maxR; r++) {
        var fields = [];
        for (var c = 0; c <= maxC; c++) {
          var k = addrKey(c, r);
          var v = computedValue(k);
          fields.push(csvEscape(displayValue(v)));
        }
        lines.push(fields.join(","));
      }
      return lines.join("\n");
    }

    function newChartId() {
      var id = "chart-" + nextChartSeq;
      nextChartSeq += 1;
      return id;
    }

    function addChart(partial) {
      pushUndo();
      var ch = {
        id: newChartId(),
        title: (partial && partial.title) || "Chart " + nextChartSeq,
        type: (partial && partial.type) === "line" ? "line" : "column",
        range: (partial && partial.range) || "H1:J4",
        colors: (partial && partial.colors && partial.colors.slice()) || ["#2F6F6A", "#C4782A", "#5B4B8A", "#8C2F39"],
        legend: partial && typeof partial.legend === "boolean" ? partial.legend : true
      };
      charts.push(ch);
      emit();
      return ch.id;
    }

    function deleteChart(id) {
      var idx = -1;
      for (var i = 0; i < charts.length; i++) if (charts[i].id === id) idx = i;
      if (idx < 0) return false;
      pushUndo();
      charts.splice(idx, 1);
      emit();
      return true;
    }

    function updateChart(id, patch) {
      var ch = null;
      for (var i = 0; i < charts.length; i++) if (charts[i].id === id) ch = charts[i];
      if (!ch) return { ok: false, error: "Unknown chart" };
      if (patch.range != null) {
        var rng = parseRangeA1(patch.range);
        if (!rng) return { ok: false, error: "Invalid chart range" };
        if (rng.r2 - rng.r1 < 1 || rng.c2 - rng.c1 < 1) return { ok: false, error: "Range needs header + series" };
      }
      if (patch.type != null && patch.type !== "column" && patch.type !== "line") {
        return { ok: false, error: "Invalid chart type" };
      }
      pushUndo();
      if (patch.title != null) ch.title = String(patch.title);
      if (patch.type != null) ch.type = patch.type;
      if (patch.range != null) ch.range = String(patch.range).trim();
      if (patch.legend != null) ch.legend = !!patch.legend;
      if (patch.colors != null) ch.colors = patch.colors.slice();
      emit();
      return { ok: true };
    }

    function chartModel(ch) {
      var rng = parseRangeA1(ch.range);
      if (!rng) {
        return { error: "Invalid range " + ch.range, categories: [], series: [], omitted: [] };
      }
      if (rng.r2 - rng.r1 < 1 || rng.c2 - rng.c1 < 1) {
        return { error: "Range needs a header row and at least one numeric series", categories: [], series: [], omitted: [] };
      }
      var series = [];
      for (var c = rng.c1 + 1; c <= rng.c2; c++) {
        var headerCell = computedValue(addrKey(c, rng.r1));
        var header = displayValue(headerCell);
        if (!header) header = indexToCol(c) + rng.r1;
        var color = ch.colors[(c - rng.c1 - 1) % Math.max(ch.colors.length, 1)] || "#2F6F6A";
        series.push({ name: header, color: color, col: c, points: [] });
      }
      var categories = [];
      var omitted = [];
      for (var r = rng.r1 + 1; r <= rng.r2; r++) {
        var catVal = computedValue(addrKey(rng.c1, r));
        var cat = displayValue(catVal);
        if (!cat) cat = addrKey(rng.c1, r);
        categories.push({ label: cat, row: r, addr: addrKey(rng.c1, r) });
        for (var s = 0; s < series.length; s++) {
          var addr = addrKey(series[s].col, r);
          var cell = cells[addr];
          var kind = cell ? cell.kind : "blank";
          var val = computedValue(addr);
          var reason = null;
          var include = false;
          var num = null;
          if (isErr(val)) {
            reason = val.error;
          } else if (!cell || kind === "blank" || val === null) {
            reason = "blank";
          } else if (typeof val === "boolean" || kind === "boolean") {
            reason = "boolean";
          } else if (typeof val === "string" || kind === "text") {
            reason = "text";
          } else if (typeof val === "number") {
            if (!Number.isFinite(val)) reason = "#NUM!";
            else {
              include = true;
              num = val;
            }
          } else {
            reason = "non-numeric";
          }
          if (include) {
            series[s].points.push({
              category: cat,
              value: num,
              addr: addr,
              row: r,
              omitted: false
            });
          } else {
            series[s].points.push({
              category: cat,
              value: null,
              addr: addr,
              row: r,
              omitted: true,
              reason: reason
            });
            omitted.push({ addr: addr, series: series[s].name, category: cat, reason: reason });
          }
        }
      }
      return { error: null, categories: categories, series: series, omitted: omitted, range: rng };
    }

    function inspect(key) {
      var addr = parseAddrStrict(key);
      if (!addr) return { error: "Invalid address" };
      var cell = cells[key];
      var kind = cell ? cell.kind : "blank";
      var raw = cell ? cell.raw : "";
      var value = computedValue(key);
      var precedents = deps[key] ? deps[key].slice() : [];
      if (kind === "formula" && !Object.prototype.hasOwnProperty.call(cache, key)) evalFormulaKey(key);
      precedents = deps[key] ? deps[key].slice() : [];
      var dependents = [];
      for (var d in deps) {
        if (deps[d] && deps[d].indexOf(key) >= 0) dependents.push(d);
      }
      dependents.sort();
      var parseInfo = null;
      if (kind === "formula") {
        var parsed = parseFormulaBody(raw.slice(1));
        parseInfo = parsed.error ? parsed.error.error : "ok";
      }
      return {
        addr: key,
        kind: kind,
        raw: raw,
        value: value,
        display: displayValue(value),
        error: isErr(value) ? value.error : null,
        precedents: precedents,
        dependents: dependents,
        parse: parseInfo
      };
    }

    function selectionStats(c1, r1, c2, r2) {
      var a = Math.min(c1, c2),
        b = Math.max(c1, c2);
      var c = Math.min(r1, r2),
        d = Math.max(r1, r2);
      var count = 0;
      var sum = 0;
      var cellsN = (b - a + 1) * (d - c + 1);
      for (var r = c; r <= d; r++) {
        for (var col = a; col <= b; col++) {
          var v = computedValue(addrKey(col, r));
          if (typeof v === "number" && Number.isFinite(v)) {
            count++;
            sum += v;
          }
        }
      }
      return { count: count, sum: sum, cells: cellsN };
    }

    function resetToSeed() {
      loadSeed(true);
      clearHistory();
      emit();
    }

    function loadSeed(skipUndo) {
      name = "Workbook";
      cells = createEmptyCells();
      charts = [];
      nextChartSeq = 1;
      var seed = {
        A1: "2",
        B1: "3",
        A2: "4",
        B2: "5",
        C1: "=A1*B1",
        C2: "=A2*B2",
        D1: "=SUM(C1:C2)",
        E1: "=IF(A1>0,10,1/0)",
        F1: "=$A1+B$1+$C$1",
        H1: "Item",
        I1: "Current",
        J1: "Plan",
        H2: "Alpha",
        I2: "=C1",
        J2: "8",
        H3: "Beta",
        I3: "=C2",
        J3: "18",
        H4: "Total",
        I4: "=D1",
        J4: "26"
      };
      for (var k in seed) setCellInternal(k, classifyInput(seed[k]));
      charts.push({
        id: newChartId(),
        title: "Current vs Plan",
        type: "column",
        range: "H1:J4",
        colors: ["#2F6F6A", "#C4782A"],
        legend: true
      });
      recalcAll();
      if (!skipUndo) {
        /* seed is initial */
      }
    }

    function getClipboard() {
      return clipboard;
    }

    function getName() {
      return name;
    }
    function setName(n) {
      pushUndo();
      name = String(n);
      emit();
    }

    loadSeed(true);
    clearHistory();

    return {
      COLS: COLS,
      ROWS: ROWS,
      onChange: onChange,
      getName: getName,
      setName: setName,
      getCell: getCell,
      cellRaw: function (key) {
        return cellRaw(cells[key]);
      },
      kindOf: kindOf,
      computedValue: computedValue,
      displayOf: displayOf,
      setRaw: setRaw,
      setRangeRaws: setRangeRaws,
      clearRange: clearRange,
      copyRect: copyRect,
      pasteAt: pasteAt,
      getClipboard: getClipboard,
      undo: undo,
      redo: redo,
      canUndo: canUndo,
      canRedo: canRedo,
      clearHistory: clearHistory,
      exportJSON: exportJSON,
      importJSON: importJSON,
      validateJSON: validateJSON,
      parseCSV: parseCSV,
      importCSV: importCSV,
      exportCSV: exportCSV,
      addChart: addChart,
      deleteChart: deleteChart,
      updateChart: updateChart,
      getCharts: function () {
        return charts;
      },
      chartModel: chartModel,
      inspect: inspect,
      selectionStats: selectionStats,
      resetToSeed: resetToSeed,
      recalcAll: recalcAll,
      applyRawMap: applyRawMap,
      addrKey: addrKey,
      parseAddrStrict: parseAddrStrict,
      parseRangeA1: parseRangeA1,
      formatRange: formatRange,
      snapshotState: snapshotState
    };
  }

  var api = {
    COLS: COLS,
    ROWS: ROWS,
    ERR: ERR,
    isErr: isErr,
    classifyInput: classifyInput,
    tokenize: tokenize,
    parseFormulaBody: parseFormulaBody,
    rebaseFormula: rebaseFormula,
    serializeNode: serializeNode,
    displayValue: displayValue,
    formatNumber: formatNumber,
    parseAddr: parseAddr,
    parseAddrStrict: parseAddrStrict,
    parseRangeA1: parseRangeA1,
    addrKey: addrKey,
    indexToCol: indexToCol,
    colLettersToIndex: colLettersToIndex,
    createEngine: createEngine
  };

  global.SheetEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
