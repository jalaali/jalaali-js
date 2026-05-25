# Jalaali JavaScript

TypeScript / JavaScript functions for converting between the **Jalaali**
(Jalali, Persian, Khayyami, Khorshidi, Shamsi) and **Gregorian** calendar
systems.

- Written in TypeScript, with first-class `.d.ts` types
- Dual **ESM** and **CommonJS** publish via the `exports` field
- Zero runtime dependencies
- Same proven [Borkowski algorithm][bork] as v1 — bit-for-bit compatible
  conversions

> **v2 is a major release.** If you are upgrading from v1, read the
> [migration guide][changelog] in `CHANGELOG.md`.

## Note on the `Intl` API

If you just need to *display* a date and time in the Persian calendar, the
ECMAScript `Intl` API has [excellent browser support][caniuse] and may be
enough:

```ts
const d = new Date(2022, 2, 21)

new Intl.DateTimeFormat('fa-IR').format(d)
// => ۱۴۰۱/۱/۱

new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeStyle: 'long' }).format(d)
// => ۱۴۰۱ فروردین ۱, دوشنبه، ساعت ۰:۰۰:۰۰ (‎+۳:۳۰ گرینویچ)

new Intl.DateTimeFormat('en-US-u-ca-persian', { dateStyle: 'full' }).format(d)
// => Monday, Farvardin 1, 1401 AP
```

> The `jalaali-js` algorithm diverges from `Intl` after Gregorian year
> 2256 (Jalali 1634) because of how leap years are computed. Inside the
> 1800–2256 range the two agree exactly. See [this comparison][cmp].

Reach for `jalaali-js` when you need to *manipulate* dates — arithmetic,
validation, week boundaries, Julian Day numbers — or when you target
runtimes (or environments) that ship without `Intl`.

## Install

```sh
pnpm add jalaali-js
# or
npm install jalaali-js
# or
yarn add jalaali-js
```

Requires Node 20 or newer.

## Usage

### ESM (recommended)

```ts
import { toJalaali, toGregorian } from 'jalaali-js'

toJalaali(2016, 4, 11) // { jy: 1395, jm: 1, jd: 23 }
toGregorian(1395, 1, 23) // { gy: 2016, gm: 4, gd: 11 }
```

### CommonJS

```js
const { toJalaali, toGregorian } = require('jalaali-js')

toJalaali(2016, 4, 11)
```

### Browser via CDN

The npm package ships ESM and CJS; consume it through a CDN that supports
ESM imports:

```html
<script type="module">
  import { toJalaali } from 'https://esm.sh/jalaali-js'
  console.log(toJalaali(2016, 4, 11))
</script>
```

## API

All exports are named and fully typed.

### `toJalaali(gy, gm, gd) → { jy, jm, jd }`

```ts
toJalaali(2016, 4, 11) // { jy: 1395, jm: 1, jd: 23 }
```

### `toJalaali(date) → { jy, jm, jd }`

```ts
toJalaali(new Date(2016, 3, 11)) // { jy: 1395, jm: 1, jd: 23 }
```

### `toGregorian(jy, jm, jd) → { gy, gm, gd }`

```ts
toGregorian(1395, 1, 23) // { gy: 2016, gm: 4, gd: 11 }
```

### `isValidJalaaliDate(jy, jm, jd) → boolean`

```ts
isValidJalaaliDate(1394, 12, 30) // false
isValidJalaaliDate(1395, 12, 30) // true
```

### `isLeapJalaaliYear(jy) → boolean`

```ts
isLeapJalaaliYear(1394) // false
isLeapJalaaliYear(1395) // true
```

Throws `RangeError` if `jy` is outside the supported range
(`-61 … 3177`).

### `jalaaliMonthLength(jy, jm) → number`

```ts
jalaaliMonthLength(1394, 12) // 29
jalaaliMonthLength(1395, 12) // 30
```

### `jalCal(jy) → { leap, gy, march }`

Whether the Jalaali year is leap (`leap === 0`), the Gregorian year of
its start, and the day in March of Farvardin 1.

```ts
jalCal(1390) // { leap: 3, gy: 2011, march: 21 }
jalCal(1391) // { leap: 0, gy: 2012, march: 20 }
jalCal(1395) // { leap: 0, gy: 2016, march: 20 }
```

### `jalCalShort(jy) → { gy, march }`

Faster variant that skips the leap-cycle calculation when you only need
`gy` and `march`. **New in v2**; replaces the v1 `jalCal(jy, true)`
overload.

```ts
jalCalShort(1391) // { gy: 2012, march: 20 }
```

### `j2d(jy, jm, jd) → number`

Jalaali date → Julian Day number.

```ts
j2d(1395, 1, 23) // 2457490
```

### `d2j(jdn) → { jy, jm, jd }`

Julian Day number → Jalaali date.

```ts
d2j(2457490) // { jy: 1395, jm: 1, jd: 23 }
```

### `g2d(gy, gm, gd) → number`

Gregorian date → Julian Day number. Tested good from
1 March, -100100 (of both calendars) up to a few million years
into the future.

```ts
g2d(2016, 4, 11) // 2457490
```

### `d2g(jdn) → { gy, gm, gd }`

Julian Day number → Gregorian date. Covers `jdn ≥ -34839655`
(year -100100 of both calendars).

```ts
d2g(2457490) // { gy: 2016, gm: 4, gd: 11 }
```

### `jalaaliToDateObject(jy, jm, jd, h?, m?, s?, ms?) → Date`

Convert a Jalaali date (optionally with time) to a JavaScript `Date`.

```ts
jalaaliToDateObject(1400, 4, 30) // new Date(2021, 6, 21)
jalaaliToDateObject(1400, 4, 30, 14, 30) // new Date(2021, 6, 21, 14, 30)
```

### `jalaaliWeek(jy, jm, jd) → { saturday, friday }`

Saturday and Friday of the Jalaali week containing the given date.
The Jalaali week starts on Saturday.

```ts
jalaaliWeek(1400, 4, 30)
// { saturday: { jy: 1400, jm: 4, jd: 26 },
//   friday:   { jy: 1400, jm: 5, jd: 1 } }
```

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm bench
```

## About

The Jalali calendar is a solar calendar used historically in Persia and
still in use today in Iran and Afghanistan. See [Wikipedia][wiki] and the
[Calendar Converter][calconv] for background.

Conversions are based on the algorithm by [Kazimierz M. Borkowski][bork].

## License

MIT

[bork]: http://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm
[caniuse]: https://caniuse.com/mdn-javascript_builtins_intl_datetimeformat_format
[cmp]: https://runkit.com/sinakhx/625929b1a90c8d0007b539a3
[changelog]: ./CHANGELOG.md
[wiki]: http://en.wikipedia.org/wiki/Jalali_calendar
[calconv]: http://www.fourmilab.ch/documents/calendar/
