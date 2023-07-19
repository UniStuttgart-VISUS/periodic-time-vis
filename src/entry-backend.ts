import {
  interpolateSinebow,
  interpolateRainbow,
  interpolateViridis,
  interpolateWarm,
  interpolateCool,
  interpolateTurbo,
  interpolateSpectral
} from 'd3-scale-chromatic';
import { select } from 'd3-selection';
import { range } from 'd3-array';
import { json } from 'd3-fetch';

import {
  parametrizedStarShape,
  parametrizedRectangleShape,
  parametrizedDropShape,
  parametrizedMoonPhaseShape,
} from './parametrized-shape';
import { OutputFunction } from './output-function';
import ScentedWidget from './scented-widget';
import TimeSlider from './time-slider';

import Visualization from './demo/visualization';
import './time-slider';
import { Dataset, DisplayAttributeType } from './dataset';
import { initializeDataset, uploadAndInitializeDataset } from './dataset';
import './period-preview';
import ResizeContainer from 'resizing-svg-canvas';
import PeriodPreview from './period-preview';
import type { ShapeGenerator } from './parametrized-shape';

const uploadInput = document.querySelector<HTMLInputElement>('input#upload-dataset');
if (uploadInput) uploadInput.value = '';
document.body.addEventListener('dragover', e => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
});
document.body.addEventListener('drop', e => {
  e.preventDefault();
  if (uploadInput) {
    uploadInput.files = e.dataTransfer!.files;
    uploadInput.dispatchEvent(new CustomEvent('input'));
  }
});

const controlArea = document.querySelector('#controls')!;
const resizeContainer = new ResizeContainer(document.querySelector('#vis')!);
const visCanvas = resizeContainer.addCanvasLayer();
const visSvg = resizeContainer.addSvgLayer();

const outputFunction: OutputFunction = new OutputFunction(interpolateSpectral, 'interpolateSpectral');


const colorSchemes: Array<[string, typeof interpolateSinebow]> = [
  ['Sinebow', interpolateSinebow],
  ['Rainbow', interpolateRainbow],
  ['Viridis', interpolateViridis],
  ['Warm', interpolateWarm],
  ['Cool', interpolateCool],
  ['Turbo', interpolateTurbo],
  ['Spectral', interpolateSpectral],
];
const buttons = select('#color-scheme-controls');
for (let [label, fn] of colorSchemes) {
  buttons
    .append('button')
    .text(label)
    .on('click', () => {
      outputFunction.setColorFunction(fn, label);
      outputFunction.trigger();
    });
}

const glyphs: Array<[string, ShapeGenerator]> = [
  ['3-star', parametrizedStarShape(3)],
  ['4-star', parametrizedStarShape(4)],
  ['5-star', parametrizedStarShape(5)],
  ['6-star', parametrizedStarShape(6)],
  ['Angled rectangle', parametrizedRectangleShape(5)],
  ['Angled drop', parametrizedDropShape()],
  ['Moon phase', parametrizedMoonPhaseShape()],
];
const buttons2 = select('#glyph-type-controls');
for (let [label, fn] of glyphs) {
  buttons2
    .append('button')
    .text(label)
    .on('click', () => {
      outputFunction.setShapeFunction(fn);
      outputFunction.trigger();
    });
}

document.querySelector('.buttons button#color-selector')!.addEventListener('click', () => {
  outputFunction.resetShapeFunction();
  outputFunction.setColorFunction(interpolateSpectral, 'interpolateSpectral');
  outputFunction.trigger();
});
document.querySelector('.buttons button#glyph-selector')!.addEventListener('click', () => {
  outputFunction.resetColorFunction();
  outputFunction.setShapeFunction(glyphs[0][1]);
  outputFunction.trigger();
});

/// -- connect widget parameters to scented widget
const yBinInput = document.querySelector<HTMLInputElement>('#param-ybins')!;
const colorSchemeInput = document.querySelector<HTMLSelectElement>('#param-color')!;
const legendCheckbox = document.querySelector<HTMLInputElement>('#widget-legend')!;
new MutationObserver(_ => {
  const widget: ScentedWidget | null = controlArea.querySelector<ScentedWidget>(':scope scented-widget');
  if (!widget) return;

  const yBins = widget.numBinsYPerDirection;
  const colorScheme = widget.colorScale;
  const legend = !widget.noLegend;

  yBinInput.valueAsNumber = yBins;
  colorSchemeInput.value = colorScheme;
  legendCheckbox.checked = legend;
}).observe(controlArea, { childList: true, subtree: true });

