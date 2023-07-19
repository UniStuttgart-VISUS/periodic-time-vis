# Collecting and Generating Tide Datasets

For this to work, the Python virtualenv (using Poetry) defined in the root directory of the repository must be installed.
See [the README section there](../../README.md#how-to-run) for details.
Please modify the `User-Agent` header when you run the scripts.


## Extreme Tide Events in the USA

This dataset contains the extreme tide events of all NOAA tide measuring stations.


### Getting Station IDs from NOAA

[NOAA](https://tidesandcurrents.noaa.gov/stations.html?type=Historic+Water+Levels)

Get station IDs from list of links:

``` javascript
Array.from(document.querySelectorAll('div.station>a')).map(n => n.innerText.split(' ')[0])
```

Result: [station_ids.json](./station_ids.json)


### Getting Data per Station

- Each station has a list of extreme high-tide events on its "Extreme Water Levels" page: `https://tidesandcurrents.noaa.gov/est/est_station.shtml?stnid=<station_id>`
- Each station has its coordinates on its home page: `https://tidesandcurrents.noaa.gov/stationhome.html?id=<station_id>`.
  There is also a JSON version, which we use: `https://tidesandcurrents.noaa.gov/mdapi/latest/webapi/stations/<station_id>.json`
- Use `requests` and `beautifulsoup4` to parse and collect data: [collect_tides_us.py](./collect_tides_us.py)
- Output: `data_raw_out.csv`

``` bash
$ poetry run python collect_tides_us.py station_ids.json data_raw_out.csv
```


### Creating a Dataset

- Parse dates
- Project positions
- Jitter positions
- [convert_tides_us.py](./convert_tides_us.py)
- The result is put into the [datasets/](../) directory as `tides_us.csv`

``` bash
$ poetry run python convert_tides_us.py data_raw_out.csv ../tides_us.csv
```


## Extreme Tide Events for the Honolulu, Hawai'i Measuring Station

Here, we look at all historical measurement values for the hourly mean sea level for one measuring station, in Honolulu, Hawai'i.
This station has the ID 1612340.
To extract events from the time series, we define a threshold of +0.5m, and consider all values above that threshold as events of interest.


### Collecting the Raw Data

This downloads a lot of data and must be done for intervals smaller than one month at a time.
The script will do this for 15-day intervals at a time, with a small delay between requests.

- Output: `data_raw_out_honolulu.csv`

``` bash
$ poetry run python collect_tides_honolulu.py data_raw_out_honolulu.csv
```


### Extracting High-tide Events

- Input: `data_raw_out_honolulu.csv`
- Output: `../tides_honolulu.csv`

``` bash
$ poetry run python convert_tides_honolulu.py data_raw_out_honolulu.csv ../tides_honolulu.csv
```
