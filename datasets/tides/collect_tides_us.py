#!/usr/bin/env python3

import argparse
import requests
import bs4
import json
import time


session = requests.Session()
def get(url, params=dict()):
    return session.get(
            url,
            params=params,
            headers={
                'User-Agent': 'mailto:Max.Franke@vis.uni-stuttgart.de',
                }).text


def get_extreme_tide_data(station_id):
    data_raw = get('https://tidesandcurrents.noaa.gov/est/est_station.shtml', dict(stnid=station_id))

    html = bs4.BeautifulSoup(data_raw, features='html.parser')
    data = []
    for table in html.find_all('table'):
        for row in table.find_all('tr'):
            # NOAA seems not to close their <td>
            all = row.find_all('td')
            first = all[0]
            if first.text != 'Highest Extremes':
                continue

            for a in all[1].find_all('a'):
                data.append(a.text.strip())

    return data


def get_coordinates(station_id):
    data_raw = get(F'https://tidesandcurrents.noaa.gov/mdapi/latest/webapi/stations/{station_id}.json')
    j = json.loads(data_raw)
    lat = j['stations'][0]['lat']
    lng = j['stations'][0]['lng']

    return lat, lng


def work(infile, outfile):
    j = json.load(infile)
    outfile.write('station_id,lat,lng,date\n')

    for i, station_id in enumerate(j):
        try:
            dates = get_extreme_tide_data(station_id)
            if len(dates) > 0:
                lat, lng = get_coordinates(station_id)

                for date in dates:
                    outfile.write(F'{station_id},{lat},{lng},{date}\n')

            print(F'Station {station_id} ({i+1} of {len(j)}) had {len(dates)} events.')

        except:
            print(F'[err] station {station_id}')

        outfile.flush()
        time.sleep(2)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('infile', type=argparse.FileType('r'), help='input JSON file')
    parser.add_argument('outfile', type=argparse.FileType('w'), help='output CSV file')

    parsed = parser.parse_args()
    work(parsed.infile, parsed.outfile)
