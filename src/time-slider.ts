import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import ResizeContainer from 'resizing-svg-canvas';
import { scaleLog, select, drag, bisectCenter, ScaleLogarithmic, groups, max } from 'd3';

import { ticks, timeFmt, parseDuration } from './utils';
import nonoverlapLabels from './nonoverlapping-axis-labels';
import type { Dataset } from './dataset';

@customElement('time-slider')
export default class TimeSlider extends LitElement {
  static styles = css`
    :host {
      height: 36px;
      display: grid;
      gap: 0.5ex;
      padding-inline: 0.5ex;
      grid-template-columns: 1fr 100px;
      font-size: x-small;
    }

    input {
      align-self: center;
      font-size: inherit;
    }
  `;


  /// PROPERTIES

  @state()
  private data: Dataset | null = null;

  @state()
  private periodsOfInterest: Array<number> = [];

  // threshold in pixels under which we snap to an important tick
  @property({ type: Number, reflect: true, attribute: 'snap-threshold' })
  private snapThreshold = 5;

  /// OTHER

  private resizeContainer?: ResizeContainer;
  private resizeRoot?: HTMLElement;
  private svg?: SVGSVGElement;

  private x: ScaleLogarithmic<number, number> = scaleLog();
  private isDragging: boolean = false;

  private svgXOffset: number = 0;
  private svgYOffset: number = 0;


  /// LIFECYCLE

  constructor() {
    super();

    this._onDatasetChange = this._onDatasetChange.bind(this);
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.resizeRoot = document.createElement('div');
    this.resizeContainer = new ResizeContainer(this.resizeRoot);
    this.svg = this.resizeContainer.addSvgLayer();

    this.resizeRoot!.addEventListener('resize', () => this._redraw());
    this.resizeRoot!.addEventListener('click', (evt) => this._onClick(evt));
    this.resizeRoot!.addEventListener('wheel', (evt) => this._onWheel(evt));
    this.resizeRoot!.addEventListener('mouseenter', evt => this._onMouseover(evt));
    this.resizeRoot!.addEventListener('mousemove', evt => this._onMouseover(evt));
    this.resizeRoot!.addEventListener('mouseleave', evt => this._onMouseleave(evt));

    this.resizeRoot!.addEventListener('resize', () => this._recalculateSizing());
  }

  render() {
    this._redraw();
    const period = this.data?.period || 0;
    return html`
      ${this.resizeRoot}
      <input
        @change=${this._onTextChange}
        @input=${this._onTextInput}
        type="text"
        .value="${timeFmt(period, 8, true)}">
    `;
  }


  /// METHODS
  setData(data: Dataset) {
    // this._onDatasetChange is already bound to this
    this.data?.removeEventListener('change', this._onDatasetChange as EventListenerOrEventListenerObject);
    this.data = data;
    this.data.addEventListener('change', this._onDatasetChange as EventListenerOrEventListenerObject);
    this._collectInterestingPeriods();
  }

  relativePositionOfTick(tick: number): { x: number, y: number } {
    const { y0, y1 } = this._getMeasurements();
    const y = (y0 + y1) / 2 + this.svgYOffset;
    const x = this.x(tick) + this.svgXOffset;

    return { x, y };
  }

  private _recalculateSizing() {
    const outer = this.getBoundingClientRect();
    const inner = this.resizeRoot!.getBoundingClientRect();

    this.svgXOffset = inner.left - outer.left;
    this.svgYOffset = inner.top - outer.top;
  }


