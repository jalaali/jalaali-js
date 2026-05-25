/**
 * **jalaali-js** — Conversions between the Jalaali (Persian) and Gregorian
 * calendar systems.
 *
 * The conversion algorithm is the one published by Kazimierz M. Borkowski
 * in *The Persian calendar for 3000 years* (1996); it is exact within the
 * Jalaali year range `-61 … 3177` inclusive. Outside that range the
 * functions in this module throw {@link RangeError}.
 *
 * The Borkowski algorithm diverges from the leap-year rule used by the
 * ECMAScript `Intl` API (`en-US-u-ca-persian`) after Gregorian year 2256
 * (Jalaali 1634). Inside the range `1800 … 2256` the two agree exactly.
 *
 * @see https://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A date in the Jalaali (Persian) calendar. */
export interface JalaaliDate {
  /** Jalaali year (`-61 … 3177`). */
  jy: number
  /** Jalaali month (`1 … 12`; 1 = Farvardin). */
  jm: number
  /** Jalaali day of month (`1 … 31`). */
  jd: number
}

/** A date in the Gregorian (proleptic) calendar. */
export interface GregorianDate {
  /** Gregorian year. BC years are numbered `0, -1, -2, …`. */
  gy: number
  /** Gregorian month (`1 … 12`). */
  gm: number
  /** Gregorian day of month (`1 … 31`). */
  gd: number
}

/** Full result of {@link jalCal}. */
export interface JalCalResult {
  /**
   * Number of years since the last leap year (`0 … 4`).
   * `0` means the year *is* a leap year.
   */
  leap: number
  /** Gregorian year of the beginning of the Jalaali year. */
  gy: number
  /** Day of March (Gregorian) on which Farvardin 1 falls. */
  march: number
}

/** Slim result of {@link jalCalShort} — omits the leap-cycle computation. */
export interface JalCalShortResult {
  /** Gregorian year of the beginning of the Jalaali year. */
  gy: number
  /** Day of March (Gregorian) on which Farvardin 1 falls. */
  march: number
}

/** Bounds of a Jalaali week, returned by {@link jalaaliWeek}. */
export interface JalaaliWeek {
  /** Saturday of the containing Jalaali week. */
  saturday: JalaaliDate
  /** Friday of the containing Jalaali week. */
  friday: JalaaliDate
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Jalaali years that begin a new 33-year leap cycle. Used by the
 * Borkowski algorithm to locate the correct cycle for any given year.
 */
const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
  1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
] as const

/** Minimum supported Jalaali year (inclusive). */
export const MIN_JALAALI_YEAR = BREAKS[0]

/** Maximum supported Jalaali year (inclusive). */
export const MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1

// ---------------------------------------------------------------------------
// High-level conversions
// ---------------------------------------------------------------------------

/**
 * Converts a Gregorian date to Jalaali.
 *
 * Two call forms are supported: individual Gregorian components, or a
 * `Date` object whose **local-time** year/month/day are read. If you need
 * UTC semantics, build the Gregorian components from `Date.prototype.getUTC*`
 * yourself and pass them in.
 *
 * @example
 * toJalaali(2016, 4, 11)            // { jy: 1395, jm: 1, jd: 23 }
 * toJalaali(new Date(2016, 3, 11))  // { jy: 1395, jm: 1, jd: 23 }
 *
 * @throws {RangeError} if the resulting Jalaali year falls outside
 *   `[-61, 3177]`. In practice this means a Gregorian year roughly outside
 *   `[560, 3798]`.
 */
export function toJalaali(date: Date): JalaaliDate
export function toJalaali(gy: number, gm: number, gd: number): JalaaliDate
export function toJalaali(
  gyOrDate: number | Date,
  gm?: number,
  gd?: number,
): JalaaliDate {
  if (gyOrDate instanceof Date) {
    return d2j(
      g2d(gyOrDate.getFullYear(), gyOrDate.getMonth() + 1, gyOrDate.getDate()),
    )
  }
  return d2j(g2d(gyOrDate, gm as number, gd as number))
}

/**
 * Converts a Jalaali date to Gregorian.
 *
 * @example
 * toGregorian(1395, 1, 23) // { gy: 2016, gm: 4, gd: 11 }
 *
 * @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
 */
export function toGregorian(jy: number, jm: number, jd: number): GregorianDate {
  return d2g(j2d(jy, jm, jd))
}

