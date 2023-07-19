#!/usr/bin/env python3

import argparse
import requests
import json
import time
import datetime


session = requests.Session()
def get(url, params=dict()):
    return session.get(
            url,
            params=params,
            headers={
                'User-Agent': 'mailto:Max.Franke@vis.uni-stuttgart.de',
                })


def fetch(begin_date,end_date):
    req = get('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
        dict(
            product='hourly_height',
            application='NOS.COOPS.TAC.WL',
            begin_date=begin_date,
            end_date=end_date,
            datum='MSL',
            station=1612340,
            time_zone='GMT',
            units='metric',
            format='json',
            ))
    j = req.json()
    data = []
    for datum in j['data']:
        t = datetime.datetime.strptime(datum['t'], '%Y-%m-%d %H:%M').timestamp()
        v_ = datum['v']
        if v_ == '':
            continue

        v = float(v_)
        data.append((t,v))

    return data


def work(outfile):
    outfile.write('timestamp,value\n')

    startdate = datetime.datetime(year=1914, month=1, day=1)
    enddate = datetime.datetime(year=2023, month=3, day=31)
    step = datetime.timedelta(days=15)

    while startdate < enddate:
        sd = startdate.strftime('%Y%m%d')
        startdate = min(enddate, startdate + step)
        ed = startdate.strftime('%Y%m%d')

        try:
            data = fetch(sd, ed)
            for t,v in data:
                outfile.write(F'{t},{v}\n')

            print(F'Fetched interval {sd} -- {ed}')

        except Exception as err:
            print(F'[err] interval {sd} -- {ed}')
            print(err)

        outfile.flush()
        time.sleep(2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('outfile', type=argparse.FileType('w'), help='output CSV file')

    parsed = parser.parse_args()
    work(parsed.outfile)
