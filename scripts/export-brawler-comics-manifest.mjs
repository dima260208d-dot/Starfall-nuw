import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outPath = path.resolve(repoRoot, "scripts", "brawler-comics-manifest.json");
const moduleCache = new Map();
const nodeRequire = createRequire(import.meta.url);

function resolveTsModule(request, fromFile) {
  if (!request.startsWith(".")) {
    return request;
  }

  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  const resolved = candidates.find(candidate => fs.existsSync(candidate));
  if (!resolved) {
    throw new Error(`Cannot resolve "${request}" from ${fromFile}`);
  }
  return resolved;
}

function loadTsModule(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  const source = fs.readFileSync(resolvedPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.Preserve,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: resolvedPath,
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(resolvedPath, module);

  const localRequire = (request) => {
    const resolved = resolveTsModule(request, resolvedPath);
    if (path.isAbsolute(resolved)) {
      return loadTsModule(resolved);
    }
    return nodeRequire(resolved);
  };

  const runModule = new Function("exports", "require", "module", "__filename", "__dirname", transpiled);
  runModule(module.exports, localRequire, module, resolvedPath, path.dirname(resolvedPath));
  return module.exports;
}

const comicsModule = loadTsModule(path.resolve(repoRoot, "src", "data", "brawlerComics.ts"));
const manifest = comicsModule.BRAWLER_COMIC_PROMPT_MANIFEST;

if (!manifest || !Array.isArray(manifest.pages)) {
  throw new Error("BRAWLER_COMIC_PROMPT_MANIFEST was not exported correctly.");
}

fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Exported ${manifest.pages.length} comic pages and ${manifest.coverImages.length} covers.`);
console.log(pathToFileURL(outPath).href);
