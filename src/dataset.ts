import { bisectLeft, bisectCenter, groups } from 'd3-array';

const DAY_SECONDS = 24 * 60 * 60;

enum BackendMessageType {
  BEGIN_DATASET = 0,
  SUPPLEMENT_DATASET = 1,
  UPLOAD_DATASET = 2,
  REPLACE_DATASET = 3,
  ERROR = 100,
};

export enum DisplayAttributeType {
  COUNT = 'count',
  AVERAGE_VALUE = 'average value',
  VARIANCE = 'variance',
};

export interface AdditionalData {  // {{{
  requestId: number;
  periodCount: number;
  periodDomain: [number, number];
  histograms: Float32Array;
  entropies: Float32Array;
  vectorstrengths: Float32Array;
  periods: Array<number>;
}  // }}}

class DatasetInternal extends EventTarget {  // {{{
  private notificationsPaused: boolean = false;
  private hasNotifications: boolean = false;

  private _index: number;

  public binningByValue: Array<[number, Array<number>]> = [];

  constructor(
    private socket: WebSocket,
    public datapoints: Array<Datapoint>,
    public dataCount: number,
    public numBins: number,
    public numBinningBins: number,
    public binningBinSize: number,
    public periodCount: number,
    public temporalDomainScaling: number,
    public temporalDomain: [number, number],
    public periodDomain: [number, number],
    public histograms: Float32Array,
    public entropies: Float32Array,
    public vectorstrengths: Float32Array,
    public periods: Array<number>,
    public binning: Float32Array,
    private readonly datasetId: string,
    private _displayAttribute: DisplayAttributeType = DisplayAttributeType.COUNT,
  ) {
    super();

    // try to set _index to one day period
    const idx = bisectCenter(this.periods, DAY_SECONDS);
    this._index = Math.max(0, Math.min(this.periods.length - 1, idx));

    this.rebuildIndex();
  }

  private rebuildIndex() {
    const indexedBins: Array<[number, number]> = Array.from(this.binning)
      .map((value, index) => [value, index]);
    this.binningByValue = groups(indexedBins, v => v[0])
      .map(([value, arr]) => [value, arr.map(v => v[1])]);
  }

  /**
    * Add additional data. Takes the same parameters as the constructor except
    * for the data, and determines where to add the data based on the `periods`
    * array.
    */
  splice(
    { periodCount, periodDomain, histograms, entropies, vectorstrengths, periods }: AdditionalData,
  ): void {
    this.suspend();

    const oldPeriod = this.period;
    const oldPeriodCount = this.periodCount;
    const newPeriodCount = oldPeriodCount + periodCount;

    const newPeriodDomain: [number, number] = [
      Math.min(...periodDomain.map(d => d * this.temporalDomainScaling), ...this.periodDomain),
      Math.max(...periodDomain.map(d => d * this.temporalDomainScaling), ...this.periodDomain),
    ];

    const allPeriodsWithIndex = [...this.periods, ...periods.map(d => d * this.temporalDomainScaling)]
      .map((d, i) => [d, i]);
    allPeriodsWithIndex.sort(([a], [b]) => a - b);

    const newHistograms = new Float32Array(this.numBins * newPeriodCount);
    const newEntropies = new Float32Array(newPeriodCount);
    const newVectorstrengths = new Float32Array(newPeriodCount);
    const newPeriods = allPeriodsWithIndex.map(d => d[0]);

    allPeriodsWithIndex.forEach(([_, i], newIndex) => {
      const isNew = i >= oldPeriodCount;
      const index = isNew ? i - oldPeriodCount : i;

      const [hs, es, vs, ps] = isNew
        ? [histograms, entropies, vectorstrengths, periods]
        : [this.histograms, this.entropies, this.vectorstrengths, this.periods];

      for (let j = 0; j < this.numBins; ++j) {
        newHistograms[j + newIndex * this.numBins] = hs[j + index * this.numBins];
      }
      newEntropies[newIndex] = es[index];
      newVectorstrengths[newIndex] = vs[index];
    });

    const newIndex = bisectLeft(newPeriods, oldPeriod);

    this.periodDomain = newPeriodDomain;
    this.periodCount = newPeriodCount;
    this.histograms = newHistograms;
    this.entropies = newEntropies;
    this.vectorstrengths = newVectorstrengths;
    this.periods = newPeriods;
    this._index = newIndex;

    this.rebuildIndex();

    this.notify();
    this.resume();
  }

  private notify(): void {
    if (this.notificationsPaused) this.hasNotifications = true;
    else this.dispatchEvent(new CustomEvent('change'));
  }

  suspend(): void {
    this.notificationsPaused = true;
    this.hasNotifications = false;
  }