yBinInput.addEventListener('input', _ =>
  controlArea
    .querySelector(':scope scented-widget')
    ?.setAttribute('num-bins-y', yBinInput.value)
);
colorSchemeInput.addEventListener('input', _ => {
  controlArea.querySelector(':scope scented-widget')?.setAttribute('color-scheme', colorSchemeInput.value);
  document.querySelectorAll('period-preview')
    .forEach(d => d.setAttribute('color-scheme', colorSchemeInput.value));
});
legendCheckbox.addEventListener('input', _ =>
  controlArea
    .querySelector(':scope scented-widget')
    ?.toggleAttribute('no-legend', !legendCheckbox.checked)
);

const visualizationCoupledInput = document.querySelector<HTMLInputElement>('input#visualization-coupled')!;
visualizationCoupledInput.addEventListener('input', _ => visualization && (visualization.coupled = visualizationCoupledInput.checked));

const widget: ScentedWidget = new ScentedWidget();
controlArea.innerHTML = ``;
controlArea.setAttribute('style', 'display:grid');
controlArea.appendChild(widget);

let visualization: Visualization;
let dataset: Dataset;
let oldResizeListener: any = null;

async function updateDataset(data: string | File) {
  onDatasetStartLoad();
  dataset?.removeEventListener('change', onDatasetChange);

  if (typeof data === 'string') dataset = await initializeDataset(data);
  else dataset = await uploadAndInitializeDataset(data);

  dataset?.addEventListener('change', onDatasetChange);
  onDatasetChange();

  if (widget instanceof ScentedWidget) {
    widget.setOutputFunction(outputFunction);
    widget.toggleAttribute('use-vectorstrength', useVectorstrength.checked);
  }
  widget.setData(dataset);

  const slider = document.querySelector<TimeSlider>('time-slider');
  slider!.setData(dataset);

  if (periodSuggestor === undefined) periodSuggestor = new PeriodSuggestor(dataset);
  else periodSuggestor.setData(dataset);

  visualization?.deregister();
  visSvg.innerHTML = '';
  visualization = new Visualization(visSvg, visCanvas, dataset, outputFunction, visualizationCoupledInput.checked);
  const listener = (e: Event) => {
    const { width, height } = (e as CustomEvent<{ width: number, height: number }>).detail;
    visualization.render(width, height);
  };
  visSvg.removeEventListener('resize', oldResizeListener);
  oldResizeListener = listener;
  visSvg.addEventListener('resize', listener);

  onDatasetEndLoad();
}

const datasetChoices = await json<Array<{ key: string, title: string, description: string | null }>>('/datasets');
if (!datasetChoices) throw new Error('could not get data');

select<HTMLFieldSetElement, any>('#dataset-selector-buttons')
  .selectAll<HTMLButtonElement, typeof datasetChoices[0]>('button')
  .data(datasetChoices)
  .join('button')
    .attr('title', d => d.description)
    .text(d => d.title)
    .on('click', async (_e, d) => await updateDataset(d.key));

document.querySelector('input#upload-dataset')
  ?.addEventListener('input', async evt => {
    return await updateDataset((evt.target as HTMLInputElement)!.files![0]);
  });

const useVectorstrength = document.querySelector<HTMLInputElement>('#use-vectorstrength')!;
const useEntropy = document.querySelector<HTMLInputElement>('#use-entropy')!;
[useVectorstrength, useEntropy].forEach(v => {
  v.addEventListener('change', async _ => {
    document.querySelectorAll('scented-widget, period-preview')
      .forEach(d => d.toggleAttribute('use-vectorstrength', useVectorstrength.checked));
      await periodSuggestor.reevaluatePreviews();
  });
});

const visualizedAttribute = document.querySelector<HTMLSelectElement>('#visualized-attribute')!;
visualizedAttribute.addEventListener('input', async _ => {
  onDatasetStartLoad();
  await dataset.setDisplayAttribute(visualizedAttribute.value as DisplayAttributeType);
  onDatasetEndLoad();
});

function onDatasetChange() {
  visualizedAttribute.value = dataset!.displayAttribute;
}

function onDatasetStartLoad() {
  document.body.toggleAttribute('inert', true);
}

function onDatasetEndLoad() {
  document.body.toggleAttribute('inert', false);
}


class PeriodSuggestor {
  private timeoutId: ReturnType<typeof setTimeout>;
  private currentAdditionalDataRequestId: number = -1;

