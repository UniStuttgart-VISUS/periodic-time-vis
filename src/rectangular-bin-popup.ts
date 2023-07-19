import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { scaleLinear, scaleBand } from 'd3-scale';
import type { ScaleLinear, ScaleBand } from 'd3-scale';
import type { Selection } from 'd3-selection';
import { extent } from 'd3-array';

import { DAY_SECONDS, COLOR_BINS, DEFAULT_INTERPOLATED_COLORSCHEME } from './utils';
import type { D3InterpolateColorValue } from './interpolated-color-schemes';
import getColorFunction from './interpolated-color-schemes';
import { Dataset, DisplayAttributeType } from './dataset';

const MIN_HEIGHT = 50;  // px
const MIN_WIDTH = 200;   // px
const PADDING = 16;  // px
const MARGIN = 8;  // px

@customElement('rectangular-bin-popup')
export default class RectangularBinPopup extends LitElement {
  static styles = css`
    :host {
      z-index: 100;
      pointer-events: none;
    }

    div {
      position: absolute;

      min-width: ${MIN_WIDTH}px;
      min-height: ${MIN_HEIGHT}px;

      background: white;
      padding: ${PADDING}px;
      margin: ${MARGIN}px;

      box-shadow: 0 0 2em 0 hsl(0deg 0% 0% / 0.8);
    }
  `;

  private canvas!: HTMLCanvasElement;

  @state()
  private data: Dataset | null = null;

  @property({ attribute: 'period', type: Number })
  period: number = DAY_SECONDS;

  @property({ attribute: 'color-scheme', type: String })
  colorScale: D3InterpolateColorValue = DEFAULT_INTERPOLATED_COLORSCHEME;

  @property({ attribute: 'x-position', type: Number })
  xPosition: number = 0;

  @property({ attribute: 'y-position', type: Number })
  yPosition: number = 0;

  @property({ attribute: 'visibility-delay', type: Number })
  visibilityDelay: number = 1200;

  @state()
  private visible: boolean = false;

  @state()
  private timeoutId: any;

  constructor() {
    super();

    this._onDatasetChange = this._onDatasetChange.bind(this);
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.canvas = document.createElement('canvas');
  }

  disconnectedCallback(): void {
  }

  beginShow(): void {
    clearTimeout(this.timeoutId);
    this.visible = false;
    this.timeoutId = setTimeout(_ => this.visible = true, this.visibilityDelay);
  }

  endShow(): void {
    clearTimeout(this.timeoutId);
    this.visible = false;
  }

  render() {
    const { width, height } = this.canvas;
    let top = this.yPosition - height / 2 - MARGIN - PADDING;
    const left = this.xPosition - width - 2 * MARGIN - 2 * PADDING;

    if (top + height + 2 * MARGIN + 2 * PADDING > window.innerHeight)
      top = window.innerHeight - height - 2 * MARGIN - 2 * PADDING;
    if (top < 0) top = 0;

    return html`
      <div style="display: ${this.visible ? 'initial' : 'none'}; top: ${top}px; left: ${left}px">
        ${this.canvas}
      </div>
    `;
  }

  setData(data: Dataset) {
    // this._onDatasetChange is already bound to this
    this.data?.removeEventListener('change', this._onDatasetChange as EventListenerOrEventListenerObject);
    this.data = data;
    this.data.addEventListener('change', this._onDatasetChange as EventListenerOrEventListenerObject);
    this._rerender();
  }

  private _onDatasetChange(evt: CustomEvent) {
    this._rerender();
  }

  private _rerender() {
    if (this.data === null) {
      console.debug('no render, data not yet available');
      return;
    }

    const [t0, t1] = this.data.periodDomain;
    const dt = t1 - t0;
    const numRows = Math.ceil(dt / this.period);
    const rowHeight = 5;
    const width = Math.max(
      200,  // min width
      Math.min(
        600,  // max width
        Math.ceil(rowHeight * this.period / this.data.binningBinSize),  // try 5px width
      )
    );
    const height = rowHeight * numRows;
    const dx = width * this.data.binningBinSize / this.period;
    const ext = extent(this.data.binning);
    const minValue = ext[0] ?? 0;
    const maxValue = ext[1] ?? 1;
    const scalingFn = scaleLinear();
    if (this.data.displayAttribute === DisplayAttributeType.COUNT)
      scalingFn.domain([0, maxValue]);
    else scalingFn.domain([minValue, maxValue]);

    const _colorFn = getColorFunction(this.colorScale, COLOR_BINS);
    const colorFn = (t: number) => _colorFn(scalingFn(t));

    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d')!;

    let x = 0;
    let y = 0;

    for (let i = 0; i < this.data.numBinningBins; ++i) {
      const xLeft = x;
      const xRight = x + dx;
      const color = colorFn(this.data.binning[i]);

      ctx.fillStyle = color;
      ctx.fillRect(xLeft, y, Math.min(width, xRight) - xLeft, rowHeight);

      x += dx;

      if (xRight >= width) {
        y += rowHeight;
        x = xRight - width;
        ctx.fillRect(0, y, x, rowHeight);
      }
    }
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, _old, value);
    if (name === 'period') this._rerender();
  }
};
