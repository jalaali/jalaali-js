# Jalaali JavaScript

A few javascript functions for converting Gregorian and Jalaali calendar systems to each other.

## About

Jalali calendar is a solar calendar that was used in Persia, variants of which today are still in use in Iran as well as Afghanistan. [Read more on Wikipedia](http://en.wikipedia.org/wiki/Jalali_calendar) or see [Calendar Converter](http://www.fourmilab.ch/documents/calendar/).

Calendar conversion is based on the [algorithm provided by Kazimierz M. Borkowski](http://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm) and has a very good performance.

## API

### jalCal(jy)

This function determines if the Jalaali (Persian) year is leap (366-day long) or is the common year (365 days), and finds the day in March (Gregorian calendar) of the first day of the Jalaali year (jy).

### j2d(jy, jm, jd)

Converts a date of the Jalaali calendar to the Julian Day number.

### d2j(jdn)

Converts the Julian Day number to a date in the Jalaali calendar.

### g2d(gy, gm, gd)

Calculates the Julian Day number from Gregorian or Julian calendar dates. This integer number corresponds to the noon of the date (i.e. 12 hours of Universal Time). The procedure was tested to be good since 1 March, -100100 (of both calendars) up to a few million years into the future.

### d2g(jdn)

Calculates Gregorian and Julian calendar dates from the Julian Day number (jdn) for the period since jdn=-34839655 (i.e. the year -100100 of both calendars) to some millions years ahead of the present.

## License

MIT