// ---------------------------------------------------------------------------
// Validity and leap-year helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` if `(jy, jm, jd)` is a real date in the Jalaali calendar.
 *
 * The check is **lenient** — non-integer inputs that happen to fall inside
 * the allowed numeric ranges are accepted. Pass integers in production code.
 *
 * @example
 * isValidJalaaliDate(1394, 12, 30) // false (1394 is a common year)
 * isValidJalaaliDate(1395, 12, 30) // true  (1395 is leap)
 */
export function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean {
  return (
    jy >= MIN_JALAALI_YEAR && jy <= MAX_JALAALI_YEAR &&
    jm >= 1 && jm <= 12 &&
    jd >= 1 && jd <= jalaaliMonthLength(jy, jm)
  )
}

/**
 * Returns `true` if the given Jalaali year is leap (366 days).
 *
 * @example
 * isLeapJalaaliYear(1394) // false
 * isLeapJalaaliYear(1395) // true
 *
 * @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
 */
export function isLeapJalaaliYear(jy: number): boolean {
  return jalCalLeap(jy) === 0
}

/**
 * Returns the number of days in the given Jalaali month.
 *
 * The function trusts its inputs: `jm` is not range-checked, and an
 * out-of-range `jm` will return whichever branch happens to match.
 * For input validation, use {@link isValidJalaaliDate} instead.
 *
 * @example
 * jalaaliMonthLength(1394, 12) // 29 (common year)
 * jalaaliMonthLength(1395, 12) // 30 (leap year)
 */
export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isLeapJalaaliYear(jy) ? 30 : 29
}

// ---------------------------------------------------------------------------
// Calendar-cycle helpers (low-level)
// ---------------------------------------------------------------------------

/**
 * Computes the leap-cycle state of a Jalaali year and the Gregorian date
 * of Farvardin 1 in that year.
 *
 * Use this directly when you need the leap field; if you only need
 * `{ gy, march }`, prefer {@link jalCalShort}.
 *
 * @example
 * jalCal(1391) // { leap: 0, gy: 2012, march: 20 }
 * jalCal(1395) // { leap: 0, gy: 2016, march: 20 }
 *
 * @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
 */
export function jalCal(jy: number): JalCalResult {
  const { gy, march, jump, n } = jalCalCore(jy)
  return { leap: leapFromCycle(jump, n), gy, march }
}

/**
 * Like {@link jalCal} but omits the leap-cycle computation.
 *
 * @remarks
 * Equivalent to v1's `jalCal(jy, true)` — extracted to its own export
 * in v2 to give it a proper return type. Prefer this when the leap field
 * isn't needed; it avoids a small amount of work per call.
 *
 * @example
 * jalCalShort(1391) // { gy: 2012, march: 20 }
 *
 * @throws {RangeError} if `jy` falls outside `[-61, 3177]`.
 */
export function jalCalShort(jy: number): JalCalShortResult {
  const { gy, march } = jalCalCore(jy)
  return { gy, march }
}

// ---------------------------------------------------------------------------
// Julian Day number conversions
// ---------------------------------------------------------------------------

/**
 * Converts a Jalaali date to a Julian Day number.
 *
 * The result is an integer corresponding to noon UT on the given calendar
 * day. Inputs are not range-checked — pass valid dates.
 *
 * @example
 * j2d(1395, 1, 23) // 2457490
 */
export function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCalShort(jy)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

/**
 * Converts a Julian Day number to a Jalaali date.
 *
 * @example
 * d2j(2457490) // { jy: 1395, jm: 1, jd: 23 }
 */
export function d2j(jdn: number): JalaaliDate {
  // Walk to the Gregorian year, then convert to its Jalaali counterpart.
  const gy = d2g(jdn).gy
  let jy = gy - 621
  const r = jalCal(jy)
  const jdn1f = g2d(gy, 3, r.march)

  // Days since Farvardin 1.
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) {
      // First six months are 31 days each.
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }
    }
    // The remaining months are 30 days each.
    k -= 186
  } else {
    // The JDN falls in the *previous* Jalaali year.
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }
}

/**
 * Converts a Gregorian date to a Julian Day number.
 *
 * Tested correct from 1 March, -100100 (of both calendars) through several
 * million years into the future.
 *
 * @example
 * g2d(2016, 4, 11) // 2457490
 */
export function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

/**
 * Converts a Julian Day number to a Gregorian date.
 *
 * Valid for `jdn ≥ -34839655` (year -100100 of both calendars).
 *
 * @example
 * d2g(2457490) // { gy: 2016, gm: 4, gd: 11 }
 */