  constructor(
    private dataset: Dataset,
    private readonly idleTimeout: number = 150,
  ) {
    this.onDatasetChange = this.onDatasetChange.bind(this);
    this.dataset?.addEventListener('change', this.onDatasetChange);

    this.onIdleTimeout = this.onIdleTimeout.bind(this);
    if (this.dataset) this.timeoutId = setTimeout(this.onIdleTimeout, this.idleTimeout);
    else this.timeoutId = setTimeout(() => {}, this.idleTimeout);
  }

  setData(data: Dataset) {
    this.dataset.removeEventListener('change', this.onDatasetChange);
    this.dataset = data;
    this.dataset.addEventListener('change', this.onDatasetChange);
    this.reevaluatePreviews();
  }

  private onDatasetChange(_e: Event): void {
    const container = document.querySelector<HTMLDivElement>('#suggestions-bar .wrapper')!;

    container.innerHTML = '';

    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(this.onIdleTimeout, this.idleTimeout);
  }

  async reevaluatePreviews() {
    return await this.onIdleTimeout();
  }

  private async onIdleTimeout(): Promise<void> {
    this.currentAdditionalDataRequestId = this.dataset.nextRequestId;

    const container = document.querySelector<HTMLDivElement>('#suggestions-bar .wrapper')!;

    container.innerHTML = '';
    requestAnimationFrame(_ => redrawBackground());

    // find the n best multiples and divisors of current period
    const currentPeriod = this.dataset.period || 1;
    const context = 5;
    const maxFactor = 12;
    const numPreviews = 5;
    const blockLength = 2 * context + 1;

    const existing: Set<number> = new Set<number>([0, 1]);

    const otherPeriods: Array<{ label: string, period: number }> = [];

    for (let denominator = 2; denominator <= maxFactor; ++denominator) {
      const factor = denominator;
      otherPeriods.push({ period: factor * currentPeriod, label: `&times; ${factor}` });
      otherPeriods.push({ period: currentPeriod / factor, label: `/ ${factor}` });

      existing.add(factor);
      existing.add(1 / factor);

      for (let nominator = 1; nominator < 2 * denominator; ++nominator) {
        const factor = nominator / denominator;
        if (existing.has(factor)) continue;

        existing.add(factor);
        otherPeriods.push({ period: factor * currentPeriod, label: `&times; ${nominator} / ${denominator}` });
      }
    }

    const filteredOtherPeriods = otherPeriods
      .filter(({ period }) => period >= this.dataset.periodDomain[0] && period <= this.dataset.periodDomain[1]);

    const periodData = filteredOtherPeriods
      .flatMap(({ period }) => {
        return range(-context, context + 1).map(d => Math.pow(1.005, d) * period);
      });

    const additionalData = await this.dataset.loadAdditionalPeriods(periodData, false);

    if (this.currentAdditionalDataRequestId > additionalData.requestId) {
      console.log(`SUPPLEMENT DATA (#${additionalData.requestId}) arrived too late. Currently waiting on #${this.currentAdditionalDataRequestId}. Discarding.`);
      return;
    }

    const otherPeriodsWithData = filteredOtherPeriods.map((d, i) => {
      const entropy = additionalData.entropies[blockLength * i + context];
      const vectorstrength = additionalData.vectorstrengths[blockLength * i + context];
      const periods = new Float32Array(blockLength);
      const histograms = new Float32Array(blockLength * this.dataset.numBins);
      for (let j = 0; j < blockLength; ++j) {
        const idx = j + i * blockLength;
        periods[j] = additionalData.periods[idx];

        for (let k = 0; k < this.dataset.numBins; ++k) {
          histograms[k + j * this.dataset.numBins] = additionalData.histograms[k + idx * this.dataset.numBins];
        }
      }

      return {
        ...d,
        entropy,
        periods,
        histograms,
        vectorstrength,
      };
    });


    if (useVectorstrength.checked)
      otherPeriodsWithData.sort(({ vectorstrength: va }, { vectorstrength: vb }) => vb - va);
    else
      otherPeriodsWithData.sort(({ entropy: entropyA }, { entropy: entropyB }) => entropyA - entropyB);


    otherPeriodsWithData.slice(0, numPreviews)
      .map((d, i) => { return { ...d, rank: i + 1 }; })
      .sort((a, b) => a.period - b.period)
      .forEach(({ period, label, entropy, periods, histograms, vectorstrength, rank }, _, { length: n }) => {
        const preview = document.createElement('period-preview') as any;
        preview.data = {
          label,
          numBins: this.dataset.numBins,
          numPeriods: blockLength,
          period,
          periods,
          histograms,

          displayAttribute: this.dataset.displayAttribute,

          entropy,
          relativeEntropy: entropy - this.dataset.entropies[this.dataset.index],
          vectorstrength,
          relativeVectorstrength: vectorstrength - this.dataset.vectorstrengths[this.dataset.index],
        };
        preview.toggleAttribute('use-vectorstrength', useVectorstrength.checked);
        preview.setAttribute('color-scheme', colorSchemeInput.value);
        preview.setAttribute('rank', rank);
        preview.setAttribute('of', n);

        container.appendChild(preview);

        preview.addEventListener('click', _ => this.dataset.setPeriodExact(period));
      });

    requestAnimationFrame(_ => redrawBackground());
  }
};

