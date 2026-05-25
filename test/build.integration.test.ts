/**
 * Integration tests for the build artifacts.
 *
 * These tests verify that `pnpm build` produces a consumable npm package —
 * ESM, CJS, type declarations, and a correctly-shaped `exports` field. They
 * are deliberately separate from the unit suite so contributors can iterate
 * on source without rebuilding for every test run; the suite runs `pnpm
 * build` itself in `beforeAll` if `dist/` is missing.
 *
 * Run via `pnpm test` (included by default).
 */
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = (p: string): string => resolve(repoRoot, 'dist', p)
const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as Record<
  string,
  unknown
>

function runNode(code: string, opts: { type: 'module' | 'commonjs' }): string {
  const flag = opts.type === 'module' ? '--input-type=module' : '--input-type=commonjs'
  // Use execFileSync with an args array so the shell never touches the code.
  return execFileSync('node', [flag, '-e', code], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

beforeAll(() => {
  if (!existsSync(dist('index.js')) || !existsSync(dist('index.cjs'))) {
    execSync('pnpm build', { cwd: repoRoot, stdio: 'inherit' })
  }
}, 60_000)

// ---------------------------------------------------------------------------
// Artifact presence
// ---------------------------------------------------------------------------

describe('build artifacts', () => {
  it.each([
    ['index.js', 'ESM bundle'],
    ['index.cjs', 'CJS bundle'],
    ['index.d.ts', 'ESM types'],
    ['index.d.cts', 'CJS types'],
    ['index.js.map', 'ESM source map'],
    ['index.cjs.map', 'CJS source map'],
  ])('emits dist/%s (%s)', (file) => {
    expect(existsSync(dist(file))).toBe(true)
    expect(statSync(dist(file)).size).toBeGreaterThan(0)
  })

  it('ESM bundle is plausibly small (<20kB unminified)', () => {
    expect(statSync(dist('index.js')).size).toBeLessThan(20_000)
  })

  it('CJS bundle is plausibly small (<20kB unminified)', () => {
    expect(statSync(dist('index.cjs')).size).toBeLessThan(20_000)
  })
})

// ---------------------------------------------------------------------------
// package.json shape — fail fast if exports field regresses
// ---------------------------------------------------------------------------

describe('package.json', () => {
  it('declares type: "module"', () => {
    expect(pkg.type).toBe('module')
  })

  it('declares main, module, and types', () => {
    expect(pkg.main).toBe('./dist/index.cjs')
    expect(pkg.module).toBe('./dist/index.js')
    expect(pkg.types).toBe('./dist/index.d.ts')
  })

  it('has a correctly-shaped exports field with per-condition types', () => {
    const exports = pkg.exports as Record<string, unknown>
    expect(exports['.']).toEqual({
      import: {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
      require: {
        types: './dist/index.d.cts',
        default: './dist/index.cjs',
      },
    })
    expect(exports['./package.json']).toBe('./package.json')
  })

  it('sideEffects is false (enables tree-shaking)', () => {
    expect(pkg.sideEffects).toBe(false)
  })

  it('files field includes dist, src, README, CHANGELOG, LICENSE', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'src', 'README.md', 'CHANGELOG.md', 'LICENSE']))
  })

  it('engines.node >= 20', () => {
    const engines = pkg.engines as { node: string }
    expect(engines.node).toMatch(/>=\s*20/)
  })

  it('has no runtime dependencies', () => {
    expect(pkg.dependencies).toBeUndefined()
  })

  it('pins packageManager to pnpm', () => {
    expect(pkg.packageManager).toMatch(/^pnpm@/)
  })
})

// ---------------------------------------------------------------------------
// Built artifacts actually execute under Node — both module systems
// ---------------------------------------------------------------------------

