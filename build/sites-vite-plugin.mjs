import { access, cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export function sites() {
  let root = process.cwd();
  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    async closeBundle() {
      const output = resolve(root, "dist", ".openai");
      const hosting = resolve(root, ".openai", "hosting.json");
      const worker = resolve(root, "dist", "little_worlds", "index.js");
      const server = resolve(root, "dist", "server");
      await rm(output, { recursive: true, force: true });
      await mkdir(output, { recursive: true });
      if (await exists(hosting)) await cp(hosting, resolve(output, "hosting.json"));
      if (await exists(worker)) {
        await mkdir(server, { recursive: true });
        await cp(worker, resolve(server, "index.js"));
      }
    },
  };
}