  resume(): void {
    const needNotify = this.hasNotifications;
    this.notificationsPaused = false;
    this.hasNotifications = false;

    if (needNotify) this.notify();
  }

  get index(): number {
    return this._index;
  }

  set index(i: number) {
    if (i < 0 || i >= this.periodCount) throw new Error(`cannot assign index ${i} to dataset`);

    this._index = i;
    this.notify();
  }

  get period(): number {
    return this.periods[this.index];
  }

  set period(p: number) {
    if (p < this.periodDomain[0] || p > this.periodDomain[1])
      throw new Error(`outside period domain (${this.periodDomain}): ${p}`);

    this._index = bisectCenter(this.periods, p);
    this.notify();
  }

  setPeriodExact(p: number): void {
    if (p < this.periodDomain[0] || p > this.periodDomain[1])
      throw new Error(`outside period domain (${this.periodDomain}): ${p}`);

    const index = bisectCenter(this.periods, p);

    if (this.periods[index] === p) {
      this._index = bisectCenter(this.periods, p);
      this.notify();
    } else {
      // TODO: send wait/suspend events here to make UI inert
      new Promise<void>(async resolve => {
        this.suspend();
        await this.loadAdditionalPeriods([p], true);
        this.index = bisectCenter(this.periods, p);
        this.resume();
        resolve();
      });
    }
  }

  dataWithPhase(): Array<Datapoint & { phase: number }> {
    return this.datapoints.map(({ x, y, time, value }) => {
      const phase = this.calculatePhase(time);
      return { x, y, value, time, phase };
    });
  }

  calculatePhase(seconds: number) {
    const phase = (seconds - this.temporalDomain[0]) / this.period;

    // ensure it is between 0 and 1, JS mod is weird
    return ((phase % 1) + 1) % 1;
  }

  getHistogram(index: number): Array<number> {
    if (index < 0 || index >= this.periodCount) throw new Error('out of bounds');

    return [...this.histograms.slice(index * this.numBins, (index + 1) * this.numBins)];
  }

  getHistograms(i0: number, i1: number): Array<number> {
    if (i0 < 0 || i0 >= this.periodCount) throw new Error('out of bounds');
    if (i1 < 0 || i1 >= this.periodCount) throw new Error('out of bounds');

    return [...this.histograms.slice(i0 * this.numBins, (i1 + 1) * this.numBins)];
  }

  get nextRequestId(): number {
    return this.requestId;
  }

  private requestId: number = 0;
  async loadAdditionalPeriods(periods: Array<number>, splice: boolean = false): Promise<AdditionalData> {
    const requestId = this.requestId++;

    const message = {
      type: 'request additional data',
      periods: periods.map(d => d / this.temporalDomainScaling),
      requestId,
    };
    const messageBytes = new TextEncoder().encode(JSON.stringify(message));

    const viewPromise = new Promise<DataView>((resolve, reject) => {
      const fn = (event: MessageEvent) => {
        if (!(event.data instanceof ArrayBuffer)) reject(`message is not an ArrayBuffer: ${event.data}`);

        const view = new DataView(event.data);
        const first = view.getUint32(0, true);
        if (first !== BackendMessageType.SUPPLEMENT_DATASET) return reject(`unexpected message type: ${first}`);

        const second = view.getUint32(4, true);
        if (second !== requestId) return;

        this.socket.removeEventListener('message', fn);

        console.groupCollapsed(`received SUPPLEMENT DATASET message for dataset ${this.datasetId}`);
        console.log(`requestId: ${requestId}`);
        resolve(view);
      };
      this.socket.addEventListener('message', fn);
    });
    this.socket.send(messageBytes);

    const view = await viewPromise;
    const metadataLength = view.getUint32(8, true);  // 8 bytes in

    console.log(`metadata length: ${metadataLength}`);
    const metadataBytes = new Uint8Array(metadataLength);
    for (let i = 0; i < metadataLength; ++i) metadataBytes[i] = view.getUint8(i + 12);
    const metadataString = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataString);
    console.log(`metadata:`, metadata);

    const { periodCount, periodDomain } = metadata;
    let offset = 12 + metadataLength;

    // get float32 data from base64-encoded little-endian float data
    const [histograms, entropies, vectorstrengths, periods_] = ([
      ['histograms', this.numBins * periodCount],
      ['entropies', periodCount],
      ['vectorstrengths', periodCount],
      ['periods', periodCount],
    ] as Array<[keyof RawDatasetBase64Arrays, number]>).map(([key, length]) => {
      const data = new Float32Array(length);
      for (let i = 0; i < length; ++i) {
        data[i] = view.getFloat32(offset, true);
        offset += 4;
      }

      console.log(`received ${length} f32 values for ${key}`);
      return data;
    });

    console.groupEnd();

    const periodsScaled = Array.from(periods_).map(d => d * this.temporalDomainScaling);

