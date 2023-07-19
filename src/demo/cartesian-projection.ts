import { extent as d3extent } from 'd3-array';

export default class CartesianProjection {
  private _scale = 1;
  private _sign = [1, 1];
  private _center = [0, 0];
  private _translation = [0, 0];

  constructor() {

  }

  fitExtent(
    extent: [[number, number], [number, number]],
    data: [number, number][]
  ) {
    const [[x0, y0], [x1, y1]] = extent;
    const [dataX0, dataX1] = d3extent(data, d => d[0]) as [number, number];
    const [dataY0, dataY1] = d3extent(data, d => d[1]) as [number, number];

    const imgDx = x1 - x0;
    const imgDy = y1 - y0;
    const dataDx = dataX1 - dataX0;
    const dataDy = dataY1 - dataY0;

    const ratioX = imgDx / dataDx;
    const ratioY = imgDy / dataDy;
    const signX = Math.sign(ratioX);
    const signY = Math.sign(ratioY);

    this._center = [ dataX0 + dataDx/2, dataY0 + dataDy/2 ];
    this._translation = [ x0 + imgDx/2, y0 + imgDy/2 ]
    const ratio = Math.min(Math.abs(ratioX), Math.abs(ratioY));
    this._scale = ratio;
    this._sign = [signX, signY];

    return this;
  }

  project([x, y]) {
    return [
      (x - this._center[0]) * this._scale * this._sign[0] + this._translation[0],
      (y - this._center[1]) * this._scale * this._sign[1] + this._translation[1],
    ];
  }

  invert([x, y]) {
    return [
      (x - this._translation[0]) / this._scale * this._sign[0] + this._center[0],
      (y - this._translation[1]) / this._scale * this._sign[1] + this._center[1],
    ];
  }

  translate(val) {
    if (val === undefined) return [...this._translation];
    if (typeof val !== 'object' || val.length !== 2) throw Error('translation must be an array');
    this._translation = [...val];

    return this;
  }

  center(val?: [number, number]) {
    if (val === undefined) return [...this._center];
    if (typeof val !== 'object' || val.length !== 2) throw Error('center must be an array');
    this._center = [...val];

    return this;
  }

  scale(val?: number) {
    if (val === undefined) return this._scale;
    if (typeof val !== 'number') throw Error('scale must be a number');
    this._scale = val;

    return this;
  }
}
