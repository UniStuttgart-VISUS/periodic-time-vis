type Timestamp = ReturnType<Date['getTime']>;
type Period = Timestamp;
type Phase = number;


interface RawDatasetBase64Arrays {
  periods: string;
  histograms: string;
  entropies: string;
  xs: string;
  ys: string;
  ts: string;
  binning: string;
}


interface RawDataset extends RawDatasetBase64Arrays {
  dataCount: number;
  periodCount: number;
  numBins: number;
  phaseDomain: [number, number];
  periodDomain: [number, number];
  temporalDomain: [number, number];
  numBinningBins: number;
  binningBinSize: number;
}

interface Datapoint {
  x: number;
  y: number;
  value: number;
  time: number;
}