    const additionalData = {
      periodCount,
      periodDomain,
      histograms,
      entropies,
      vectorstrengths,
      periods: periodsScaled,
      requestId,
    };

    if (splice) this.splice(additionalData);
    return additionalData;
  }

  get displayAttribute(): DisplayAttributeType {
    return this._displayAttribute;
  }

  async setDisplayAttribute(type: DisplayAttributeType) {
    if (type === this._displayAttribute) {
      console.log(`Tried to set display attribute to "${type}", but that is already the current value.`);
      return;
    }
    this._displayAttribute = type;

    const {
      datapoints,
      dataCount,
      numBins,
      numBinningBins,
      binningBinSize,
      periodCount,
      temporalDomain,
      temporalDomainScaling,
      periodDomain,
      histograms,
      entropies,
      vectorstrengths,
      periods,
      binning,
    } = await loadDataFromBackend(
      this.socket,
      this.datasetId,
      `{"type":"set display attribute", "attribute": "${type}"}`,
      BackendMessageType.REPLACE_DATASET,
      'REPLACE DATASET'
    );

    const oldPeriod = this.period;

    this.datapoints = datapoints;
    this.dataCount = dataCount;
    this.numBins = numBins;
    this.numBinningBins = numBinningBins;
    this.binningBinSize = binningBinSize;
    this.periodCount = periodCount;
    this.temporalDomain = temporalDomain;
    this.temporalDomainScaling = temporalDomainScaling;
    this.periodDomain = periodDomain;
    this.histograms = histograms;
    this.entropies = entropies;
    this.vectorstrengths = vectorstrengths;
    this.periods = periods;
    this.binning = binning;

    // try to set _index to one day period
    const idx = bisectCenter(this.periods, oldPeriod);
    this._index = idx;

    this.rebuildIndex();
    this.notify();
  }
};  // }}}

export type Dataset = DatasetInternal;


async function handleAndCreateDataset(socket: WebSocket, datasetId: string): Promise<Dataset> {
  const {
    datapoints,
    dataCount,
    numBins,
    numBinningBins,
    binningBinSize,
    periodCount,
    temporalDomain,
    temporalDomainScaling,
    periodDomain,
    histograms,
    entropies,
    vectorstrengths,
    periods,
    binning,
  } = await loadDataFromBackend(socket, datasetId, '{"type":"ready"}', BackendMessageType.BEGIN_DATASET, 'BEGIN DATASET');

  return new DatasetInternal(
    socket,
    datapoints,
    dataCount,
    numBins,
    numBinningBins,
    binningBinSize,
    periodCount,
    temporalDomainScaling,
    temporalDomain,
    periodDomain,
    histograms,
    entropies,
    vectorstrengths,
    periods,
    binning,
    datasetId,
  );
}

interface DatasetConstructorArguments {
  datapoints: Array<Datapoint>,
  dataCount: number,
  numBins: number,
  numBinningBins: number,
  binningBinSize: number,
  periodCount: number,
  temporalDomainScaling: number,
  temporalDomain: [number, number],
  periodDomain: [number, number],
  histograms: Float32Array,
  entropies: Float32Array,
  vectorstrengths: Float32Array,
  periods: Array<number>,
  binning: Float32Array,
};