  private _redraw() {
    if (this.data === null) return;

    const { width, height, y0, y1, xRange } = this._getMeasurements();

    this.x = scaleLog<number, number>()
      .domain(this.data.periodDomain)
      .range(xRange);

    const poiTicks: Array<[number, number]> = this.periodsOfInterest.map(d => [d, 8]);
    const extraTicks: Array<[number, number]> = ticks([
      this.data.periodDomain[0],
      this.data.periodDomain[1]]
    );
    const collectedTicks: Array<[number, number]> = [...poiTicks, ...extraTicks];

    const allTicks = groups(collectedTicks, d => d[0])
      .map(([p, vals]: [number, Array<[number, number]>]): [number, number] => [p, max(vals, d => d[1]) ?? 1])
      .sort((a, b) => a[0] - b[0]);

    // TODO: provide priorities, even higher for "even" extra ticks
    const svg = select<SVGSVGElement, any>(this.svg!);

    const track = svg.selectAll<SVGPathElement, null>('path.track')
      .data([null])
      .join('path')
        .classed('track', true)
        .attr('fill', 'none')
        .attr('stroke-width', 1.5)
        .attr('stroke', this.isDragging ? 'steelblue' : 'gray')
        .attr('d', `M ${xRange[0]} ${(y0 + y1) / 2} H ${xRange[1]}`);

    svg.selectAll<SVGPathElement, typeof this.periodsOfInterest>('path.poi')
      .data([this.periodsOfInterest])
      .join('path')
        .classed('poi', true)
        .attr('fill', 'none')
        .attr('stroke', 'darkgray')
        .attr('stroke-width', 1)
        .attr('d', d => d.map(di => {
          const xVal = this.x(di);
          return `M ${xVal} ${y0} V ${(y0 + y1) / 2}`;
        }).join(' '));

    const axis = svg.selectAll<SVGGElement, Array<typeof allTicks>>('g.axis')
      .data([allTicks])
      .join('g')
        .classed('axis', true)
        .style('user-select', 'none')
        .attr('font-size', 10)
        .attr('font-family', 'sans-serif')
        .attr('text-anchor', 'middle');

    const tickSel = axis.selectAll<SVGGElement, typeof allTicks>('g.tick')
      .data(d => d)
      .join('g')
        .classed('tick', true)
        .attr('transform', d => `translate(${this.x(d[0])}, 0)`);

    tickSel.selectAll<SVGPathElement, typeof allTicks>('path')
      .data(d => [d])
      .join('path')
        .attr('fill', 'none')
        .attr('stroke', 'darkgray')
        .attr('stroke-width', 1)
        .attr('d', _ => `M 0 ${(y0 + y1) / 2} V ${y1}`);

    tickSel.selectAll<SVGTextElement, typeof allTicks>('text')
      .data(d => [d])
      .join('text')
        .attr('fill', 'darkgray')
        .attr('stroke', 'none')
        .attr('y', y1)
        .attr('dy', '1em')
        .text(d => `${timeFmt(d[0], 2, false)}`)
        .call(nonoverlapLabels('x', 5, d => d[1]));

    const handle = svg.selectAll<SVGCircleElement, null>('circle.handle')
      .data([null])
      .join('circle')
        .classed('handle', true)
        .attr('cx', this.x(this.data.period))
        .attr('cy', (y0 + y1) / 2)
        .attr('r', 5)
        .attr('fill', this.isDragging ? 'darkblue' : 'darkgray')
        .style('cursor', _ => this.isDragging ? 'grabbing' : 'grab')
        .on('mouseenter', _ => {
          if (!this.isDragging) handle.attr('fill', 'steelblue');
        })
        .on('mouseleave', _ => {
          if (!this.isDragging) handle.attr('fill', 'darkgray');
        })
        .call(drag<SVGCircleElement, any, any>()
          .on('start', _ => {
            this.isDragging = true;

            svg.style('cursor', 'grabbing');
            handle.style('cursor', 'grabbing');
            track.attr('stroke', 'steelblue');
            handle.attr('fill', 'darkblue');
          })
          .on('drag', e => {
            const xVal = Math.min(xRange[1], Math.max(xRange[0], e.x));
            handle.attr('cx', xVal);

            this._setValueWithSnapping(xVal, false);
          })
          .on('end', e => {
            this.isDragging = false;

            const xVal = Math.min(xRange[1], Math.max(xRange[0], e.x));
            handle.attr('cx', xVal);
            this._setValueWithSnapping(xVal);

            svg.style('cursor', null);
            handle.style('cursor', 'grab');
            track.attr('stroke', 'gray');
            handle.attr('fill', 'darkgray');
          }));
  }

  private _getMeasurements() {
    const { width, height } = this.resizeContainer!;
    const y0 = 4;
    const labelHeight = 12;
    const y1 = height - 4 - labelHeight;
    const y2 = height - 4;
    const xRange = [ 20, width - 20 ];

    return { width, height, y0, y1, y2, labelHeight, xRange };
  }

  private _setValueWithSnapping(x: number, snapToPriorities: boolean = true): void {
    if (this.data === null) return;

    if (snapToPriorities) {
      // find closest important point
      const periodXs = this.periodsOfInterest.map(d => this.x(d));
      const closestIdx = bisectCenter(periodXs, x);

      if (Math.abs(periodXs[closestIdx] - x) < this.snapThreshold) {
        // snap
        this.data.period = this.periodsOfInterest[closestIdx];
        return;
      }
    }

    this.data.period = this.x.invert(x);
  }

  private _collectInterestingPeriods(): void {
    if (this.data === null) {
      this.periodsOfInterest = [];
      return;
    }

    const count = 30;
    this.periodsOfInterest = [...this.data.entropies]
      .map((entropy, periodIndex) => [entropy, periodIndex])
      .sort(([entropyA], [entropyB]) => entropyA - entropyB)
      .slice(0, count)
      .map(([_, periodIndex]) => this.data!.periods[periodIndex])
      .sort((a,b) => a - b);
  }

  /// EVENT LISTENERS

  private _onClick(evt: MouseEvent) {
    if (this.isDragging) return;
    if (this.data === null) return;

    const { left, top } = this.resizeRoot!.getBoundingClientRect();
    const { clientX, clientY } = evt;
    const x = clientX - left;
    const y = clientY - top;

    const { y0, y1, xRange } = this._getMeasurements();

    if (y < y0 || y > y1) return;
    if (x < xRange[0] || x > xRange[1]) return;

    this._setValueWithSnapping(x);
  }

  private _onWheel(evt: WheelEvent) {
    if (this.isDragging) return;
    if (this.data === null) return;

    const index = this.data.index + Math.sign(-evt.deltaY);
    if (index >= 0 && index < this.data.periodCount) this.data.index = index;
  }

  private _onMouseover(evt: MouseEvent) {
    const { left, top } = this.resizeRoot!.getBoundingClientRect();
    const { clientX, clientY } = evt;
    const x = clientX - left;
    const y = clientY - top;

    const { y0, y1, xRange } = this._getMeasurements();

    if (y < y0 || y > y1 || x < xRange[0] || x > xRange[1]) this.title = '';

    const val = this.x.invert(x);
    this.title = timeFmt(val, 3, true);
  }

  private _onMouseleave(evt: MouseEvent) {
    this.title = '';
  }

  private _onTextChange(evt: InputEvent) {
    evt.stopPropagation();

    const content = (evt.target as HTMLInputElement).value;

    try {
      const duration = parseDuration(content);
      this.data!.setPeriodExact(duration);
    } catch (err: any) {
      console.warn(`${err.message}: ${content}`);
      this.shadowRoot!.querySelector('input')!.value = timeFmt(this.data!.period, 8, true);
    }
  }

  private _onTextInput(evt: InputEvent) {
    evt.stopPropagation();
  }

  private _onDatasetChange(evt: CustomEvent) {
    this.requestUpdate();
  }
};
