# Changelog

## 2.0.0 — Unreleased

The library has been rewritten in TypeScript with first-class ESM support.
The conversion algorithm is unchanged; the public API surface has been
modernized.

### Added

- **TypeScript source and bundled `.d.ts` types.** Consumers get full type
  inference out of the box; no `@types/jalaali-js` shim needed.
- **Dual ESM + CJS publish** via the `exports` field. Modern bundlers and
  Node ≥ 20 resolve the ESM entry; CommonJS callers continue to work.
- **`jalCalShort(jy)`** — returns just `{ gy, march }`, replacing the
  `jalCal(jy, true)` overload.
- **`RangeError`** thrown for out-of-range Jalaali years (previously a
  plain `Error`).
- Vitest test suite (replaces Mocha + Should).
- GitHub Actions CI across Node 20, 22, 24.

### Changed (breaking)

- **`jalCal(jy, withoutLeap)` → `jalCal(jy)` + `jalCalShort(jy)`.** The
  boolean second argument is gone; call `jalCalShort` if you only need
  `{ gy, march }`.
- **Named exports only.** v1 shipped a CommonJS default object
  (`module.exports = { toJalaali, ... }`). v2 uses ESM named exports;
  destructuring (`import { toJalaali } from 'jalaali-js'`) and namespace
  import (`import * as jalaali from 'jalaali-js'`) both work. The
  `require('jalaali-js').toJalaali(...)` pattern still works through the
  CJS build.
- **Errors are `RangeError` instances** instead of plain `Error`.
- **Node ≥ 20** required (v1 supported Node ≥ 0.10).

### Removed

- `component.json` — the `component` package manager is no longer
  maintained.
- The hand-rolled `build-umd.js` script. A UMD bundle can be produced
  from the ESM build with any modern bundler if needed; we no longer
  ship one to npm.
- Mocha, Should, Browserify, Terser dev dependencies.

### Migration guide

```ts
// v1
const j = require('jalaali-js')
j.jalCal(1391, true) // { gy: 2012, march: 20 }

// v2
import { jalCalShort } from 'jalaali-js'
jalCalShort(1391) // { gy: 2012, march: 20 }
```

```ts
// v1
const j = require('jalaali-js')
j.toJalaali(2016, 4, 11)

// v2 — pick whichever import style fits your project
import { toJalaali } from 'jalaali-js'
toJalaali(2016, 4, 11)

// or still:
const { toJalaali } = require('jalaali-js')
toJalaali(2016, 4, 11)
```

```ts
// v1
try { j.jalCal(-100) } catch (e) { /* plain Error */ }

// v2
try { jalCal(-100) } catch (e) {
  if (e instanceof RangeError) { /* … */ }
}
```

## 1.2.8 and earlier

See git history.
