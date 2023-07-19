[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.8164733.svg)](https://doi.org/10.5281/zenodo.8164733)

# periodic-time-vis

Software prototype for the interactive visual analysis of event data to detect periodic behavior in the data without explicit knowledge of the period length.
Event timestamps are mapped to the phase within one given period length, and the summed histogram of phase distribution is visualized and analyzed.
This is repeated for a large number of sampled period lengths.
The phase histograms for different period lengths can be visually inspected and explored.
Two quality measures and a suggestion system support the visual analysis through guidance towards interesting period lengths.


## How to Cite

This source code was created as part of a publication that will be presented as a short paper at IEEE VIS 2023 in Melbourne, Australia on October 22&ndash;27, 2023.
Citation:

> Franke, M. and Koch, S:
> "Compact Phase Histograms for Guided Exploration of Periodicity."
> In: *Proceedings of the IEEE Visualization Conference (VIS),* 2023, forthcoming.

BibTeX:

``` bibtex
@inproceedings{franke2023periodicity,
  title = {Compact Phase Histograms for Guided Exploration of Periodicity},
  author = {Franke, Max and Koch, Steffen},
  booktitle = {Proceedings of the IEEE Visualization Conference (VIS)},
  note = {forthcoming},
  year = {2023},
  month = {10}
}
```


## How to Run

1. Install dependencies (requires `npm` and `python3-poetry`):
    ``` bash
    $ npm install
    $ poetry install
    ```

2. Compile frontend code:
    ``` bash
    $ npx rollup -c
    ```

3. Start backend server (optionally pass a TCP port, default is 8000):
    ``` bash
    $ ./run.sh
    $ # or
    $ ./run.sh 1234
    ```


## Dataset-backend Interaction

```
> HTTP GET /dataset/<id>
                                      < HTTP 101 Switching protocols

> ws: json { "type": "ready" }
                                      < ws: BEGIN DATASET message

  FORMAT <-: Byte stream

    u32 LE: message type: { 0: BEGIN DATASET }
    u32 LE: metadata length
    u8 LE[metadata length]: metadata as UTF-8 bytes
    f32 LE[numBins * periodCount]: histograms
    f32 LE[periodCount]: entropies
    f32 LE[periodCount]: vectorstrengths
    f32 LE[periodCount]: periods
    f32 LE[dataCount]: xs
    f32 LE[dataCount]: ys
    f32 LE[numBinningBins]: binning
    u32 LE[dataCount]: ts


> ws: json { "type": "request additional data", ... }
                                      < ws: SUPPLEMENT DATASET message

  FORMAT <-: Byte stream

    u32 LE: message type: { 1: SUPPLEMENT DATASET }
    u32 LE: sequence ID
    u32 LE: metadata length
    u8 LE[metadata length]: metadata as UTF-8 bytes
    f32 LE[numBins * periodCount]: histograms
    f32 LE[periodCount]: entropies
    f32 LE[periodCount]: vectorstrengths
    f32 LE[periodCount]: periods


> ws: json { "type": "set display attribute", "attribute": "count/average value/variance" }
                                      < ws: REPLACE DATASET message

  FORMAT <-: Byte stream

    u32 LE: message type: { 3: REPLACE DATASET }
    u32 LE: metadata length
    u8 LE[metadata length]: metadata as UTF-8 bytes
    f32 LE[numBins * periodCount]: histograms
    f32 LE[periodCount]: entropies
    f32 LE[periodCount]: vectorstrengths
    f32 LE[periodCount]: periods
    f32 LE[dataCount]: xs
    f32 LE[dataCount]: ys
    f32 LE[numBinningBins]: binning
    u32 LE[dataCount]: ts
```

Alternatively, request a socket for an empty dataset, then fill it from the frontend:

```
> HTTP GET /dataset/<id>
                                      < HTTP 101 Switching protocols

> ws: UPLOAD DATASET message

  FORMAT ->: Byte stream

    u32 LE: message type: { 2: UPLOAD DATASET }
    u32 LE: dataset length (dataCount)
    f32 LE[dataCount]: xs
    f32 LE[dataCount]: ys
    u32 LE[dataCount]: ts

                                      < ws: BEGIN DATASET message

                                  ...
```
