import { LitElement, css, html, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ref, createRef } from 'lit/directives/ref.js';
import type { Ref } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import { scaleLinear } from 'd3-scale';
import { range, extent } from 'd3-array';
import { format } from 'd3-format';

import { timeFmt, COLOR_BINS } from './utils';
import type { D3InterpolateColorValue } from './interpolated-color-schemes';
import getColorFunction from './interpolated-color-schemes';
import { DisplayAttributeType } from './dataset';

interface PreviewData {
  label: string;
  numBins: number;
  numPeriods: number;

  entropy: number;
  vectorstrength: number;
  period: number;

  relativeEntropy: number;
  relativeVectorstrength: number;

  periods: Float32Array;
  histograms: Float32Array;

  displayAttribute: DisplayAttributeType;
};

const PIXEL_SIZE = 8;

@customElement('period-preview')
export default class PeriodPreview extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-rows: repeat(4, max-content);
      padding: 1em;
      font-size: 0.8em;

      --shadow-color: hsl(0deg 0% 0% / 0.3);
      box-shadow: 0 0 1em 0.15em var(--shadow-color);
      border-radius: 0.3em;
    }

    :host(:hover) {
      cursor: pointer;
      --shadow-color: hsl(221deg 60% 15% / 0.4);
    }
    .label {
      font-weight: bold;
    }
    .quality,
    .labels,
    .ranking {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
  `;

  private canvas: Ref<HTMLCanvasElement> = createRef();

  @property({ attribute: false })
  data: PreviewData | null = null;

  @property({ attribute: 'color-scheme', type: String })
  colorScale: D3InterpolateColorValue = 'YlOrBr';

  @property({ attribute: 'use-vectorstrength', type: Boolean })
  useVectorstrength: boolean = false;

  @property({ attribute: 'rank', type: Number })
  rank: number = 0;

  @property({ attribute: 'of', type: Number })
  of_: number = 0;


  render() {
    if (this.data === null) return html`incomplete`;

    this.canvas.value && this.renderCanvas(this.canvas.value);

    const { numBins, numPeriods } = this.data;

    const canvasWidth = numBins * PIXEL_SIZE + 2;
    const canvasHeight = numPeriods * PIXEL_SIZE;

    const qualityFmt = format('.5~f');
    const relativeQualityFmt = format('+.4~f');

    const qual = this.useVectorstrength ? this.data?.vectorstrength : this.data?.entropy;
    const relQual = this.useVectorstrength ? this.data?.relativeVectorstrength : this.data?.relativeEntropy;
    const factor = this.useVectorstrength ? 1 : -1;  // entropy: smaller is better


    return html`
      <div class="labels">
        <span class="label">${unsafeHTML(this.data?.label)}</span>
        <span class="period">${timeFmt(this.data?.period, 4, true)}</span>
      </div>
      <canvas ${ref(this.canvas)} width=${canvasWidth} height=${canvasHeight}></canvas>
      <div class="quality">
        <span>${qualityFmt(qual)}</span>
        <span style="font-style: italic; color: ${relQual * factor > 0 ? 'forestgreen' : 'darkred'}">${relativeQualityFmt(relQual)}</span>
      </div>
      <div class="ranking">
        <span>#<strong>${this.rank}</strong> of ${this.of_}</span>
        <svg width=${12 * this.of_} height=${12}>
          ${range(1, this.of_ + 1).map((rank, i) => {
            return svg`
              <rect x=${12 * i + 2} y=${2} width=${8} height=${8}
                stroke="black" stroke-width="1" fill=${rank === this.rank ? 'black' : 'none'}>
            `;
          })}
        </svg>
      </div>
    `;
  }

  firstUpdated() {
    this.canvas.value && this.renderCanvas(this.canvas.value);
  }

  private renderCanvas(canvas: HTMLCanvasElement) {
    const { width, height } = canvas;
    const ctx = canvas.getContext('2d')!;

    const { histograms, numBins, numPeriods } = this.data!;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(1, 1);

    const ext = extent(histograms);
    const minValue = ext[0] ?? 0;
    const maxValue = ext[1] ?? 1;
    const _scalingFn = scaleLinear<number>();
    if (this.data!.displayAttribute === DisplayAttributeType.COUNT)
      _scalingFn.domain([0, maxValue]);
    else _scalingFn.domain([minValue, maxValue]);
    const _colorFn = getColorFunction(this.colorScale, COLOR_BINS);
    const colorFn = (t: number) => _colorFn(_scalingFn(t));

    for (let j = 0; j < numPeriods; ++j) {
      for (let i = 0; i < numBins; ++i) {
        const color = colorFn(histograms[i + j * numBins]);
        ctx.strokeStyle = 'none';
        ctx.fillStyle = color;
        ctx.fillRect(i * PIXEL_SIZE, j * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // mark current row
    const ya = Math.floor(numPeriods / 2) * PIXEL_SIZE;

    ctx.fillStyle = 'none';
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.rect(-1, ya - 1, width - 1, PIXEL_SIZE + 2);
    ctx.stroke();

    ctx.strokeStyle = 'white';
    ctx.beginPath();
    ctx.rect(1, ya, width - 3, PIXEL_SIZE);
    ctx.stroke();

    ctx.restore();
  }
};
