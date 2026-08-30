import assert from "node:assert";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { describe, it } from "node:test";

const SOURCE_ROOT = "src";

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? listTypeScriptFiles(path)
        : Promise.resolve(entry.name.endsWith(".ts") ? [path] : []);
    })
  );
  return files.flat();
}

function checkExportedDeclarations(file: string, source: string): void {
  const declaration =
    /^(export\s+(?:async\s+)?(?:function|interface|type|class|enum|const|let|var)\s+[A-Za-z_$])/gm;
  for (const match of source.matchAll(declaration)) {
    const leadingText = source.slice(0, match.index).trimEnd();
    assert(
      /\/\*\*[\s\S]*\*\/$/.test(leadingText),
      `${file}: ${match[1]} must have adjacent JSDoc`
    );
  }
}

function checkInterfaceFields(file: string, source: string): void {
  const exportedInterface =
    /^export interface ([A-Za-z_$][\w$]*)[^{]*\{([\s\S]*?)^\}/gm;
  for (const match of source.matchAll(exportedInterface)) {
    const name = match[1];
    const body = match[2];
    let documented = false;
    let inJsDoc = false;
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("/**")) {
        inJsDoc = !trimmed.endsWith("*/");
        documented = !inJsDoc;
        continue;
      }
      if (inJsDoc) {
        if (trimmed.endsWith("*/")) {
          inJsDoc = false;
          documented = true;
        }
        continue;
      }
      if (/^(?:readonly\s+)?(?:["']?[^\s:]+["']?)\??:/.test(trimmed)) {
        assert(documented, `${file}: ${name}.${trimmed} must have JSDoc`);
        documented = false;
        continue;
      }
      if (trimmed !== "") documented = false;
    }
  }
}

describe("repository source conventions", () => {
  it("uses one lowercase word for every source file name", async () => {
    const files = await listTypeScriptFiles(SOURCE_ROOT);
    for (const file of files) {
      assert.match(basename(file, ".ts"), /^[a-z]+$/, file);
    }
  });

  it("documents every exported declaration and public interface field", async () => {
    const files = await listTypeScriptFiles(SOURCE_ROOT);
    for (const file of files) {
      const text = await readFile(file, "utf8");
      checkExportedDeclarations(file, text);
      checkInterfaceFields(file, text);
    }
  });

  it("does not expose deprecated declarations", async () => {
    const files = await listTypeScriptFiles(SOURCE_ROOT);
    for (const file of files) {
      assert.doesNotMatch(await readFile(file, "utf8"), /@deprecated\b/, file);
    }
  });
});
