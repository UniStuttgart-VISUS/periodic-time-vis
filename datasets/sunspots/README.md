# Daily Number of Sunspots (US Dataset)

This [dataset](https://ngdc.noaa.gov/stp/space-weather/solar-data/solar-indices/sunspot-numbers/american/lists/list_aavso-arssn_daily.txt) contains the number of sunspots, measured in the USA.
The measurements are daily between January 1, 1945 and June 30, 2017.
The script downloads and pre-processes the file.
Since the temporal extent is so large, timestamps are scaled so that minutes represent days.
The frontend reverses that scaling so that the displayed times and lengths are correct again.
No thresholding is applied here, so the *count* attribute visualization will not show anything meaningful, but the *average value* and *variance* attribute visualizations will.
The generated dataset should be saved as `../sunspots_us_daily.csv` so that the backend finds it.

For the script to work, the Python virtualenv (using Poetry) defined in the root directory of the repository must be installed.
See [the README section there](../../README.md#how-to-run) for details.
Please modify the `User-Agent` header when you run the scripts.

``` bash
$ poetry run python run.sh ../sunspots_us_daily.csv
```
