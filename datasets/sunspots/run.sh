#!/usr/bin/env python3

import argparse
import requests
import json
import time
import datetime
import re

_row_pattern = re.compile(r'^\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+$')


def work(outfile):
    # download raw data
    req = requests.get('https://ngdc.noaa.gov/stp/space-weather/solar-data/solar-indices/sunspot-numbers/american/lists/list_aavso-arssn_daily.txt',
      headers={'User-Agent': 'mailto:Max.Franke@vis.uni-stuttgart.de'})

    raw = iter(req.text.split('\n'))

    # discard first two rows
    next(raw)
    next(raw)

    outfile.write('time,date,x,y,value\n')
    for row in raw:
        m = _row_pattern.fullmatch(row)
        if m is None:
            continue

        year = int(m.group(1))
        month = int(m.group(2))
        day = int(m.group(3))
        ssn = int(m.group(4))

        d = datetime.datetime(year, month, day)
        ts = d.timestamp()

        # minutes represent dates to circumvent int32 overflow
        ts_scaled = int(ts / (60 * 24))

        # day of year is x position of event
        x = int(d.strftime('%_j'))

        # month is y position of event
        y = d.year * 12 + d.month - 1

        outfile.write(F'{ts_scaled},{d.strftime("%Y-%m-%d")},{x},{y},{ssn}\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('outfile', type=argparse.FileType('w'), help='output CSV file')

    parsed = parser.parse_args()
    work(parsed.outfile)
