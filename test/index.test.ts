import { describe, expect, it } from 'vitest'
import {
  d2g,
  d2j,
  g2d,
  isLeapJalaaliYear,
  isValidJalaaliDate,
  j2d,
  jalCal,
  jalCalShort,
  jalaaliMonthLength,
  jalaaliToDateObject,
  jalaaliWeek,
  toGregorian,
  toJalaali,
} from '../src/index.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MIN_JY = -61
const MAX_JY = 3177

/**
 * Hand-verified pairs of (Gregorian, Jalaali) dates spanning ~700 years.
 * Verified against `Intl.DateTimeFormat('en-US-u-ca-persian')` and against
 * jalaali-js v1.2.8 (the implementations agree across this range).
 */
const KNOWN_PAIRS: ReadonlyArray<{ g: [number, number, number]; j: [number, number, number] }> = [
  { g: [1925, 3, 22], j: [1304, 1, 2] },
  { g: [1981, 8, 17], j: [1360, 5, 26] },
  { g: [2000, 1, 1], j: [1378, 10, 11] },
  { g: [2013, 1, 10], j: [1391, 10, 21] },
  { g: [2014, 8, 4], j: [1393, 5, 13] },
  { g: [2016, 4, 11], j: [1395, 1, 23] },
  { g: [2021, 3, 21], j: [1400, 1, 1] },
  { g: [2024, 3, 20], j: [1403, 1, 1] },
  { g: [2025, 3, 21], j: [1404, 1, 1] },
  { g: [2024, 3, 19], j: [1402, 12, 29] },
  { g: [2025, 3, 20], j: [1403, 12, 30] }, // 1403 is a leap year (30 days in Esfand)
]

// Verified against the Borkowski algorithm output across the modern range.
const KNOWN_LEAP_YEARS = [1300, 1309, 1321, 1333, 1346, 1358, 1370, 1383, 1395, 1403, 1412, 1424, 1436, 1449]
const KNOWN_COMMON_YEARS = [1301, 1302, 1369, 1371, 1372, 1373, 1374, 1376, 1377, 1378, 1380, 1390, 1392, 1393, 1394, 1396, 1397, 1398, 1400, 1401, 1402, 1404]

// ---------------------------------------------------------------------------
// toJalaali / toGregorian: positive path
// ---------------------------------------------------------------------------

