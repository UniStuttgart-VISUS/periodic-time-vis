import { LitElement, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import ResizeContainer from 'resizing-svg-canvas';

import { scaleLinear, scaleBand } from 'd3-scale';
import type { ScaleLinear, ScaleBand } from 'd3-scale';
import type { Selection } from 'd3-selection';
import { select, selectAll } from 'd3-selection';
import { range, cumsum, zip, extent, bisectRight } from 'd3-array';

import { timeFmt, clamp, linearTicks, COLOR_BINS, DEFAULT_INTERPOLATED_COLORSCHEME } from './utils';
import nonoverlapLabels from './nonoverlapping-axis-labels';
import type { D3InterpolateColorValue } from './interpolated-color-schemes';
import getColorFunction from './interpolated-color-schemes';
import { Dataset, DisplayAttributeType } from './dataset';
import { OutputFunction } from './output-function';
import RectangularBinPopup from './rectangular-bin-popup';

interface RenderingContext {
  ctx: CanvasRenderingContext2D;
  svg: Selection<SVGSVGElement, any, any, any>;

  xScale: ScaleLinear<number, number>;
  xScaleBand: ScaleBand<number>;
  yScale: ScaleBand<number>;
  yTicks: Array<number>;

  xAxisLabelHeight: number;
  xAxisTickHeight: number;
  xAxisLabelPadding: number;

  totalWidth: number;
}

const MIN_HEIGHT = 120;  // px
const MIN_WIDTH = 300;   // px

@customElement('scented-widget')
export default class ScentedWidget extends LitElement {
  static styles = css`
    :host {
      display: grid;

      min-width: ${MIN_WIDTH}px;
      min-height: ${MIN_HEIGHT}px;
    }
  `;

  private resizeContainer?: ResizeContainer;
  private resizeRoot?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private svg?: SVGSVGElement;

  @state()
  private data: Dataset | null = null;

  @state()
  private outputFunction: OutputFunction | null = null;

  @property({ attribute: 'num-bins-y', type: Number })
  numBinsYPerDirection: number = 5;

  @property({ attribute: 'color-scheme', type: String })
  colorScale: D3InterpolateColorValue = DEFAULT_INTERPOLATED_COLORSCHEME;

  @property({ attribute: 'no-legend', type: Boolean })
  noLegend: boolean = false;

  @property({ attribute: 'use-vectorstrength', type: Boolean })
  useVectorstrength: boolean = false;

  private rectangularBinPopup: RectangularBinPopup;


  // for outside UI drawing: start and end position of main column
  private _mainColumnExtentX: [number, number] = [0, 1];
  get mainColumnExtentX(): [number, number] {
    return structuredClone(this._mainColumnExtentX);
  }


  constructor() {
    super();

    this._onDatasetChange = this._onDatasetChange.bind(this);
    this._onOutputFunctionChange = this._onOutputFunctionChange.bind(this);

    this.rectangularBinPopup = new RectangularBinPopup();
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.resizeRoot = document.createElement('div');
    this.resizeContainer = new ResizeContainer(this.resizeRoot);
    this.canvas = this.resizeContainer.addCanvasLayer();
    this.svg = this.resizeContainer.addSvgLayer();

    this.resizeRoot!.addEventListener('resize', _ => this._rerender());

    document.body.appendChild(this.rectangularBinPopup);
  }

  disconnectedCallback(): void {
    document.body.removeChild(this.rectangularBinPopup);
  }

  render() {
    this._rerender();

    return this.resizeRoot;
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, _old, value);
    if (name === 'color-scheme') this.rectangularBinPopup.setAttribute('color-scheme', value as D3InterpolateColorValue);
  }

  setData(data: Dataset) {
    // this._onDatasetChange is already bound to this
    this.data?.removeEventListener('change', this._onDatasetChange as EventListenerOrEventListenerObject);
    this.data = data;
    this.data.addEventListener('change', this._onDatasetChange as EventListenerOrEventListenerObject);

    this.rectangularBinPopup.setData(data);
  }

  private _onDatasetChange(evt: CustomEvent) {
    this._rerender();
  }

  setOutputFunction(fn: OutputFunction) {
    // this._onOutputFunctionChange is already bound to this
    this.outputFunction?.removeEventListener('change', this._onOutputFunctionChange as EventListenerOrEventListenerObject);
    this.outputFunction = fn;
    this.outputFunction.addEventListener('change', this._onOutputFunctionChange as EventListenerOrEventListenerObject);
  }

  private _onOutputFunctionChange(evt: CustomEvent) {
    this._rerender();
  }

  private _rerender() {
    const { width, height } = this.resizeContainer!;
    const ctx = this.canvas!.getContext('2d')!;
    const svg = select<SVGSVGElement, any>(this.svg!);

    ctx.clearRect(0, 0, width, height);
    if (this.data === null) {
      console.debug('no render, data not yet available');
      return;
    }

    const totalHeight = clamp(MIN_HEIGHT, height, Infinity);
    const totalWidth = clamp(MIN_WIDTH, width, Infinity);

    const marginBlock = height - totalHeight;
    const marginInline = width - totalWidth;

    const marginLeft = Math.floor(marginInline / 2);
    const marginTop = Math.floor(marginBlock / 2);
    const paddingLeft = 3
    const yAxisWidth = 50;
    const entropyHistogramPadding = 5;
    const entropyHistogramWidth = 60;
    const paddingRight = 3;
    const paddingTop = 3;
    const paddingBottom = 3;
    const legendHeight = this.noLegend ? 0 : 32;
    const xAxisTickHeight = 4;
    const xAxisLabelHeight = 12;
    const xAxisLabelPadding = 2;
    const xAxisHeight = 2 * xAxisLabelPadding + 2 * xAxisTickHeight + xAxisLabelHeight;
    const _remainingVerticalSpace = totalHeight
      - paddingBottom - paddingTop
      - legendHeight
      - xAxisHeight;
    const histogramHeight = clamp(30, _remainingVerticalSpace / 3, 60);
    const scrollAreaHeight = _remainingVerticalSpace - histogramHeight;
    const _mainAreaWidth = totalWidth - paddingLeft - paddingRight - entropyHistogramPadding - entropyHistogramWidth - yAxisWidth;

    // ensure that main area width is multiple of numBinsX
    const xScaleBand = scaleBand<number>()
      .domain(range(this.data.numBins).map((d, _, { length }) => d / length))
      .range([marginLeft + paddingLeft + yAxisWidth, marginLeft + paddingLeft + yAxisWidth + _mainAreaWidth])
      .paddingInner(0)
      .paddingOuter(0)
      .align(0)
      .round(true);
    const _dm = xScaleBand.domain();
    const _x0 = xScaleBand(_dm[0])!;
    const _x1 = xScaleBand(_dm[_dm.length - 1])! + xScaleBand.bandwidth();
    const mainAreaWidth = _x1 - _x0;

    const xStops = Array.from(
      cumsum([
        marginLeft,
        paddingLeft,
        yAxisWidth,
        mainAreaWidth,
        entropyHistogramPadding,
        entropyHistogramWidth
      ])
    ).slice(1);
    const yStops = Array.from(
      cumsum([
        marginTop,
        paddingTop,
        histogramHeight,
        legendHeight,
        xAxisHeight,
        scrollAreaHeight
      ])
    ).slice(1);

    const histogramX = xStops.slice(1, 3) as [number, number];
    const histogramY = yStops.slice(0, 2) as [number, number];
    const legendX = xStops.slice(1, 3) as [number, number];
    const legendY = yStops.slice(1, 3) as [number, number];
    const xAxisX = xStops.slice(1, 3) as [number, number];
    const xAxisY = yStops.slice(2, 4) as [number, number];
    const scrollerX = xStops.slice(1, 3) as [number, number];
    const scrollerY = yStops.slice(3, 5) as [number, number];
    const yAxisX = xStops.slice(0, 2) as [number, number];
    const yAxisY = yStops.slice(3, 5) as [number, number];
    const entropyHistogramX = xStops.slice(3, 5) as [number, number];
    const entropyHistogramY = yStops.slice(3, 5) as [number, number];

    this._mainColumnExtentX = scrollerX;

    const xScale = scaleLinear<number, number>()
      .domain([0, this.data.period])
      .range(xAxisX);

    const yTicks = range(
      this.data.index - this.numBinsYPerDirection,
      this.data.index + this.numBinsYPerDirection + 1
    );
    const yScale = scaleBand<number>()
      .paddingInner(0)
      .paddingOuter(0)
      .domain(yTicks)
      .range(yAxisY)
      .align(0)
      .round(true);

    const context = {
      ctx,
      svg,
      xScale,
      xScaleBand,
      yScale,
      yTicks,
      xAxisTickHeight,
      xAxisLabelHeight,
      xAxisLabelPadding,
      totalWidth,
    };

    this._renderScroller(context, scrollerX, scrollerY);
    this._renderXAxis(context, xAxisX, xAxisY);
    this._renderYAxis(context, yAxisX, yAxisY);
    this._renderEntropyHistogram(context, entropyHistogramX, entropyHistogramY);
    this._renderLegend(context, legendX, legendY);
    this._renderHistogram(context, histogramX, histogramY);
  }

  // component rendering
  private _renderScroller(
    { svg, ctx, yScale, yTicks, xScaleBand }: RenderingContext,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
  ) {
    const colorFn = getColorFunction(this.colorScale, COLOR_BINS);

    const drawableTicks = yTicks.filter(d => d > 0 && d < this.data!.periodCount);
    const tickExtent = extent<number>(drawableTicks);
    const vals = this.data!.getHistograms(tickExtent[0] || 0, tickExtent[1] || 1);
    const ext = extent<number>(vals);
    const minVal = ext[0] ?? 0;
    const maxVal = ext[1] ?? 1;

    const scalingFn: ScaleLinear<number, number> = (this.data!.displayAttribute === DisplayAttributeType.COUNT)
      ? scaleLinear<number>().domain([0, maxVal]).range([0, 1])
      : scaleLinear<number>().domain([minVal, maxVal]).range([0, 1]);

    drawableTicks.forEach((tick, i) => {
      const y = yScale(tick)!;

      xScaleBand.domain().forEach((phase, j) => {
        const value = scalingFn(vals[i * this.data!.numBins + j]);
        const x = xScaleBand(phase)!;

        ctx.fillStyle = colorFn(value);
        ctx.fillRect(x, y, xScaleBand.bandwidth(), yScale.bandwidth());
      });
    });

    // mark current row
    const dy = yScale.bandwidth();
    if (dy >= 10) {
      const ya = yScale(this.data!.index) || 0;

      ctx.fillStyle = 'none';
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.rect(x0, ya - 1, x1-x0 + 1, dy + 2);
      ctx.stroke();

      ctx.strokeStyle = 'white';
      ctx.beginPath();
      ctx.rect(x0 + 1, ya, x1-x0 - 1, dy);
      ctx.stroke();
    }

    const setPopupPeriod = (e: MouseEvent) => {
      const y = e.clientY - this.offsetTop;
      const periods = yScale.domain();
      const poss = periods.map(d => yScale(d)) as Array<number>;
      const idx = bisectRight(poss, y);
      const periodIdx = periods[idx - 1];
      this.rectangularBinPopup.setAttribute('period', `${this.data!.periods[periodIdx]}`);
    };

    svg.selectAll<SVGRectElement, null>('rect.scrollable-rect')
      .data([null])
      .join('rect')
        .classed('scrollable-rect', true)
        .attr('x', x0)
        .attr('y', y0)
        .attr('width', x1 - x0)
        .attr('height', y1 - y0)
        .attr('opacity', 0)
        .on('wheel', event => {
          event.preventDefault();
          event.stopPropagation();

          if (event.deltaY === 0) return;

          const { clientX, clientY } = event;
          setPopupPeriod(event);
          this.rectangularBinPopup.beginShow();
          this.rectangularBinPopup.setAttribute('x-position', clientX);
          this.rectangularBinPopup.setAttribute('y-position', clientY);

          const index = this.data!.index + Math.sign(event.deltaY);
          if (index < 0 || index >= this.data!.periodCount) return;
          this.data!.index = index;
        })
        .on('click', event => {
          const { clientX, clientY } = event;
          const { top, left } = this.getBoundingClientRect();

          const x = clientX - left;
          const y = clientY - top;

          if (x < x0 || x > x1 || y < y0 || y > y1) return;
          const idx = Math.floor((y - y0 - yScale.paddingOuter() * yScale.step()) / yScale.step());
          const dIdx = idx - this.numBinsYPerDirection;
          if (dIdx !== 0) this.data!.index = this.data!.index + dIdx;

          setPopupPeriod(event);
          this.rectangularBinPopup.beginShow();
          this.rectangularBinPopup.setAttribute('x-position', clientX);
          this.rectangularBinPopup.setAttribute('y-position', clientY);
        })
        .on('mouseenter', event => {
          const { clientX, clientY } = event;
          setPopupPeriod(event);
          this.rectangularBinPopup.beginShow();
          this.rectangularBinPopup.setAttribute('x-position', clientX);
          this.rectangularBinPopup.setAttribute('y-position', clientY);
        })
        .on('mouseleave', event => {
          this.rectangularBinPopup.endShow();
        })
        .on('mousemove', event => {
          setPopupPeriod(event);
          const { clientX, clientY } = event;
          this.rectangularBinPopup.setAttribute('x-position', clientX);
          this.rectangularBinPopup.setAttribute('y-position', clientY);
        });
  }

  private _renderHistogram(
    { svg, xScale }: RenderingContext,
    [_x0, _x1]: [number, number],
    [y0, y1]: [number, number],
  ) {
    const vals = this.data!.getHistogram(this.data!.index);
    const ext = extent<number>(vals);
    const maxVal = ext[1] || 1;

    const scale = scaleLinear<number, number>()
      .domain([0, maxVal])
      .range([y1, y0]);

    const g = svg.selectAll<SVGGElement, any>('g.histogram')
      .data([null])
      .join('g')
        .classed('histogram', true);
    g.selectAll<SVGRectElement, number>('rect')
      .data(vals)
      .join('rect')
        .attr('x', (_,i) => xScale(i / this.data!.numBins * this.data!.period))
        .attr('y', d => scale(d))
        .attr('width', _ => xScale(1 / this.data!.numBins * this.data!.period) - xScale(0))
        .attr('height', d => y1 - scale(d))
        .attr('fill', '#444');
  }

  private isLegendDragging: boolean = false;
  private _renderLegend(
    { ctx, svg, xScale, totalWidth }: RenderingContext,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
    phaseOffset: number = 0,
  ) {
    const g = svg.selectAll<SVGGElement, any>('g.legend')
      .data([null])
      .join('g')
        .classed('legend', true);
    const legendBg = g.selectAll<SVGGElement, null>('g.glyphs')
      .data([null])
      .join('g')
        .classed('glyphs', true);

    const getPhase = (e: MouseEvent): number => {
      const { clientX } = e;
      const { left } = svg.node()!.getBoundingClientRect();

      const offset = xScale.invert(clientX - left);
      const phase = offset / this.data!.period;
      return phase;
    };
    let callbackId = -1;
    const update = (e: MouseEvent) => {
      const phase = getPhase(e);
      const phaseOffset = phase + this.outputFunction!.phase;
      cancelIdleCallback(callbackId);
      callbackId = requestIdleCallback(_ => {
        ctx.clearRect(0, y0, totalWidth, y1-y0);
        this._renderLegend({ ctx, svg, xScale, totalWidth } as RenderingContext, [x0, x1], [y0, y1], phaseOffset);
      });
    };

    g.selectAll<SVGRectElement, null>('rect.clickable-rect')
      .data([null])
      .join('rect')
        .classed('clickable-rect', true)
        .attr('x', x0)
        .attr('y', y0)
        .attr('width', x1 - x0)
        .attr('height', y1 - y0)
        .attr('opacity', 0)
        .on('mousedown', e => {
          this.isLegendDragging = true;
          update(e);
        })
        .on('mousemove', e => {
          if (!this.isLegendDragging) return;
          update(e);
        })
        .on('mouseup', e => {
          this.isLegendDragging = false;
          const phase = getPhase(e);

          this.outputFunction && (this.outputFunction.phase = -phase);
        });


    if (this.outputFunction?.hasShape()) {
      // draw glyphs
      const glyphRadius = Math.floor(0.3 * (y1 - y0));
      const numGlyphs = Math.floor((x1 - x0) / (3 * glyphRadius));
      const glyphDelta = 1 / (numGlyphs - 1);
      const xTicks = range(x0, x1, (x1 - x0) * glyphDelta);
      const p = this.outputFunction!.invert(phaseOffset);
      const t0 = p * this.data!.period;

      const glyphs: Array<{ x: number, t: number }> = xTicks.map(v => {
        const offset = xScale.invert(v);
        const t = this.data!.temporalDomain[0] + offset - t0;
        const phi = this.data!.calculatePhase(t);

        return { x: v, t: phi, t0 };
      });

      ctx.save();
      ctx.beginPath();
      glyphs.forEach(glyph => {
        const t = glyph.t - phaseOffset;

        this.outputFunction!.initializeContext(ctx);
        ctx.fillStyle = ctx.strokeStyle = this.outputFunction!.color(t);
        ctx.setTransform(new DOMMatrix().translate(glyph.x, (y0 + y1) / 2));
        this.outputFunction!.draw(glyph.t, ctx, (y1 - y0) / 1.5);
      });
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    } else {
      // draw color scale
      legendBg.html('');  // no glyphs

      const xTicks = range(x0, x1);
      xTicks.forEach(v => {
        const offset = xScale.invert(v);
        const t = this.data!.temporalDomain[0] + offset;
        const phi = this.data!.calculatePhase(t);

        const fillColor = this.outputFunction!.color(phi - phaseOffset);


        ctx.fillStyle = fillColor;
        ctx.fillRect(v, y0, 1, y1 - y0);
      });
    }


    // render phase 0
    const p = this.outputFunction!.invert(phaseOffset);
    const t = p * this.data!.period;

    const phaseX = xScale(t);
    ctx.fillStyle = 'none';
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(phaseX, y0);
    ctx.lineTo(phaseX, y1);
    ctx.closePath();
    ctx.stroke();
  }

  private _renderXAxis(
    { svg, xScale, xAxisTickHeight, xAxisLabelHeight }: RenderingContext,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
  ) {
    const tickValues = linearTicks(xScale.domain() as [number, number]);
    const tickPositions = tickValues.map(d => xScale(d));

    const g = svg.selectAll('g.x-axis')
      .data([null])
      .join('g')
        .classed('x-axis', true)
        .attr('font-size', xAxisLabelHeight / 1.2)  // line height: 1.2
        .attr('text-anchor', 'middle')
        .attr('font-family', 'sans-serif');

    const pathData = [
      `M ${x0} ${y0} H ${x1}`,
      `M ${x0} ${y1} H ${x1}`,
      ...tickPositions.map(d => `M ${d} ${y0} V ${y0 + xAxisTickHeight}`),
      ...tickPositions.map(d => `M ${d} ${y1} V ${y1 - xAxisTickHeight}`),
    ].join(' ');

    g.selectAll('path')
      .data([pathData])
      .join('path')
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('d', d => d);

    const tickData = zip<string | number>(
      tickValues.map(d => timeFmt(d, 2, false)),
      tickPositions
    );

    g.selectAll<SVGTextElement, typeof tickData[0]>('text')
      .data(tickData)
      .join('text')
        .attr('fill', 'black')
        .attr('dy', '0.5em')
        .attr('x', d => d[1])
        .attr('y', (y0 + y1) / 2)
        .text(d => d[0])
        .call(nonoverlapLabels('x', 5));
  }

  private _renderYAxis(
    { svg, yScale, yTicks, xAxisLabelHeight, xAxisTickHeight, xAxisLabelPadding }: RenderingContext,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
  ) {
    const g = svg.selectAll('g.y-axis')
      .data([null])
      .join('g')
        .classed('y-axis', true)
        .attr('font-size', xAxisLabelHeight / 1.2)  // line height: 1.2
        .attr('text-anchor', 'end')
        .attr('font-family', 'sans-serif');
    const bgGroup = g.selectAll('g.bg')
      .data([null])
      .join('g')
        .classed('bg', true);

    const drawableTicks = yTicks.filter(d => d > 0 && d < this.data!.periodCount);
    const tickPoss = drawableTicks.map(d => yScale(d));
    tickPoss.push(tickPoss[tickPoss.length - 1]! + yScale.bandwidth());
    const [y0_, y1_] = extent<number>(tickPoss as number[]);

    const pathData = [
      `M ${x1} ${y0_} V ${y1_}`,
      ...tickPoss.map(d => `M ${x1} ${d} h ${-xAxisTickHeight}`),
    ].join(' ');

    g.selectAll('path')
      .data([pathData])
      .join('path')
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('d', d => d);

    // background for the current period, but only if bandwidth > text height
    const bgData = yScale.bandwidth() >= xAxisLabelHeight ? [ null ] : [];
    bgGroup.selectAll<SVGRectElement, null>('rect.current-period-bg')
      .data(bgData)
      .join('rect')
        .classed('current-period-bg', true)
        .attr('fill', '#ccc')
        .attr('x', x0)
        .attr('y', yScale(this.data!.index) || 0)
        .attr('width', x1 - x0)
        .attr('height', yScale.bandwidth());

    const text = g.selectAll<SVGTextElement, number>('text')
      .data(drawableTicks)
      .join('text')
        .attr('fill', 'black')
        .attr('font-weight', d => d === this.data!.index ? 'bold' : 'normal')
        .attr('dy', '0.4em')
        .attr('x', Math.floor(x1 - xAxisLabelPadding - xAxisTickHeight))
        .attr('y', d => yScale(d)! + yScale.bandwidth()/2)
        .text(d => timeFmt(this.data!.periods[d], 2, false));

    // unoverlap labels, ensure that center, and ideally first and last label,
    // always stay visible
    const priorities = new Array(2 * this.numBinsYPerDirection + 1).fill(0);
    priorities[0] = 1;
    priorities[priorities.length - 1] = 1;
    priorities[this.numBinsYPerDirection] = 2;
    // label will always be visible.
    selectAll<SVGTextElement, number>(text.nodes())
      .call(nonoverlapLabels('y', 2, (_, i) => priorities[i]));
  }

  private _renderEntropyHistogram(
    { svg, ctx, yScale, yTicks, xScaleBand }: RenderingContext,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
  ) {
    const drawableTicks = yTicks.filter(d => d > 0 && d < this.data!.periodCount);

    // most uninteresting histogram;
    const ext = extent<number>(this.data!.entropies);
    const ext0 = ext[0] || 0;
    const ext1 = ext[1] || 1;
    const doiScale = scaleLinear<number, number>()
      .domain([ext0, ext1])
      .range([1, 0]);

    const xScale = scaleLinear<number, number>()
      .domain([0, 1])
      .range([0, x1 - x0]);

    const g = svg.selectAll('g.entropy-histogram')
      .data([null])
      .join('g')
        .classed('entropy-histogram', true);

    const data = drawableTicks.map(tick => {
      const entropy = this.data!.entropies[tick];
      const vectorstrength = this.data!.vectorstrengths[tick];

      // TODO: better measure from 0 (uninteresting) to 1 (interesting)
      const doi = doiScale(entropy);
      return { tick, doi, entropy, vectorstrength };
    });

    const widthFn: (d: typeof data[0]) => number = this.useVectorstrength
      ? d => xScale(d.vectorstrength)
      : d => xScale(d.doi);
    const titleFn: (d: typeof data[0]) => string = this.useVectorstrength
      ? d => `Vector strength: ${d.vectorstrength}`
      : d => `Metric entropy: ${d.entropy}Sh. DOI: ${d.doi}.`

    g.selectAll<SVGRectElement, typeof data[0]>('rect')
      .data(data)
      .join('rect')
        .attr('x', x0)
        .attr('y', d => yScale(d.tick)!)
        .attr('width', widthFn)
        .attr('height', yScale.bandwidth())
        .attr('fill', '#444')
      .selectAll('title')
      .data(d => [d])
      .join('title')
        .text(titleFn);
    }
};
