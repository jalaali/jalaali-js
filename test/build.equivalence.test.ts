/**
 * Equivalence tests: the built artifacts must behave exactly like `src/`.
 *
 * `build.integration.test.ts` checks that `dist/` exists, loads, and has the
 * right shape. This file checks the part that shape cannot: that the bundled
 * ESM and CJS produce *identical results to the source* across the whole
 * supported calendar range, including the errors they throw.
 *
 * Why this exists. The bundler rewrites the source — it inlines bindings,
 * drops `"use strict"`, reorders emit — and a toolchain upgrade can change
 * that output without any source change. Upgrading tsdown 0.10 -> 0.22 did
 * exactly that. Reviewing a bundler diff by eye does not scale; running both
 * implementations over the full range does. A build that quietly changes a
 * conversion is caught here rather than by a user.
 *
 * Scope, honestly stated: this proves the calendar API computes the same
 * answers. It cannot detect a payload that leaves every documented output
 * unchanged (an import-time side effect, say). Provenance and reproducible
 * builds are the control for that; this is the control for semantic drift.
 *
 * The sweep is exhaustive: every one of the ~1.18M days in the supported
 * range is compared, for both artifacts. Sampling would be faster, but it
 * leaves a gap an attacker can aim at — a payload that only misfires on days
 * the sample skips. Full coverage costs a few seconds and closes that gap.
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import * as src from '../src/index.js'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = (p: string): string => resolve(repoRoot, 'dist', p)

type Module = Record<string, unknown>
type Outcome = { ok: string } | { err: string }

let esm: Module
let cjs: Module

beforeAll(async () => {
  if (!existsSync(dist('index.js')) || !existsSync(dist('index.cjs'))) {
    execSync('pnpm build', { cwd: repoRoot, stdio: 'inherit' })
  }
  esm = (await import(pathToFileURL(dist('index.js')).href)) as Module
  cjs = createRequire(import.meta.url)(dist('index.cjs')) as Module
}, 60_000)

/**
 * Calls `fn` and captures either its serialized return value or the error it
 * threw. Errors are part of the contract — a build that throws a different
 * message, or throws where the source returns, is not equivalent.
 */
function outcome(fn: unknown, args: readonly unknown[]): Outcome {
  try {
    const value = (fn as (...a: readonly unknown[]) => unknown)(...args)
    return { ok: JSON.stringify(value) ?? 'undefined' }
  } catch (error) {
    const e = error as Error
    return { err: `${e.name}: ${e.message}` }
  }
}

/**
 * Compares one call against the source implementation. Divergences are
 * accumulated rather than asserted per call — the sweeps make millions of
 * comparisons, and one assertion each would dominate the runtime.
 */
function makeComparer(built: Module, label: string) {
  const divergences: string[] = []
  let comparisons = 0

  const compare = (name: string, args: readonly unknown[]): void => {
    comparisons += 1
    const a = outcome((src as Module)[name], args)
    const b = outcome(built[name], args)
    if (('ok' in a ? a.ok : a.err) !== ('ok' in b ? b.ok : b.err)) {
      // Cap the collected list; a systematic break would otherwise produce
      // a failure message with a million lines in it.
      if (divergences.length < 10) {
        const show = (o: Outcome): string => ('ok' in o ? o.ok : `threw ${o.err}`)
        divergences.push(`${label} ${name}(${args.join(', ')}): src=${show(a)} built=${show(b)}`)
      }
    }
  }

  return { compare, divergences, count: () => comparisons }
}

/**
 * Runs every sweep against one built artifact. Both artifacts get the exact
 * same treatment, so ESM and CJS are also proven equal to each other.
 */
