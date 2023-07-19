#!/usr/bin/env python3

import argparse
import csv
import numpy as np
import datetime

def work(infile, outfile):
    c = list(csv.DictReader(infile))
    ts = np.array([float(v['timestamp']) for v in c])
    vals = np.array([float(v['value']) for v in c])

    # 0.5 might be a good threshold
    print('values above 0.5:', len(vals[vals > 0.5]))

    i = (vals > 0.5)

    outfile.write('x,y,time,value\n')

    # create dataset. x/y positions are day in year/year
    for t,v in zip(ts[i], vals[i]):
        d = datetime.datetime.fromtimestamp(t)
        day_of_year = int(d.strftime('%j'))
        year = d.year

        # divide timestamp by 60*24 to make minutes days
        outfile.write(F'{day_of_year},{year},{int(t / (24 * 60))},{v}\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('infile', type=argparse.FileType('r'), help='input CSV file')
    parser.add_argument('outfile', type=argparse.FileType('w'), help='output CSV file')

    parsed = parser.parse_args()
    work(parsed.infile, parsed.outfile)
