var j = require('./index')
  , n = 1000000

console.log('Benchmarking, %s times', n)

var lap = stopWatch('toGregorian')
toGregorianBench()
lap()

lap = stopWatch('toJalaali')
toJalaaliBench()
lap()

lap = stopWatch('isLeapJalaaliYear')
isLeapJalaaliYearBench()
lap();

lap = stopWatch('isValidJalaaliDate')
isValidJalaaliDateBench()
lap();

function stopWatch(name) {
  var niceName = name + Array(20 - name.length).join(' ')
  console.time(niceName)
  return function () {
    console.timeEnd(niceName)
  }
}

function toGregorianBench() {
  var count = n
    , f = j.toGregorian
  while (true)
    for (var y = 1; y <= 3000; y += 1)
      for (var m = 1; m <= 12; m += 1)
        for (var d = 1; d <= 30; d += 1) {
          f(y, m, d)
          if (--count === 0) return
        }
}

function toJalaaliBench() {
  var count = n
    , f = j.toJalaali
  while (true)
    for (var y = 560; y <= 3560; y += 1)
      for (var m = 1; m <= 12; m += 1)
        for (var d = 1; d <= 30; d += 1) {
          f(y, m, d)
          if (--count === 0) return
        }
}

function isLeapJalaaliYearBench() {
  var count = n
    , f = j.isLeapJalaaliYear
  while (true)
    for (var y = 1; y <= 3000; y += 1) {
      f(y)
      if (--count === 0) return
    }
}

function isValidJalaaliDateBench() {
  var count = n
    , f = j.isValidJalaaliDate
  while (true)
    for (var y = 1; y <= 3000; y += 1)
      for (var m = 1; m <= 13; m += 1)
        for (var d = 1; d <= 32; d += 1) {
          f(y, m, d)
          if (--count === 0) return
        }
}