function sweepAll(built: Module, label: string): { divergences: string[]; comparisons: number } {
  const { compare, divergences, count } = makeComparer(built, label)

  const MIN = src.MIN_JALAALI_YEAR
  const MAX = src.MAX_JALAALI_YEAR

  // Year-level functions across the whole range, plus out-of-range probes on
  // both sides of each boundary. Cheap enough to always run exhaustively.
  for (let jy = MIN - 2; jy <= MAX + 2; jy += 1) {
    compare('isLeapJalaaliYear', [jy])
    compare('jalCal', [jy])
    compare('jalCalShort', [jy])
    for (let jm = 1; jm <= 12; jm += 1) compare('jalaaliMonthLength', [jy, jm])
  }

  // Day-level: forward conversion, reverse conversion, and the Julian Day
  // round trip, for every day in the supported range.
  for (let jy = MIN; jy <= MAX; jy += 1) {
    for (let jm = 1; jm <= 12; jm += 1) {
      const len = src.jalaaliMonthLength(jy, jm)
      for (let jd = 1; jd <= len; jd += 1) {
        compare('j2d', [jy, jm, jd])
        compare('toGregorian', [jy, jm, jd])
        const jdn = src.j2d(jy, jm, jd)
        compare('d2j', [jdn])
        compare('d2g', [jdn])
      }
    }
  }

  // Gregorian entry points over a band wider than the supported Jalaali range,
  // including Feb 29 and the Nowruz boundary where the year rolls over.
  for (let gy = 600; gy <= 3800; gy += 1) {
    for (const [gm, gd] of [
      [1, 1],
      [2, 29],
      [3, 20],
      [3, 21],
      [6, 15],
      [12, 31],
    ] as const) {
      compare('toJalaali', [gy, gm, gd])
      compare('g2d', [gy, gm, gd])
    }
  }

  // The Date overload of toJalaali, and the two Date-producing helpers. These
  // read the host time zone, but both sides run in the same process.
  for (let i = 0; i < 3000; i += 1) {
    compare('toJalaali', [new Date(Date.UTC(1600 + i, (i * 7) % 12, ((i * 13) % 28) + 1))])
  }
  for (let jy = 1300; jy <= 1500; jy += 1) {
    for (const jm of [1, 6, 7, 12]) {
      for (const jd of [1, 15, 29]) compare('jalaaliWeek', [jy, jm, jd])
    }
    compare('jalaaliToDateObject', [jy, 4, 30, 14, 30, 15, 250])
    compare('jalaaliToDateObject', [jy, 1, 1])
  }

  // Hostile and out-of-range input. Thrown messages must match too, which is
  // what catches a build that loses a range guard.
  for (const bad of [NaN, Infinity, -Infinity, 1e308, -1e308, 0.5, -0, MIN - 1, MAX + 1]) {
    compare('isLeapJalaaliYear', [bad])
    compare('jalCal', [bad])
    compare('jalCalShort', [bad])
    compare('d2j', [bad])
    compare('isValidJalaaliDate', [bad, 1, 1])
  }
  for (let jm = -2; jm <= 15; jm += 1) {
    for (let jd = -2; jd <= 33; jd += 1) compare('isValidJalaaliDate', [1395, jm, jd])
  }

  return { divergences, comparisons: count() }
}

// ---------------------------------------------------------------------------
// Export surface — a build that adds or drops an export is not equivalent
// ---------------------------------------------------------------------------

describe('export surface matches src', () => {
  it.each([
    ['ESM', () => esm],
    ['CJS', () => cjs],
  ])('%s exports exactly the same names as src', (_label, get) => {
    const expected = Object.keys(src).sort()
    // CJS bundles carry a Symbol.toStringTag marker for interop; only string
    // keys are part of the public surface.
    const actual = Object.keys(get()).sort()
    expect(actual).toEqual(expected)
  })

  it.each([
    ['ESM', () => esm],
    ['CJS', () => cjs],
  ])('%s exports have the same types and constant values as src', (_label, get) => {
    for (const [name, value] of Object.entries(src)) {
      expect(typeof get()[name]).toBe(typeof value)
      if (typeof value !== 'function') expect(get()[name]).toEqual(value)
    }
  })
})

// ---------------------------------------------------------------------------
// Behavioral equivalence
// ---------------------------------------------------------------------------

describe('built artifacts behave identically to src', () => {
  it('ESM bundle matches src across the supported range', () => {
    const { divergences, comparisons } = sweepAll(esm, 'ESM')
    expect(comparisons).toBeGreaterThan(4_000_000)
    expect(divergences).toEqual([])
  }, 300_000)

  it('CJS bundle matches src across the supported range', () => {
    const { divergences, comparisons } = sweepAll(cjs, 'CJS')
    expect(comparisons).toBeGreaterThan(4_000_000)
    expect(divergences).toEqual([])
  }, 300_000)
})
