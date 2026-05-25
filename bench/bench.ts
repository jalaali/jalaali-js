import {
  isLeapJalaaliYear,
  isValidJalaaliDate,
  toGregorian,
  toJalaali,
} from '../src/index.js'

const N = 1_000_000

console.log('Benchmarking, %s times', N)

run('toGregorian', () => {
  let count = N
  for (;;) {
    for (let y = 1; y <= 3000; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        for (let d = 1; d <= 30; d += 1) {
          toGregorian(y, m, d)
          if (--count === 0) return
        }
      }
    }
  }
})

run('toJalaali', () => {
  let count = N
  for (;;) {
    for (let y = 560; y <= 3560; y += 1) {
      for (let m = 1; m <= 12; m += 1) {
        for (let d = 1; d <= 30; d += 1) {
          toJalaali(y, m, d)
          if (--count === 0) return
        }
      }
    }
  }
})

run('isLeapJalaaliYear', () => {
  let count = N
  for (;;) {
    for (let y = 1; y <= 3000; y += 1) {
      isLeapJalaaliYear(y)
      if (--count === 0) return
    }
  }
})

run('isValidJalaaliDate', () => {
  let count = N
  for (;;) {
    for (let y = 1; y <= 3000; y += 1) {
      for (let m = 1; m <= 13; m += 1) {
        for (let d = 1; d <= 32; d += 1) {
          isValidJalaaliDate(y, m, d)
          if (--count === 0) return
        }
      }
    }
  }
})

function run(name: string, fn: () => void): void {
  const label = name.padEnd(20)
  console.time(label)
  fn()
  console.timeEnd(label)
}