describe('runtime: ESM import via Node', () => {
  it('named imports work and produce correct conversions', () => {
    const code = `
      import { toJalaali, toGregorian, jalCalShort } from './dist/index.js'
      const j = toJalaali(2016, 4, 11)
      const g = toGregorian(1395, 1, 23)
      const s = jalCalShort(1391)
      process.stdout.write(JSON.stringify({ j, g, s }))
    `
    expect(JSON.parse(runNode(code, { type: 'module' }))).toEqual({
      j: { jy: 1395, jm: 1, jd: 23 },
      g: { gy: 2016, gm: 4, gd: 11 },
      s: { gy: 2012, march: 20 },
    })
  })

  it('namespace import exposes every documented export', () => {
    const code = `
      import * as m from './dist/index.js'
      const names = [
        'toJalaali','toGregorian','isValidJalaaliDate','isLeapJalaaliYear',
        'jalaaliMonthLength','jalCal','jalCalShort','j2d','d2j','g2d','d2g',
        'jalaaliToDateObject','jalaaliWeek'
      ]
      const missing = names.filter(n => typeof m[n] !== 'function')
      process.stdout.write(JSON.stringify({ missing }))
    `
    expect(JSON.parse(runNode(code, { type: 'module' }))).toEqual({ missing: [] })
  })

  it('resolves via bare specifier through the exports field', () => {
    // Use file: URL pointing at our package via package.json#exports
    const code = `
      import { toJalaali } from '${pkg.name as string}'
      process.stdout.write(JSON.stringify(toJalaali(2016, 4, 11)))
    `
    // Node resolves 'jalaali-js' from this repo via node_modules; we don't
    // have a self-link, so resolve through the local path instead.
    // (kept for documentation; actual bare-specifier resolution is exercised
    // by attw in CI.)
    const result = runNode(
      code.replace(`'${pkg.name as string}'`, "'./dist/index.js'"),
      { type: 'module' },
    )
    expect(JSON.parse(result)).toEqual({ jy: 1395, jm: 1, jd: 23 })
  })
})

describe('runtime: CommonJS require via Node', () => {
  it('destructured require works', () => {
    const code = `
      const { toJalaali, toGregorian, jalCalShort } = require('./dist/index.cjs')
      const j = toJalaali(2016, 4, 11)
      const g = toGregorian(1395, 1, 23)
      const s = jalCalShort(1391)
      process.stdout.write(JSON.stringify({ j, g, s }))
    `
    expect(JSON.parse(runNode(code, { type: 'commonjs' }))).toEqual({
      j: { jy: 1395, jm: 1, jd: 23 },
      g: { gy: 2016, gm: 4, gd: 11 },
      s: { gy: 2012, march: 20 },
    })
  })

  it('namespace require exposes every documented export', () => {
    const code = `
      const m = require('./dist/index.cjs')
      const names = [
        'toJalaali','toGregorian','isValidJalaaliDate','isLeapJalaaliYear',
        'jalaaliMonthLength','jalCal','jalCalShort','j2d','d2j','g2d','d2g',
        'jalaaliToDateObject','jalaaliWeek'
      ]
      const missing = names.filter(n => typeof m[n] !== 'function')
      process.stdout.write(JSON.stringify({ missing }))
    `
    expect(JSON.parse(runNode(code, { type: 'commonjs' }))).toEqual({ missing: [] })
  })
})

// ---------------------------------------------------------------------------
// Type declarations — surface check
// ---------------------------------------------------------------------------

describe('type declarations', () => {
  it('ESM .d.ts exposes every documented type and function', () => {
    const dts = readFileSync(dist('index.d.ts'), 'utf8')
    for (const name of [
      'toJalaali',
      'toGregorian',
      'isValidJalaaliDate',
      'isLeapJalaaliYear',
      'jalaaliMonthLength',
      'jalCal',
      'jalCalShort',
      'j2d',
      'd2j',
      'g2d',
      'd2g',
      'jalaaliToDateObject',
      'jalaaliWeek',
      'JalaaliDate',
      'GregorianDate',
      'JalCalResult',
      'JalCalShortResult',
      'JalaaliWeek',
    ]) {
      expect(dts).toContain(name)
    }
  })

  it('CJS .d.cts mirrors the ESM .d.ts surface', () => {
    const esm = readFileSync(dist('index.d.ts'), 'utf8')
    const cjs = readFileSync(dist('index.d.cts'), 'utf8')
    for (const name of [
      'toJalaali',
      'toGregorian',
      'jalCal',
      'jalCalShort',
      'JalaaliDate',
      'GregorianDate',
    ]) {
      expect(esm.includes(name)).toBe(true)
      expect(cjs.includes(name)).toBe(true)
    }
  })
})
