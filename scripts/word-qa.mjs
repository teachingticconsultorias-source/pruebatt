import fs from "node:fs/promises";
import { Packer } from "docx";
import { buildDocument, buildCompleteClass } from "../lib/docx/exporters.js";
import { fixtures, form } from "../tests/fixtures/word.js";

// docs/qa ya está ignorado por Git. Sólo datos ficticios, sin red.
const dir = new URL("../docs/qa/word/", import.meta.url);
await fs.mkdir(dir, { recursive: true });
for (const [name, type, resource] of fixtures) {
  const doc = type === "complete" ? buildCompleteClass(resource) : buildDocument(type, { form, resource });
  await fs.writeFile(new URL(name, dir), await Packer.toBuffer(doc));
  console.log(name);
}
