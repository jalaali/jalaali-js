import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  treeshake: true,
  // tsdown >= 0.11 defaults the ESM output to `.mjs`/`.d.mts`. Pin it back to
  // `.js`/`.d.ts` to keep the published file layout identical to 2.0.0 — the
  // paths in `exports`, `module`, and `types` are part of what consumers
  // resolve against. The extension is redundant anyway under `"type": "module"`.
  outExtensions: ({ format }) =>
    format === 'es'
      ? { js: '.js', dts: '.d.ts' }
      : { js: '.cjs', dts: '.d.cts' },
})
