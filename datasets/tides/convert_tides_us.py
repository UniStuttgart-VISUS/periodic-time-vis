#!/usr/bin/env python3

import pyproj
import csv
import argparse
import random
import math
import datetime

def convert(infile, outfile):
    proj = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857")

    r = csv.DictReader(infile)
    w = csv.DictWriter(outfile, ['x', 'y', 'time', 'value'])

    w.writeheader()

    for val in r:
        d = datetime.datetime.strptime(val['date'], '%m/%d/%Y')
        t = d.timestamp()

        x, y = proj.transform(float(val['lat']), float(val['lng']))

        delta = math.sqrt(random.uniform(0, 200000*200000))
        angle = random.uniform(0, 2 * math.pi)

        w.writerow(dict(
            x = x + math.cos(angle) * delta,
            y = y + math.sin(angle) * delta,
            time = t,
            value = 0,
            ))



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('infile', type=argparse.FileType('r'), help='input CSV file')
    parser.add_argument('outfile', type=argparse.FileType('w'), help='output CSV file')

    parsed = parser.parse_args()

    convert(parsed.infile, parsed.outfile)
