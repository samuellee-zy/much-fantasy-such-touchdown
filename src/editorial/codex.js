import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

export async function generate({ schema, prompt, model, web = false }) {
  const dir = await mkdtemp(join(tmpdir(), "touchdown-copy-"));
  try {
    const schemaFile = join(dir, "schema.json");
    const output = join(dir, "copy.json");
    await writeFile(schemaFile, JSON.stringify(schema));
    const status = await new Promise((resolve, reject) => {
      const child = spawn(
        "codex",
        [
          "exec",
          "--ephemeral",
          "--sandbox",
          "read-only",
          "-m",
          model,
          "-c",
          'model_reasoning_effort="low"',
          ...(web ? ["-c", 'web_search="live"'] : []),
          "--output-schema",
          schemaFile,
          "--output-last-message",
          output,
          "-",
        ],
        {
          stdio: ["pipe", "ignore", "ignore"],
          timeout: web ? 180_000 : 150_000,
        },
      );
      child.on("error", reject);
      child.on("close", resolve);
      child.stdin.on("error", () => {});
      child.stdin.end(prompt);
    });
    if (status !== 0) throw new Error("Codex did not produce an edition.");
    return JSON.parse(await readFile(output, "utf8"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
