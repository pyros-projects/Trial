const fs = require("fs");
const path = require("path");
const root = __dirname;
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const engine = fs.readFileSync(path.join(root, "engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const body = fs.readFileSync(path.join(root, "markup.html"), "utf8");
const html =
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spreadsheet &amp; Chart Studio</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect fill='%23c45c26' width='16' height='16'/%3E%3Crect fill='%23f4ecd9' x='3' y='3' width='10' height='10'/%3E%3C/svg%3E">
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${engine}
</script>
<script>
${app}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(root, "index.html"), html);
console.log("Wrote index.html", html.length, "bytes");
