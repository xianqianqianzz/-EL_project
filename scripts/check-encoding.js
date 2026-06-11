const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const root = path.resolve(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'assets', 'lib']);
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.txt', '.yml', '.yaml']);
const explicitTextFiles = new Set(['.editorconfig', '.gitattributes', '.gitignore']);
const decoder = new TextDecoder('utf-8', { fatal: true });
const failures = [];
let checked = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!textExtensions.has(path.extname(entry.name).toLowerCase()) && !explicitTextFiles.has(entry.name)) continue;

    const content = fs.readFileSync(fullPath);
    const relativePath = path.relative(root, fullPath);
    checked++;
    if (content.length >= 3 && content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
      failures.push(`${relativePath}: 不允许 UTF-8 BOM`);
    }
    try {
      decoder.decode(content);
    } catch {
      failures.push(`${relativePath}: 不是有效 UTF-8`);
    }
  }
}

visit(root);

if (failures.length) {
  for (const failure of failures) console.error(`fatal: ${failure}`);
  process.exit(1);
}

console.log(`[encoding] ${checked} text files are valid UTF-8 without BOM`);
