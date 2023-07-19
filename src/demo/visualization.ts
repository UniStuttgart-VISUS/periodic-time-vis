import {
  scaleLinear,
  axisLeft, axisBottom,
  select,
  zoom,
  extent,
  bin
} from 'd3';

import CartesianProjection from './cartesian-projection';
import type { Dataset } from '../dataset';
import type { OutputFunction } from '../output-function';

export default class Visualization {
  protected cachedWidth: number;
  protected cachedHeight: number;
  private proj?: CartesianProjection;
  private center: [number, number] = [0, 0];
  private clipPadding: number = 30;
  private axisSize: number = 30;

  private changeCallback: () => void;
  private idleCallbackId: ReturnType<typeof requestIdleCallback> = 0;

  constructor(
    protected svg: SVGSVGElement,
    protected canvas: HTMLCanvasElement,
    protected data: Dataset,
    protected outputFunction: OutputFunction,
    private _coupled: boolean = true,
  ) {
    this.cachedWidth = parseFloat(this.svg.getAttribute('width')!);
    this.cachedHeight = parseFloat(this.svg.getAttribute('height')!);

    this.changeCallback = (() => this.onChange()).bind(this);

    this.data.addEventListener('change', this.changeCallback);
    this.outputFunction.addEventListener('change', this.changeCallback);

    this.render();
  }

  deregister() {
    this.data.removeEventListener('change', this.changeCallback);
    this.outputFunction.removeEventListener('change', this.changeCallback);
  }

  private onChange() {
    if (this.coupled) this.render();
    else {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = requestIdleCallback(() => this.render());
    }
  }

  set coupled(c: boolean) {
    this._coupled = c;
    this.onChange();
  }

  get coupled(): boolean {
    return this._coupled;
  }

