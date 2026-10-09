import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const outfile = new URL("../.turbo/grid.test.cjs", import.meta.url).pathname;
await mkdir(new URL("../.turbo", import.meta.url), { recursive: true });
await build({
  entryPoints: [new URL("./index.ts", import.meta.url).pathname],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  logLevel: "error",
});
process.exitCode =
  spawnSync(process.execPath, ["--test", outfile], {
    stdio: "inherit",
  }).status ?? 1;