let periodSuggestor: PeriodSuggestor;
const initialDatasetKey = datasetChoices.find(d => d.key === 'synthetic2')?.key ?? datasetChoices[0].key;
await updateDataset(initialDatasetKey);


const resize = new ResizeContainer(document.querySelector('#background')!);

const bg = resize.addSvgLayer();
let svgWidth = 0;
let svgHeight = 0;

bg.addEventListener('resize', (evt: Event) => {
  const { width, height } = (evt as CustomEvent<{ width: number, height: number }>).detail;
  svgWidth = width;
  svgHeight = height;

  redrawBackground();
});

const bar = document.querySelector('#suggestions-bar')!;
bar.addEventListener('scroll', _ => {
  redrawBackground();
});

function redrawBackground() {
  const slider = document.querySelector<TimeSlider>('time-slider')!;
  const { left: mainX, top: mainY } = bg.getBoundingClientRect();
  const { left: widgetX, top: widgetY } = widget.getBoundingClientRect();
  const { left: sliderX, top: sliderY, bottom: sliderBottom } = slider.getBoundingClientRect();
  const [ widgetRelX0, widgetRelX1 ] = widget.mainColumnExtentX;

  const areas: Array<string> = [];
  const lines: Array<string> = [];

  // widget leader
  const y0 = widgetY - mainY;
  const y3 = sliderBottom - mainY;
  const dy = (y0 - y3) / 3;
  const y1 = y0 - dy;
  const y11 = y0 - 0.5 * dy;
  const y2 = y3 + dy;

  const x0 = widgetX - mainX + widgetRelX0;
  const x1 = widgetX - mainX + widgetRelX1;
  const x2 = (x0 + x1) / 2;

  const { x: xTick_ } = slider.relativePositionOfTick(dataset!.period);
  const xTick = xTick_ + sliderX - mainX;

  areas.push(`
    M ${x0} ${y0}
    C ${x0} ${y11} ${x2} ${y11} ${x2} ${y1}
    C ${x2} ${y11} ${x1} ${y11} ${x1} ${y0}
    Z
             `);

  lines.push(`
    M ${x2} ${y1 + 2}
    C ${x2} ${y2} ${xTick} ${y2} ${xTick} ${y3}
    `);


  const suggestions = document.querySelectorAll<PeriodPreview>('period-preview');
  suggestions.forEach(sug => {
    const period = sug.data?.period;
    if (period === undefined) return;

    const { left: widgetX, bottom: widgetY, width: widgetWidth } = sug.getBoundingClientRect();

    const y0 = widgetY - mainY;
    const y3 = sliderY - mainY;
    const dy = (y3 - y0) / 3;
    const y1 = y0 + dy;
    const y11 = y0 + 0.5 * dy;
    const y2 = y3 - dy;

    const x0 = widgetX - mainX;
    const x1 = x0 + widgetWidth;
    const x2 = x0 + 0.5 * widgetWidth;

    const { x: xTick_ } = slider.relativePositionOfTick(period);
    const xTick = xTick_ + sliderX - mainX;

    areas.push(`
      M ${x0} ${y0}
      C ${x0} ${y11} ${x2} ${y11} ${x2} ${y1}
      C ${x2} ${y11} ${x1} ${y11} ${x1} ${y0}
      Z
               `);

    lines.push(`
      M ${x2} ${y1 - 2}
      C ${x2} ${y2} ${xTick} ${y2} ${xTick} ${y3}
      `);
  });


  select(bg)
    .selectAll<SVGSVGElement, typeof areas[0]>('path.area')
    .data(areas)
    .join('path')
      .classed('area', true)
      .attr('fill', '#aaa')
      .attr('d', d => d);

  select(bg)
    .selectAll<SVGSVGElement, typeof areas[0]>('path.line')
    .data(lines)
    .join('path')
      .classed('line', true)
      .attr('fill', 'none')
      .attr('stroke', '#aaa')
      .attr('stroke-width', 2)
      .attr('d', d => d);
}