export function d2g(jdn: number): GregorianDate {
  let j = 4 * jdn + 139361631
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

// ---------------------------------------------------------------------------
// Interoperability with JavaScript's `Date`
// ---------------------------------------------------------------------------

/**
 * Converts a Jalaali date (optionally with a time of day) to a JavaScript
 * `Date` constructed in the local time zone.
 *
 * Time components default to `0`. Out-of-range time components are *not*
 * clamped — they overflow the way the `Date` constructor handles them
 * (e.g. `h = 25` rolls into the next day).
 *
 * @example
 * jalaaliToDateObject(1400, 4, 30)
 *   // → new Date(2021, 6, 21, 0, 0, 0, 0)
 *
 * jalaaliToDateObject(1400, 4, 30, 14, 30)
 *   // → new Date(2021, 6, 21, 14, 30)
 */
export function jalaaliToDateObject(
  jy: number,
  jm: number,
  jd: number,
  h: number = 0,
  m: number = 0,
  s: number = 0,
  ms: number = 0,
): Date {
  const g = toGregorian(jy, jm, jd)
  return new Date(g.gy, g.gm - 1, g.gd, h, m, s, ms)
}

/**
 * Returns the Saturday and Friday bounding the Jalaali week that contains
 * the given date. The Jalaali week starts on **Saturday**.
 *
 * @example
 * jalaaliWeek(1400, 4, 30)
 *   // → { saturday: { jy: 1400, jm: 4, jd: 26 },
 *   //     friday:   { jy: 1400, jm: 5, jd:  1 } }
 *
 * @remarks
 * Uses {@link jalaaliToDateObject} to read the day-of-week, which reflects
 * the host's local time zone. For dates near a DST boundary the underlying
 * `Date.getDay()` is still correct because the conversion is done in local
 * time on both sides.
 */
export function jalaaliWeek(jy: number, jm: number, jd: number): JalaaliWeek {
  const dayOfWeek = jalaaliToDateObject(jy, jm, jd).getDay()
  // getDay(): Sunday = 0, Monday = 1, …, Saturday = 6.
  // The Jalaali week starts on Saturday, so we count back to it.
  const startDayDifference = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1)
  const endDayDifference = 6 + startDayDifference
  return {
    saturday: d2j(j2d(jy, jm, jd + startDayDifference)),
    friday: d2j(j2d(jy, jm, jd + endDayDifference)),
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface JalCalCore {
  gy: number
  march: number
  /** Length of the current 33-year-aligned cycle. */
  jump: number
  /** Year offset within the current cycle. */
  n: number
}

/**
 * Core of the Borkowski algorithm: locate the Jalaali year inside the
 * cycle table and compute Farvardin 1's Gregorian date.
 */
function jalCalCore(jy: number): JalCalCore {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) {
    throw new RangeError(
      `Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`,
    )
  }

  const gy = jy + 621
  let leapJ = -14
  let jp: number = BREAKS[0]
  let jm = 0
  let jump = 0

  // Find the limiting years for the Jalaali year `jy`.
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i] as number
    jump = jm - jp
    if (jy < jm) break
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  const n = jy - jp

  // Number of Persian-calendar leap years from AD 621 to the start of `jy`.
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1

  // Same count for the Gregorian calendar up to year `gy`.
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150

  // Gregorian date (March day) of Farvardin 1.
  const march = 20 + leapJ - leapG

  return { gy, march, jump, n }
}

/**
 * Given a 33-year cycle length `jump` and the year offset `n` within that
 * cycle, returns the number of years since the last leap year (`0 … 4`).
 * `0` means the current year is leap.
 */
function leapFromCycle(jump: number, n: number): number {
  let adjusted = n
  if (jump - n < 6) {
    adjusted = n - jump + div(jump + 4, 33) * 33
  }
  let leap = mod(mod(adjusted + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return leap
}

/**
 * Leap-only variant — same loop as {@link jalCalCore} without computing
 * the Gregorian fields. Kept separate to avoid the per-call object
 * allocation on the hot `isLeapJalaaliYear` path.
 */
function jalCalLeap(jy: number): number {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) {
    throw new RangeError(
      `Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`,
    )
  }

  let jp: number = BREAKS[0]
  let jm = 0
  let jump = 0
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i] as number
    jump = jm - jp
    if (jy < jm) break
    jp = jm
  }
  return leapFromCycle(jump, jy - jp)
}

/**
 * Integer division — `Math.trunc(a / b)` equivalent that's faster on V8
 * for values that fit in 32 bits. Used pervasively inside the algorithm.
 */
function div(a: number, b: number): number {
  return ~~(a / b)
}

/**
 * Mathematical modulo — like `%` but always returns a non-negative result
 * when `b` is positive (matches Python's `%` semantics, not JavaScript's).
 */
function mod(a: number, b: number): number {
  return a - ~~(a / b) * b
}