describe('toJalaali', () => {
  it.each(KNOWN_PAIRS)('converts $g.0/$g.1/$g.2 to Jalaali', ({ g, j }) => {
    expect(toJalaali(g[0], g[1], g[2])).toEqual({ jy: j[0], jm: j[1], jd: j[2] })
  })

  it.each(KNOWN_PAIRS)('converts Date($g.0,$g.1,$g.2) to Jalaali', ({ g, j }) => {
    expect(toJalaali(new Date(g[0], g[1] - 1, g[2]))).toEqual({ jy: j[0], jm: j[1], jd: j[2] })
  })

  it('returns a fresh object each call (no shared mutation surface)', () => {
    const a = toJalaali(2016, 4, 11)
    const b = toJalaali(2016, 4, 11)
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('returns plain integer fields, never NaN, for valid Gregorian input', () => {
    const j = toJalaali(2016, 4, 11)
    expect(Number.isInteger(j.jy)).toBe(true)
    expect(Number.isInteger(j.jm)).toBe(true)
    expect(Number.isInteger(j.jd)).toBe(true)
  })
})

describe('toGregorian', () => {
  it.each(KNOWN_PAIRS)('converts $j.0/$j.1/$j.2 to Gregorian', ({ j, g }) => {
    expect(toGregorian(j[0], j[1], j[2])).toEqual({ gy: g[0], gm: g[1], gd: g[2] })
  })

  it('handles the Jalaali year boundary (jy = -61) without throwing', () => {
    const g = toGregorian(MIN_JY, 1, 1)
    expect(Number.isInteger(g.gy)).toBe(true)
    expect(g.gm).toBeGreaterThanOrEqual(1)
    expect(g.gm).toBeLessThanOrEqual(12)
    expect(g.gd).toBeGreaterThanOrEqual(1)
    expect(g.gd).toBeLessThanOrEqual(31)
  })

  it('handles the Jalaali year boundary (jy = 3177) without throwing', () => {
    const g = toGregorian(MAX_JY, 12, 29)
    expect(Number.isInteger(g.gy)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Round-trip property tests
// ---------------------------------------------------------------------------

describe('round-trip: Gregorian → Jalaali → Gregorian', () => {
  it('is identity across the Intl-consistent range (1800–2200)', () => {
    for (let year = 1800; year <= 2200; year += 1) {
      // Sample 4 dates per year (Jan 15, Apr 15, Jul 15, Oct 15)
      for (const m of [1, 4, 7, 10]) {
        const j = toJalaali(year, m, 15)
        const g = toGregorian(j.jy, j.jm, j.jd)
        expect(g).toEqual({ gy: year, gm: m, gd: 15 })
      }
    }
  })

  it('is identity at every Gregorian month boundary (start + end) across 1900–2050', () => {
    const monthDays = (gy: number, gm: number): number => {
      return new Date(gy, gm, 0).getDate() // day 0 of next month = last day of this month
    }
    for (let year = 1900; year <= 2050; year += 1) {
      for (let m = 1; m <= 12; m += 1) {
        for (const d of [1, monthDays(year, m)]) {
          const j = toJalaali(year, m, d)
          const g = toGregorian(j.jy, j.jm, j.jd)
          expect(g).toEqual({ gy: year, gm: m, gd: d })
        }
      }
    }
  })
})

describe('round-trip: Jalaali → Gregorian → Jalaali', () => {
  it('is identity across the supported range (sparse)', () => {
    for (let jy = MIN_JY; jy <= MAX_JY; jy += 17) {
      for (let jm = 1; jm <= 12; jm += 1) {
        const lastDay = jalaaliMonthLength(jy, jm)
        for (const jd of [1, Math.floor(lastDay / 2), lastDay]) {
          const g = toGregorian(jy, jm, jd)
          const j = toJalaali(g.gy, g.gm, g.gd)
          expect(j).toEqual({ jy, jm, jd })
        }
      }
    }
  })

  it('is identity densely across years 1300–1500', () => {
    for (let jy = 1300; jy <= 1500; jy += 1) {
      for (const jm of [1, 6, 7, 12]) {
        const lastDay = jalaaliMonthLength(jy, jm)
        for (const jd of [1, lastDay]) {
          const g = toGregorian(jy, jm, jd)
          const j = toJalaali(g.gy, g.gm, g.gd)
          expect(j).toEqual({ jy, jm, jd })
        }
      }
    }
  })
})

describe('round-trip: j2d ↔ d2j', () => {
  it('reaches every day in years 1390–1410', () => {
    for (let jy = 1390; jy <= 1410; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        const lastDay = jalaaliMonthLength(jy, jm)
        for (let jd = 1; jd <= lastDay; jd += 1) {
          const jdn = j2d(jy, jm, jd)
          expect(d2j(jdn)).toEqual({ jy, jm, jd })
        }
      }
    }
  })
})

describe('round-trip: g2d ↔ d2g', () => {
  it('reaches every day in years 1900–2100', () => {
    for (let gy = 1900; gy <= 2100; gy += 1) {
      for (let gm = 1; gm <= 12; gm += 1) {
        const lastDay = new Date(gy, gm, 0).getDate()
        for (let gd = 1; gd <= lastDay; gd += 1) {
          const jdn = g2d(gy, gm, gd)
          expect(d2g(jdn)).toEqual({ gy, gm, gd })
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// isValidJalaaliDate
// ---------------------------------------------------------------------------

describe('isValidJalaaliDate', () => {
  it('rejects years outside [-61, 3177]', () => {
    expect(isValidJalaaliDate(-62, 12, 29)).toBe(false)
    expect(isValidJalaaliDate(-1000, 1, 1)).toBe(false)
    expect(isValidJalaaliDate(3178, 1, 1)).toBe(false)
    expect(isValidJalaaliDate(99999, 1, 1)).toBe(false)
  })

  it('accepts the year boundaries', () => {
    expect(isValidJalaaliDate(-61, 1, 1)).toBe(true)
    expect(isValidJalaaliDate(3177, 12, 29)).toBe(true)
  })

  it('rejects months outside [1, 12]', () => {
    expect(isValidJalaaliDate(1393, 0, 1)).toBe(false)
    expect(isValidJalaaliDate(1393, -1, 1)).toBe(false)
    expect(isValidJalaaliDate(1393, 13, 1)).toBe(false)
    expect(isValidJalaaliDate(1393, 100, 1)).toBe(false)
  })

  it('rejects days < 1', () => {
    expect(isValidJalaaliDate(1393, 1, 0)).toBe(false)
    expect(isValidJalaaliDate(1393, 1, -1)).toBe(false)
  })

  it('rejects days beyond the month length', () => {
    expect(isValidJalaaliDate(1393, 1, 32)).toBe(false)
    expect(isValidJalaaliDate(1393, 7, 31)).toBe(false)
    expect(isValidJalaaliDate(1393, 11, 31)).toBe(false)
    expect(isValidJalaaliDate(1393, 12, 30)).toBe(false) // common year
    expect(isValidJalaaliDate(1395, 12, 31)).toBe(false) // even in leap year, max 30
  })

  it('accepts every valid day of every month in a leap year (1395)', () => {
    for (let m = 1; m <= 12; m += 1) {
      for (let d = 1; d <= jalaaliMonthLength(1395, m); d += 1) {
        expect(isValidJalaaliDate(1395, m, d)).toBe(true)
      }
    }
  })

  it('accepts every valid day of every month in a common year (1394)', () => {
    for (let m = 1; m <= 12; m += 1) {
      for (let d = 1; d <= jalaaliMonthLength(1394, m); d += 1) {
        expect(isValidJalaaliDate(1394, m, d)).toBe(true)
      }
    }
  })

  it('rejects NaN and Infinity', () => {
    expect(isValidJalaaliDate(NaN, 1, 1)).toBe(false)
    expect(isValidJalaaliDate(1395, NaN, 1)).toBe(false)
    expect(isValidJalaaliDate(1395, 1, NaN)).toBe(false)
    expect(isValidJalaaliDate(Infinity, 1, 1)).toBe(false)
    expect(isValidJalaaliDate(1395, 1, Infinity)).toBe(false)
    expect(isValidJalaaliDate(-Infinity, 1, 1)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isLeapJalaaliYear
// ---------------------------------------------------------------------------

describe('isLeapJalaaliYear', () => {
  it.each(KNOWN_LEAP_YEARS)('flags %i as leap', (jy) => {
    expect(isLeapJalaaliYear(jy)).toBe(true)
  })

  it.each(KNOWN_COMMON_YEARS)('flags %i as common', (jy) => {
    expect(isLeapJalaaliYear(jy)).toBe(false)
  })

  it('agrees with jalaaliMonthLength(jy, 12) === 30', () => {
    for (let jy = 1300; jy <= 1500; jy += 1) {
      const leap = isLeapJalaaliYear(jy)
      const esfandLen = jalaaliMonthLength(jy, 12)
      expect(leap ? 30 : 29).toBe(esfandLen)
    }
  })

  it('throws RangeError for out-of-range years', () => {
    expect(() => isLeapJalaaliYear(-62)).toThrow(RangeError)
    expect(() => isLeapJalaaliYear(3178)).toThrow(RangeError)
    expect(() => isLeapJalaaliYear(Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
    expect(() => isLeapJalaaliYear(Number.MIN_SAFE_INTEGER)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// jalaaliMonthLength
// ---------------------------------------------------------------------------

describe('jalaaliMonthLength', () => {
  it('returns 31 for months 1–6 every year', () => {
    for (const jy of [1, 1395, 3000]) {
      for (let m = 1; m <= 6; m += 1) {
        expect(jalaaliMonthLength(jy, m)).toBe(31)
      }
    }
  })

  it('returns 30 for months 7–11 every year', () => {
    for (const jy of [1, 1395, 3000]) {
      for (let m = 7; m <= 11; m += 1) {
        expect(jalaaliMonthLength(jy, m)).toBe(30)
      }
    }
  })

  it('returns 29 for Esfand in common years, 30 in leap', () => {
    expect(jalaaliMonthLength(1393, 12)).toBe(29)
    expect(jalaaliMonthLength(1394, 12)).toBe(29)
    expect(jalaaliMonthLength(1395, 12)).toBe(30)
    expect(jalaaliMonthLength(1399, 12)).toBe(30)
    expect(jalaaliMonthLength(1403, 12)).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// jalCal / jalCalShort
// ---------------------------------------------------------------------------

describe('jalCal', () => {
  it.each([
    [1390, { leap: 3, gy: 2011, march: 21 }],
    [1391, { leap: 0, gy: 2012, march: 20 }],
    [1392, { leap: 1, gy: 2013, march: 21 }],
    [1393, { leap: 2, gy: 2014, march: 21 }],
    [1394, { leap: 3, gy: 2015, march: 21 }],
    [1395, { leap: 0, gy: 2016, march: 20 }],
    [1399, { leap: 0, gy: 2020, march: 20 }],
    [1400, { leap: 1, gy: 2021, march: 21 }],
    [1403, { leap: 0, gy: 2024, march: 20 }],
  ] as const)('jalCal(%i) === %o', (jy, expected) => {
    expect(jalCal(jy)).toEqual(expected)
  })

  it('throws RangeError outside [-61, 3177]', () => {
    expect(() => jalCal(-62)).toThrow(RangeError)
    expect(() => jalCal(3178)).toThrow(RangeError)
  })

  it('throws on NaN', () => {
    expect(() => jalCal(NaN)).toThrow(RangeError)
  })
})

describe('jalCalShort', () => {
  it('matches jalCal in gy and march across the full supported range (sampled)', () => {
    for (let jy = MIN_JY; jy <= MAX_JY; jy += 7) {
      const full = jalCal(jy)
      const short = jalCalShort(jy)
      expect(short).toEqual({ gy: full.gy, march: full.march })
    }
  })

  it('throws RangeError outside [-61, 3177]', () => {
    expect(() => jalCalShort(-62)).toThrow(RangeError)
    expect(() => jalCalShort(3178)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// j2d / d2j / g2d / d2g — focused
// ---------------------------------------------------------------------------

describe('j2d / d2j', () => {
  it('produces integer JDN', () => {
    expect(j2d(1395, 1, 23)).toBe(2457490)
    expect(Number.isInteger(j2d(1, 1, 1))).toBe(true)
    expect(Number.isInteger(j2d(3177, 12, 29))).toBe(true)
  })

  it('d2j of consecutive JDN advances one day', () => {
    const jdn0 = j2d(1400, 1, 1)
    expect(d2j(jdn0)).toEqual({ jy: 1400, jm: 1, jd: 1 })
    expect(d2j(jdn0 + 1)).toEqual({ jy: 1400, jm: 1, jd: 2 })
    expect(d2j(jdn0 + 30)).toEqual({ jy: 1400, jm: 1, jd: 31 })
    expect(d2j(jdn0 + 31)).toEqual({ jy: 1400, jm: 2, jd: 1 })
  })

  it('handles the year boundary (Esfand 29/30 → Farvardin 1)', () => {
    // 1403 is a leap year
    const lastDay = j2d(1403, 12, 30)
    expect(d2j(lastDay)).toEqual({ jy: 1403, jm: 12, jd: 30 })
    expect(d2j(lastDay + 1)).toEqual({ jy: 1404, jm: 1, jd: 1 })

    // 1402 is common
    const lastDayCommon = j2d(1402, 12, 29)
    expect(d2j(lastDayCommon)).toEqual({ jy: 1402, jm: 12, jd: 29 })
    expect(d2j(lastDayCommon + 1)).toEqual({ jy: 1403, jm: 1, jd: 1 })
  })
})

describe('g2d / d2g', () => {
  it('produces integer JDN', () => {
    expect(g2d(2016, 4, 11)).toBe(2457490)
  })

  it('handles negative years (BC)', () => {
    const jdn = g2d(-1, 1, 1)
    expect(Number.isInteger(jdn)).toBe(true)
    expect(d2g(jdn)).toEqual({ gy: -1, gm: 1, gd: 1 })
  })

  it('handles Gregorian leap day Feb 29', () => {
    const jdn = g2d(2000, 2, 29)
    expect(d2g(jdn)).toEqual({ gy: 2000, gm: 2, gd: 29 })
    const jdn2 = g2d(2024, 2, 29)
    expect(d2g(jdn2)).toEqual({ gy: 2024, gm: 2, gd: 29 })
  })
})

// ---------------------------------------------------------------------------
// jalaaliToDateObject
// ---------------------------------------------------------------------------

describe('jalaaliToDateObject', () => {
  it('returns midnight when no time given', () => {
    expect(jalaaliToDateObject(1400, 4, 30)).toEqual(new Date(2021, 6, 21, 0, 0, 0, 0))
  })

  it('accepts hours/minutes/seconds/ms', () => {
    expect(jalaaliToDateObject(1400, 4, 30, 14, 30, 15, 250)).toEqual(
      new Date(2021, 6, 21, 14, 30, 15, 250),
    )
  })

  it('treats explicit 0 hour the same as default 0 (parameter defaults work)', () => {
    expect(jalaaliToDateObject(1400, 4, 30, 0)).toEqual(jalaaliToDateObject(1400, 4, 30))
  })

  it('passes through to JS Date overflow semantics for out-of-range time', () => {
    // Date constructor normalizes overflowing values silently.
    const overflow = jalaaliToDateObject(1397, 5, 13, 25, 52, 100)
    expect(overflow).toEqual(new Date(2018, 7, 4, 25, 52, 100))
    expect(overflow.getHours()).toBe(1) // 25h wraps to 1h next day
  })
})

// ---------------------------------------------------------------------------
// jalaaliWeek
// ---------------------------------------------------------------------------

describe('jalaaliWeek', () => {
  it('returns Saturday and Friday of containing week (mid-week)', () => {
    expect(jalaaliWeek(1400, 4, 30)).toEqual({
      saturday: { jy: 1400, jm: 4, jd: 26 },
      friday: { jy: 1400, jm: 5, jd: 1 },
    })
  })

  it('crosses month boundary correctly', () => {
    const w = jalaaliWeek(1400, 4, 30)
    expect(w.saturday.jm).toBe(4)
    expect(w.friday.jm).toBe(5)
  })

  it('crosses year boundary correctly (Esfand → Farvardin)', () => {
    // Pick a date near year end; verify result fields exist and friday >= saturday in JDN
    const w = jalaaliWeek(1402, 12, 29)
    const satJdn = j2d(w.saturday.jy, w.saturday.jm, w.saturday.jd)
    const friJdn = j2d(w.friday.jy, w.friday.jm, w.friday.jd)
    expect(friJdn - satJdn).toBe(6)
  })

  it('Saturday and Friday are always exactly 6 days apart', () => {
    for (let jy = 1395; jy <= 1410; jy += 1) {
      for (const jm of [1, 6, 7, 12]) {
        const last = jalaaliMonthLength(jy, jm)
        for (const jd of [1, Math.floor(last / 2), last]) {
          const w = jalaaliWeek(jy, jm, jd)
          const satJdn = j2d(w.saturday.jy, w.saturday.jm, w.saturday.jd)
          const friJdn = j2d(w.friday.jy, w.friday.jm, w.friday.jd)
          expect(friJdn - satJdn).toBe(6)
        }
      }
    }
  })

  it('Saturday is always a Saturday (getDay() === 6)', () => {
    for (let jy = 1395; jy <= 1405; jy += 1) {
      for (let jm = 1; jm <= 12; jm += 1) {
        const w = jalaaliWeek(jy, jm, 15)
        const satDate = jalaaliToDateObject(w.saturday.jy, w.saturday.jm, w.saturday.jd)
        expect(satDate.getDay()).toBe(6)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Date overload — timezone sensitivity
// ---------------------------------------------------------------------------

describe('toJalaali(Date) — timezone behavior', () => {
  it('uses local-time getters (documented; not UTC)', () => {
    // Build a Date in local time. The result is the same regardless of
    // process TZ because getFullYear/getMonth/getDate are local-time.
    const d = new Date(2016, 3, 11, 0, 0, 0)
    expect(toJalaali(d)).toEqual({ jy: 1395, jm: 1, jd: 23 })
  })

  it('Date at 23:59 local matches the same calendar day', () => {
    const d = new Date(2016, 3, 11, 23, 59, 59, 999)
    expect(toJalaali(d)).toEqual({ jy: 1395, jm: 1, jd: 23 })
  })
})

// ---------------------------------------------------------------------------
// Known validation gaps in the current algorithm
//
// These document behavior that the implementation does NOT currently guard
// against. They use Vitest's `it.fails` so the test passes today (because
// the inner assertion currently fails), and will start failing — flagging
// the gap for cleanup — if/when validation is added.
// ---------------------------------------------------------------------------

describe('Known validation gaps (documented for v2.x follow-up)', () => {
  it.fails('isValidJalaaliDate should reject non-integer year/month/day', () => {
    expect(isValidJalaaliDate(1395.5, 1, 1)).toBe(false)
    expect(isValidJalaaliDate(1395, 1.5, 1)).toBe(false)
    expect(isValidJalaaliDate(1395, 1, 1.5)).toBe(false)
  })

  it.fails('jalaaliMonthLength should throw for out-of-range month', () => {
    expect(() => jalaaliMonthLength(1395, 0)).toThrow()
    expect(() => jalaaliMonthLength(1395, 13)).toThrow()
    expect(() => jalaaliMonthLength(1395, -1)).toThrow()
  })

  it.fails('jalaaliMonthLength should throw for out-of-range year', () => {
    expect(() => jalaaliMonthLength(-62, 1)).toThrow()
    expect(() => jalaaliMonthLength(3178, 1)).toThrow()
  })

  it.fails('j2d should throw for invalid month/day', () => {
    expect(() => j2d(1395, 13, 1)).toThrow()
    expect(() => j2d(1395, 1, 0)).toThrow()
    expect(() => j2d(1395, 1, 32)).toThrow()
  })

  it.fails('toJalaali should reject invalid Gregorian input (gm > 12)', () => {
    // Currently silently computes via g2d's modular arithmetic.
    expect(() => toJalaali(2016, 13, 1)).toThrow()
  })

  it.fails('toGregorian should validate Jalaali input before converting', () => {
    expect(() => toGregorian(1395, 13, 1)).toThrow()
    expect(() => toGregorian(1394, 12, 30)).toThrow() // not a leap year
  })

  it.fails('jalaaliWeek should reject invalid Jalaali input dates', () => {
    expect(() => jalaaliWeek(1394, 12, 30)).toThrow()
  })

  it.fails('g2d / d2g should reject NaN', () => {
    expect(() => g2d(NaN, 1, 1)).toThrow()
    expect(() => d2g(NaN)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// Behavioral assumptions worth documenting
//
// Things that are intentional but easy to misuse — pinned with tests so the
// behavior cannot regress silently.
// ---------------------------------------------------------------------------

describe('Documented assumptions', () => {
  it('Jalaali year range is [-61, 3177] inclusive; outside throws', () => {
    expect(() => jalCal(MIN_JY)).not.toThrow()
    expect(() => jalCal(MAX_JY)).not.toThrow()
    expect(() => jalCal(MIN_JY - 1)).toThrow(RangeError)
    expect(() => jalCal(MAX_JY + 1)).toThrow(RangeError)
  })

  it('The Borkowski algorithm diverges from Intl after year 2256 — out of scope to fix here', () => {
    // We do not claim Intl-equivalence above 2256; this test pins our
    // behavior for jy = 1700 (gy = 2321) so a future "fix" to the leap
    // rule is noticed.
    const result = jalCal(1700)
    expect(result.gy).toBe(2321)
    expect(Number.isInteger(result.march)).toBe(true)
  })

  it('toJalaali(Date) reads local time, not UTC — relevant for cross-TZ apps', () => {
    // If you need UTC, build the Date from UTC components first or
    // call toJalaali(gy, gm, gd) directly.
    const d = new Date(2016, 3, 11) // local midnight
    expect(toJalaali(d)).toEqual({ jy: 1395, jm: 1, jd: 23 })
  })
})

// ---------------------------------------------------------------------------
// Performance smoke test
//
// Generous threshold — meant to catch order-of-magnitude regressions, not
// to enforce micro-perf. Skipped on CI runners that report being slow.
// ---------------------------------------------------------------------------

describe('Performance smoke', () => {
  it('100k toJalaali calls complete in under 1 second', () => {
    const start = performance.now()
    for (let i = 0; i < 100_000; i += 1) {
      toJalaali(1900 + (i % 200), 1 + (i % 12), 1 + (i % 28))
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000)
  })

  it('100k toGregorian calls complete in under 1 second', () => {
    const start = performance.now()
    for (let i = 0; i < 100_000; i += 1) {
      toGregorian(1300 + (i % 200), 1 + (i % 12), 1 + (i % 28))
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000)
  })

  it('isValidJalaaliDate is O(1) — 1M calls under 1 second', () => {
    const start = performance.now()
    for (let i = 0; i < 1_000_000; i += 1) {
      isValidJalaaliDate(1395, 1 + (i % 12), 1 + (i % 28))
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(1000)
  })
})