  render(w?: number, h?: number) {
    if (w) this.cachedWidth = w;
    if (h) this.cachedHeight = h;

    const xs = [ this.clipPadding + this.axisSize, this.cachedWidth - this.clipPadding ];
    const ys = [ this.cachedHeight - this.clipPadding - this.axisSize, this.clipPadding ];

    const dd = this.data.dataWithPhase();
    const dataDomainX = extent(dd, d => d.x) as [number, number];
    const dataDomainY = extent(dd, d => d.y) as [number, number];

    const s = select(this.svg);
    s.selectAll(':scope > rect#background')
      .data([null])
      .join('rect')
        .attr('id', 'background')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', this.cachedWidth)
        .attr('height', this.cachedHeight)
        .attr('fill-opacity', 0);

    if (this.proj === undefined) {
      this.proj = new CartesianProjection()
        .fitExtent([[xs[0], ys[0]], [xs[1], ys[1]]],
          [
            [dataDomainX[0], dataDomainY[0]],
            [dataDomainX[1], dataDomainY[1]],
          ]);

      const center = this.proj.invert([this.cachedWidth/2, this.cachedHeight/2]) as [number, number];
      this.proj.translate([this.cachedWidth/2, this.cachedHeight/2]);
      this.proj.center(center);

      this.center = center;
    }

    s.node()!['__zoom'] = undefined;  // start anew each time, only relative zoom and pan relevant
    const z = zoom();
    s.call(z as unknown as any);
    z.on('zoom', (e) => {
      if (e.sourceEvent.type === 'wheel') {
        const delta = eventOffsetFromElementCenter(e.sourceEvent, s.node());

        // find out where mouse was when zooming
        const origCenter = this.center;
        const origCenterImage = this.proj!.project(origCenter);
        const zoomCenterImage = [ origCenterImage[0] - delta[0], origCenterImage[1] - delta[1] ] as [number, number];
        const zoomCenter = this.proj!.invert(zoomCenterImage) as [number, number];

        // scale
        this.proj!.scale((this.proj!.scale() as number) * e.transform.k);

        // move so that same position is under mouse cursor again
        const zoomCenterImage2 = this.proj!.project(zoomCenter);
        const newCenterImage: [number, number] = [ zoomCenterImage2[0] + delta[0], zoomCenterImage2[1] + delta[1] ];
        const newCenter = this.proj!.invert(newCenterImage) as [number, number];

        this.proj!.center(newCenter);
        z.on('zoom', null);
      } else {
        const delta = [e.transform.x, e.transform.y];

        const origCenter = this.center;
        const origCenterImage = this.proj!.project(origCenter);
        const newCenterImage: [number, number] = [origCenterImage[0] - delta[0], origCenterImage[1] - delta[1]];
        const newCenter = this.proj!.invert(newCenterImage) as [number, number];
        this.proj!.center(newCenter);
        this.proj!.scale((this.proj!.scale() as number) * e.transform.k);
      }

      this.render();
    }).on('end', (e) => {
      this.center = this.proj!.invert([this.cachedWidth/2, this.cachedHeight/2]) as [number, number];
    });

    s.on('scroll wheel', e => e.preventDefault());

    const [x0, y0] = this.proj.invert([xs[0], ys[0]]);
    const [x1, y1] = this.proj.invert([xs[1], ys[1]]);

    const x = scaleLinear()
      .domain([x0, x1])
      .range(xs);
    const y = scaleLinear()
      .domain([y0, y1])
      .range(ys);

    s.selectAll<SVGGElement, any>('g#axis-x')
      .data([null])
      .join('g')
        .attr('id', 'axis-x')
        .attr('transform', `translate(0, ${y.range()[0] + this.axisSize/2})`)
        .call(axisBottom(x));
    s.selectAll<SVGGElement, any>('g#axis-y')
      .data([null])
      .join('g')
        .attr('id', 'axis-y')
        .attr('transform', `translate(${x.range()[0] - this.axisSize/2}, 0)`)
        .call(axisLeft(y));

    // draw symbols

    const glyphBinning = 100;
    const glyphSize = this.outputFunction!.hasShape() ? 10 : 5;
    const extraCanvas = document.createElement('canvas');
    extraCanvas.width = 2 * glyphSize * glyphBinning;
    extraCanvas.height = 2 * glyphSize;
    const extraCtx = extraCanvas.getContext('2d')!;

    const ctx = this.canvas.getContext('2d')!;
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(0, 0, this.cachedWidth, this.cachedHeight);
    ctx.restore();

    const dataByPhase = bin<typeof dd[0], number>()
      .domain([0, 1])
      .value(d => d.phase)
      .thresholds(5)
      (dd);

    ctx.save();
    this.outputFunction!.initializeContext(extraCtx);

    // first, draw once to get pixel data
    extraCtx.translate(glyphSize, glyphSize);

    dataByPhase.forEach(data => {
      const phase = ((data.x0 ?? 0) + (data.x1 ?? 0)) / 2
      extraCtx.fillStyle = extraCtx.strokeStyle = this.outputFunction!.color(phase);
      extraCtx.beginPath();

      this.outputFunction!.draw(phase, extraCtx, glyphSize);
      extraCtx.stroke();
      extraCtx.fill();

      extraCtx.translate(2 * glyphSize, 0);
    });

    // clip
    ctx.resetTransform();
    ctx.beginPath();
    ctx.rect(xs[0], ys[1], xs[1] - xs[0], ys[0] - ys[1]);
    ctx.closePath();
    ctx.clip();

    ctx.clearRect(0, 0, this.cachedWidth, this.cachedHeight);

    // paint glyphs by copy
    dataByPhase.forEach((data, i) => {
      ctx.save();

      data.forEach(datum => {
        const [x, y] = this.proj!.project([datum.x, datum.y]);
        ctx.drawImage(
          extraCanvas,
          i * 2 * glyphSize, 0, 2 * glyphSize, 2 * glyphSize,
          x - glyphSize, y - glyphSize, 2 * glyphSize, 2 * glyphSize);
      });

      ctx.restore();
    });

    ctx.restore();

    extraCanvas.remove();
  }
};

function eventOffsetFromElementCenter(evt, element) {
  const { clientX, clientY } = evt;
  const { top, left, width, height } = element.getBoundingClientRect();

  const x = clientX - left;
  const y = clientY - top;

  const dx = width / 2 - x;
  const dy = height / 2 - y;

  return [ dx, dy ];
}
