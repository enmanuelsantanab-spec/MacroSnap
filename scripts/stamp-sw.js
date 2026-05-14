const fs = require("fs");
const path = require("path");

// Read from template, stamp with unique build ID, write to public/sw.js
const templatePath = path.join(__dirname, "..", "sw.template.js");
const outputPath = path.join(__dirname, "..", "public", "sw.js");
const buildId = Date.now().toString(36);

let content = fs.readFileSync(templatePath, "utf-8");
content = content.replace("__BUILD_ID__", buildId);
fs.writeFileSync(outputPath, content, "utf-8");

console.log(`Service worker stamped with build ID: ${buildId}`);