async function loadDataFromBackend(
  socket: WebSocket,
  datasetId: string,
  requestMessage: string,
  expectedResponseType: BackendMessageType,
  responseLabel: string,
): Promise<DatasetConstructorArguments> {
  const viewPromise = new Promise<DataView>((resolve, reject) => {
    socket.addEventListener('message', event => {
      if (!(event.data instanceof ArrayBuffer)) reject(`message is not an ArrayBuffer: ${event.data}`);

      const view = new DataView(event.data);
      const firstByte = view.getUint32(0, true);
      if (firstByte !== expectedResponseType) return reject(`unexpected message type: ${firstByte}`);

      console.groupCollapsed(`received ${responseLabel} message for ID ${datasetId}`);
      resolve(view);
    }, { once: true });
  });
  socket.send(requestMessage);

  const view = await viewPromise;
  const metadataLength = view.getUint32(4, true);  // 4 bytes in

  console.log(`metadata length: ${metadataLength}`);
  const metadataBytes = new Uint8Array(metadataLength);
  for (let i = 0; i < metadataLength; ++i) metadataBytes[i] = view.getUint8(i + 8);
  const metadataString = new TextDecoder().decode(metadataBytes);
  const metadata = JSON.parse(metadataString);
  console.log(`metadata:`, metadata);

  const {
    numBins, periodCount, dataCount, temporalDomain, periodDomain,
    numBinningBins, binningBinSize, temporalDomainScaling,
  } = metadata;
  let offset = 8 + metadataLength;

  // get float32 data from base64-encoded little-endian float data
  const [histograms, entropies, vectorstrengths, periods, xs, ys, values, binning] = ([
    ['histograms', numBins * periodCount],
    ['entropies', periodCount],
    ['vectorstrengths', periodCount],
    ['periods', periodCount],
    ['xs', dataCount],
    ['ys', dataCount],
    ['values', dataCount],
    ['binning', numBinningBins],
  ] as Array<[keyof RawDatasetBase64Arrays, number]>).map(([key, length]) => {
    const data = new Float32Array(length);
    for (let i = 0; i < length; ++i) {
      data[i] = view.getFloat32(offset, true);
      offset += 4;
    }

    console.log(`received ${length} f32 values for ${key}`);
    return data;
  });

  // timestamps are unsigned integers (32 bit)
  const ts = new Int32Array(dataCount);
  for (let i = 0; i < dataCount; ++i) ts[i] = view.getUint32(offset + i * 4, true);

  console.log(`received ${dataCount} u32 values for ts`);

  const data: Array<Datapoint> = [];
  for (let i = 0; i < dataCount; ++i) data.push({ x: xs[i], y: ys[i], value: values[i], time: ts[i] * temporalDomainScaling });

  console.groupEnd();

  temporalDomain[0] = temporalDomain[0] * temporalDomainScaling;
  temporalDomain[1] = temporalDomain[1] * temporalDomainScaling;
  periodDomain[0] = periodDomain[0] * temporalDomainScaling;
  periodDomain[1] = periodDomain[1] * temporalDomainScaling;
  const periodsScaled = Array.from(periods).map(d => d * temporalDomainScaling);
  const binningBinSizeScaled = binningBinSize * temporalDomainScaling;

  return {
    datapoints: data,
    dataCount,
    numBins,
    numBinningBins,
    binningBinSize: binningBinSizeScaled,
    periodCount,
    temporalDomain,
    temporalDomainScaling,
    periodDomain,
    histograms,
    entropies,
    vectorstrengths,
    periods: periodsScaled,
    binning,
  };
}


function failUpload(extra: string) {
  const msg = `Uploaded dataset must be a JSON array whose entries are: "x" (number), "y" (number), "value" (number), "time" (epoch seconds or Date()-parsable string).\nError: ${extra}`;
  alert(msg);
  throw new Error(msg);
}

let uploadId: number = 1;
export async function uploadAndInitializeDataset(file: File): Promise<Dataset> {
  const datasetId = `upload[${uploadId}]`;
  ++uploadId;

  const content = await file.text();
  const json = JSON.parse(content);

  if (!Array.isArray(json)) failUpload('Not an array.');
  const data = new ArrayBuffer(4 + 4 + 4 * 4 * json.length);
  const view = new DataView(data);
  view.setUint32(0, BackendMessageType.UPLOAD_DATASET, true);  // message type: UPLOAD DATASET
  view.setUint32(4, json.length, true);

  for (let i = 0; i < json.length; ++i) {
    const { x, y, time, value } = json[i];
    const date = (typeof time === 'number') ? new Date(1000 * time) : new Date(time);
    const d = date.valueOf() / 1000;
    if (typeof x !== 'number' || typeof y !== 'number' || Number.isNaN(d) || typeof value !== 'number') failUpload(`Invalid entry at position ${i}: ${JSON.stringify(json[i])}`);

    view.setFloat32(8 + 4 * i, x, true);
    view.setFloat32(8 + json.length * 4 + 4 * i, y, true);
    view.setFloat32(8 + json.length * 8 + 4 * i, value, true);
    view.setUint32(8 + json.length * 12 + 4 * i, d, true);
  }

  console.groupCollapsed(`sending UPLOAD DATASET message for ID ${datasetId}`);
  console.log(`data length: ${json.length}`);
  console.groupEnd();

  const url = window.location;
  const path = url.pathname.replace(/\/[^\/]*$/, '/');
  const scheme = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${scheme}//${url.host}${path}dataset/`;

  const socket = new WebSocket(socketUrl);
  socket.binaryType = 'arraybuffer';
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));

  console.log(`opened WebSocket for dataset ${datasetId}`);

  socket.send(data);

  return await handleAndCreateDataset(socket, datasetId);
}

export async function initializeDataset(datasetId: string): Promise<Dataset> {
  const url = window.location;
  const path = url.pathname.replace(/\/[^\/]*$/, '/');
  const scheme = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${scheme}//${url.host}${path}dataset/${datasetId}`;
  const socket = new WebSocket(socketUrl);
  socket.binaryType = 'arraybuffer';
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));

  console.log(`opened WebSocket for dataset ${datasetId}`);

  return await handleAndCreateDataset(socket, datasetId);
}
