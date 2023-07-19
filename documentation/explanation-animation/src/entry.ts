import { range, max } from 'd3-array';
import { json } from 'd3-fetch';
import { scaleQuantize } from 'd3-scale';
import { schemeBlues } from 'd3-scale-chromatic';

import { render } from './render';

const data: any = await json('data.json');

const dataPoints = data.events as Array<{ t: number, jitter: number, delay: number }>;
const allBinnings = data.binnings as { [key: number]: Array<number>};
const binningsFine = data.binnings_fine as { [key: number]: Array<number> };
const numBins = 13;  // TODO


function props(period: number) {
  const binnings = allBinnings[period];
  const color = scaleQuantize<string>()
    .domain([0, max(binnings) ?? 1])
    .range(schemeBlues[9]);

  const numPeriods = period;
  const numTotalRangeBins = binnings.length;

  const periodTicks = range(14);
  const totalRangeBins = range(numTotalRangeBins);

  const binnedSum = new Array(numBins).fill(0);
  binnings.forEach((d,i) => binnedSum[i % numBins] += d);
  const _m = max(binnedSum) || 1;  // ||: must not be zero
  const colorPhaseHistogram = color.copy().domain([0, _m]);

  const _m2 = max(Array.from(Object.values(binningsFine)).map(d => max(d) ?? 1)) || 1;
  const colorBinningsFine = color.copy().domain([0, _m2]);

  return {
    binnings,
    color,
    numPeriods,
    numTotalRangeBins,
    periodTicks,
    totalRangeBins,
    binnedSum,
    colorPhaseHistogram,
    binningsFine,
    colorBinningsFine,
  };
}


async function* createAxis(): StepGenerator {
  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const texts: Properties[] = periodTicks.map(d => {
      return {
        id: `axis label ${d}`,
        transitionDuration: 0,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: 100,
        y: 120,
        opacity: 0,
        'font-size': 12,
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
        text: (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`,
      };
    });
    const paths: Properties[] = [
      {
        id: 'path0',
        transitionDuration: 0,
        stroke: 'black',
        'stroke-width': 1,
        fill: 'black',
        d: 'M 100 100 h 10 v 5 l 15 -5 -15 -5 v 5 z',
        opacity: 0,
      },
    ];
    const lines: Properties[] = periodTicks.map(d => {
      return {
        id: `line${d}`,
        transitionDuration: 0,
        stroke: 'black',
        'stroke-width': 1,
        x1: 100, x2: 100,
        y1: 100,
        y2: 108,
        opacity: 0,
      };
    });
    const circles: Properties[] = [0,1].flatMap(idx => dataPoints.map((d,i) => {
      const x = 100 + 1700 * d.t;
      return {
        id: `data point ${idx} ${i}`,
        fill: 'darkred',
        cx: x,
        cy: 5,
        r: 2,
        opacity: 0,
      };
    }));
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      const w = 1700 / numTotalRangeBins;
      const x = 100 + d * w;

      return {
        id: `total range bin ${idx} ${d}`,
        transitionDelay: 800,
        x,
        y: 100,
        width: w,
        height: 0,
        'stroke-opacity': 0,
        'fill-opacity': 0,
        'stroke-width': 1,
        stroke: 'black',
        fill: color(binnings[d]),
      };
    }));

    yield { texts, paths, lines, circles, rectangles };
  }

  let tOld, pOld, rOld, cOld, lOld;
  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: x,
        y: 120,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
        text: (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`,
      };
    });

    const w = 1700 / numTotalRangeBins;
    const w2 = 2 * w;
    periodTicks.forEach(d => {
      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + d * w2 - 3;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 0,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 0,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0}–${t1}`,
      });
    });

    const paths: Properties[] = [
      {
        id: 'path0',
        transitionDuration: 800,
        stroke: 'black',
        'stroke-width': 1,
        fill: 'black',
        d: 'M 100 100 h 1730 v 5 l 15 -5 -15 -5 v 5 z',
        opacity: 1,
      },
    ];
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 800,
        stroke: 'black',
        'stroke-width': 1,
        x1: x, x2: x,
        y1: 100,
        y2: 108,
        opacity: 1,
      };
    });
    const circles: Properties[] = [0,1].flatMap(idx => dataPoints.map((d,i) => {
      return {
        transitionDuration: 200,
        transitionDelay: 800 + 500 * d.delay,
        id: `data point ${idx} ${i}`,
        cy: 95 - d.jitter * 50,
        opacity: idx === 0 ? 0 : 1,
      };
    }));
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      return {
        id: `total range bin ${idx} ${d}`,
        transitionDelay: 800,
        'stroke-opacity': idx === 0 ? 0 : 1,
      };
    }));

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const texts: Properties[] = tOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = lOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });

    const w = 1700 / numTotalRangeBins;
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      return {
        id: `total range bin ${idx} ${d}`,
        transitionDuration: 500,
        transitionDelay: d * 5,
        y: 200,
        height: w,
      };
    }));

    const circles: Properties[] = [0,1].flatMap(idx => dataPoints.map((d,i) => {
      const props: any = (idx === 0) ? {
        opacity: 1,
      } : {
        transitionDuration: 200,
        transitionDelay: 100 + numTotalRangeBins * 5 + 200 * d.delay,
        cy: 200 + d.jitter * w,
      };

      return {
        id: `data point ${idx} ${i}`,
        ...props,
      };
    }));

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const texts: Properties[] = tOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = lOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });

    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      return {
        id: `total range bin ${idx} ${d}`,
        transitionDuration: 500,
        transitionDelay: d * 5,
        'fill-opacity': idx === 0 ? 0 : 1,
      };
    }));

    const circles: Properties[] = [0,1].flatMap(idx => dataPoints.map((d,i) => {
      return {
        transitionDuration: 200,
        transitionDelay: 100 + numTotalRangeBins * 5 * d.t,
        id: `data point ${idx} ${i}`,
        opacity: (idx === 1) ? 0 : 1,
      };
    }));

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: x,
        y: 120,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
        text: (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`,
      };
    });


    const w = 1700 / numTotalRangeBins;
    const w2 = 2 * w;
    periodTicks.forEach(d => {
      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 0,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 0,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0}–${t1}`,
      });
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = lOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });

    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      return {
        id: `total range bin ${idx} ${d}`,
        transitionDuration: 0,
        'fill-opacity': 1,
        'stroke-opacity': 1,
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 1200,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
      stroke: 'black',
      'stroke-width': 1,
      fill: 'none',
      'stroke-opacity': 0,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: x,
        y: 120,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
        text: (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`,
      };
    });

    const w = 1700 / numTotalRangeBins;
    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });

    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = lOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });

    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) return { id };

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const transitionDelay = 350 * j;
      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = 300 + j * w2;

      return {
        id,
        transitionDelay,
        transitionDuration: 350,
        x: xpos,
        y: ypos,
        'stroke-width': 0,
        width: w2,
        height: w2,
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 1200,
      'stroke-opacity': 1,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  // modify period length first time, to 12
  const periods = [12,11,12,13];
  for (const period of periods) {
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);

    const w = 1700 / numTotalRangeBins;
    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });

    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });


    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 800,
        x1: x, x2: x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) {
        const x = 100 + d * w;
        return {
          id,
          transitionDelay: 200,
          transitionDuration: 600,
          x,
          y: 200,
          width: w,
          height: w,
          'stroke-width': idx === 1 ? 1 : 0,
          stroke: 'black',
          layer: -idx,
          opacity: 1,
          withinLayerOrdering: -d,
          fill: color(binnings[d]),
        };
      }

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = 300 + j * w2;

      return {
        id,
        transitionDelay: 200,
        transitionDuration: 600,
        withinLayerOrdering: -d,
        layer: -idx,
        x: xpos,
        y: ypos,
        width: w2,
        height: w2,
        'stroke-width': idx === 1 ? 1 : 0,
        stroke: 'black',
        fill: color(binnings[d]),
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 200,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  // add our histogram's rectangles
  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins } = props(period);
    const w = 1700 / numTotalRangeBins;
    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });

    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 800,
        x1: x, x2: x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const rectangles: Properties[] = [0,1,2].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) {
        const x = 100 + d * w;
        return {
          id,
          withinLayerOrdering: -d,
          layer: -idx,
          transitionDelay: 200,
          transitionDuration: 600,
          x,
          y: 200,
          width: w,
          height: w,
          'stroke-width': idx === 1 ? 1 : 0,
          stroke: 'black',
          fill: color(binnings[d]),
        };
      }

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = 300 + j * w2;

      return {
        id,
        transitionDelay: 0,
        transitionDuration: 0,
        withinLayerOrdering: -d,
        layer: idx === 0 ? -1 : 2,
        x: xpos,
        y: ypos,
        width: w2,
        height: w2,
        fill: color(binnings[d]),
        'stroke-width': idx === 1 ? 1 : 0,
        stroke: 'black',
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 200,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
      withinLayerOrdering: 200,
      layer: 3,
    });

    // our representation
    range(numBins).forEach(bin => {
      rectangles.push({
        id: `phase diagram bin ${bin}`,
        layer: 200,
        transitionDelay: 0,
        transitionDuration: 0,
        x: 960 - w2 * numBins / 2 + w2 * bin,
        y: 750,
        width: w2,
        height: w2,
        fill: 'white',
        opacity: 0,
        'stroke-width': 0,
      });
    });
    rectangles.push({
      id: 'phase diagram frame',
      layer: 200,
      withinLayerOrdering: 200,
      transitionDelay: 0,
      transitionDuration: 0,
      x: 960 - w2 * numBins / 2,
      y: 750,
      width: w2 * numBins,
      height: w2,
      fill: 'none',
      stroke: 'black',
      'stroke-width': 1,
      'stroke-opacity': 0,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  // move our histogram's rectangles down to their place
  {
    const period = 13;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins, binnedSum, colorPhaseHistogram } = props(period);
    const w = 1700 / numTotalRangeBins;
    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });

    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 800,
        x1: x, x2: x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const rectangles: Properties[] = [0,1,2].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) {
        const x = 100 + d * w;
        return {
          id,
          withinLayerOrdering: -d,
          layer: -idx,
          transitionDelay: 200,
          transitionDuration: 600,
          x,
          y: 200,
          width: w,
          height: w,
          'stroke-width': idx === 1 ? 1 : 0,
          stroke: 'black',
          fill: color(binnings[d]),
        };
      }

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = (idx === 0) ? 300 + j * w2 : 750;

      return {
        id,
        transitionDelay: 150,
        transitionDuration: 850,
        withinLayerOrdering: -d,
        layer: idx === 0 ? -1 : 2,
        x: xpos,
        y: ypos,
        width: w2,
        height: w2,
        fill: color(binnings[d]),
        'stroke-width': idx === 1 ? 1 : 0,
        stroke: 'black',
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 200,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
      withinLayerOrdering: 200,
      layer: 3,
    });

    // our representation
    range(numBins).forEach(bin => {
      rectangles.push({
        id: `phase diagram bin ${bin}`,
        layer: 200,
        transitionDelay: 150,
        transitionDuration: 850,
        fill: colorPhaseHistogram(binnedSum[bin]),
        opacity: 1,
        x: 960 - w2 * numBins / 2 + w2 * bin,
        y: 750,
        width: w2,
        height: w2,
      });
    });
    rectangles.push({
      id: 'phase diagram frame',
      layer: 200,
      withinLayerOrdering: 200,
      transitionDelay: 150,
      transitionDuration: 350,
      'stroke-opacity': 1,
      x: 960 - w2 * numBins / 2,
      y: 750,
      width: w2 * numBins,
      height: w2,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  // vary periodicity again
  for (let period = 13; period >= 11; --period) {
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins, binnedSum, colorPhaseHistogram } = props(period);
    const w = 1700 / numTotalRangeBins;
    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });

    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 800,
        x1: x, x2: x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) {
        const x = 100 + d * w;
        return {
          id,
          withinLayerOrdering: -d,
          layer: -idx,
          transitionDelay: 200,
          transitionDuration: 600,
          x,
          y: 200,
          width: w,
          height: w,
          'stroke-width': idx === 1 ? 1 : 0,
          stroke: 'black',
          fill: color(binnings[d]),
        };
      }

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = 300 + j * w2;

      return {
        id,
        transitionDelay: 150,
        transitionDuration: 850,
        withinLayerOrdering: -d,
        layer: -1,
        x: xpos,
        y: ypos,
        width: w2,
        height: w2,
        fill: color(binnings[d]),
        'stroke-width': 0,
        stroke: 'black',
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 200,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
      withinLayerOrdering: 200,
      layer: 3,
    });

    // our representation
    range(numBins).forEach(bin => {
      rectangles.push({
        id: `phase diagram bin ${bin}`,
        layer: 200,
        transitionDelay: 150,
        transitionDuration: 850,
        fill: colorPhaseHistogram(binnedSum[bin]),
        opacity: 1,
        x: 960 - w2 * numBins / 2 + w2 * bin,
        y: 750,
        width: w2,
        height: w2,
      });
    });
    rectangles.push({
      id: 'phase diagram frame',
      layer: 200,
      withinLayerOrdering: 200,
      transitionDelay: 150,
      transitionDuration: 350,
      'stroke-opacity': 1,
      x: 960 - w2 * numBins / 2,
      y: 750,
      width: w2 * numBins,
      height: w2,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  // add other rows of phase histogram
  {
    const period = 11;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins, binnedSum, colorPhaseHistogram, binningsFine, colorBinningsFine } = props(period);
    const w = 1700 / numTotalRangeBins;
    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 800,
        x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });

    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 1,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 800,
        x1: x, x2: x,
        opacity: (x > 1800) ? 0 : 1,
      };
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return rest;
    });
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) {
        const x = 100 + d * w;
        return {
          id,
          withinLayerOrdering: -d,
          layer: -idx,
          transitionDelay: 200,
          transitionDuration: 600,
          x,
          y: 200,
          width: w,
          height: w,
          'stroke-width': idx === 1 ? 1 : 0,
          stroke: 'black',
          fill: color(binnings[d]),
        };
      }

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = 300 + j * w2;

      return {
        id,
        transitionDelay: 150,
        transitionDuration: 850,
        withinLayerOrdering: -d,
        layer: -1,
        x: xpos,
        y: ypos,
        width: w2,
        height: w2,
        fill: color(binnings[d]),
        'stroke-width': 0,
        stroke: 'black',
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDelay: 200,
      transitionDuration: 200,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
      withinLayerOrdering: 200,
      layer: 3,
    });

    // our representation
    Object.entries(binningsFine).forEach(([k, vs]) => {
      vs.forEach((v, i) => {
        rectangles.push({
          id: `phase diagram bin ${k} ${i}`,
          layer: 200,
          withinLayerOrdering: -Math.abs(parseInt(k)),
          transitionDelay: 0,
          transitionDuration: 0,
          fill: colorBinningsFine(v),
          opacity: 1,
          x: 960 - w2 * numBins / 2 + w2 * i,
          y: 750,
          width: w2,
          height: w2,
        });
      });
    });
    rectangles.push({
      id: 'phase diagram frame',
      layer: 200,
      withinLayerOrdering: 200,
      transitionDelay: 150,
      transitionDuration: 350,
      'stroke-opacity': 1,
      x: 960 - w2 * numBins / 2,
      y: 750,
      width: w2 * numBins,
      height: w2,
    });
    rectangles.push({
      id: 'phase diagram current frame',
      layer: 200,
      withinLayerOrdering: 190,
      transitionDelay: 0,
      transitionDuration: 0,
      stroke: 'darkred',
      fill: 'none',
      'stroke-opacity': 0,
      x: 960 - w2 * numBins / 2,
      y: 750,
      width: w2 * numBins,
      height: w2,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }

  // expand phase histogram and move to center, hide rest
  {
    const period = 11;
    const { binnings, color, numPeriods, numTotalRangeBins, periodTicks, totalRangeBins, binnedSum, colorPhaseHistogram, binningsFine, colorBinningsFine } = props(period);
    const w = 1700 / numTotalRangeBins;
    const texts: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `axis label ${d}`,
        transitionDuration: 150,
        x,
        opacity: 0,
      };
    });

    const w2 = 2 * w;
    periodTicks.forEach(d => {
      if (d >= period) return;

      const xpos = 960 + w2 * numBins / 2 + 10;
      const ypos = 300 + (d+1) * w2 - 5;
      const t0 = (d === 0) ? '0' : (d === 1) ? 'τ' : `${d}τ`;
      const t1 = (d === 0) ? 'τ' : `${d+1}τ`;

      texts.push({
        id: `row label ${d}`,
        transitionDuration: 500,
        stroke: 'none',
        'stroke-width': 0,
        fill: 'black',
        x: xpos,
        y: ypos,
        opacity: 0,
        'font-size': 12,
        'text-anchor': 'start',
        'font-family': 'sans-serif',
        text: `${t0} – ${t1}`,
      });
    });
    const paths: Properties[] = pOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return { ...rest, transitionDuration: 150, opacity: 0 };
    });
    const lines: Properties[] = periodTicks.map(d => {
      const x = 100 + 1700 * d/numPeriods;
      return {
        id: `line${d}`,
        transitionDuration: 150,
        x1: x, x2: x,
        opacity: 0,
      };
    });
    const circles: Properties[] = cOld.map(d => {
      const { transitionDuration = null, transitionDelay = null, ...rest } = d;
      return { ...rest, transitionDuration: 150, opacity: 0 };
    });
    const rectangles: Properties[] = [0,1].flatMap(idx => totalRangeBins.map(d => {
      const id = `total range bin ${idx} ${d}`;
      if (idx === 1) {
        const x = 100 + d * w;
        return {
          id,
          withinLayerOrdering: -d,
          layer: -idx,
          transitionDuration: 150,
          x,
          y: 200,
          width: w,
          height: w,
          'stroke-width': idx === 1 ? 1 : 0,
          stroke: 'black',
          opacity: 0,
          fill: color(binnings[d]),
        };
      }

      const i = d % numBins;
      const j = Math.floor(d / numBins);

      const xpos = 960 - w2 * numBins / 2 + w2 * i;
      const ypos = 300 + j * w2;

      return {
        id,
        transitionDuration: 150,
        withinLayerOrdering: -d,
        layer: -1,
        x: xpos,
        y: ypos,
        width: w2,
        height: w2,
        fill: color(binnings[d]),
        'stroke-width': 0,
        stroke: 'black',
        opacity: 0,
      };
    }));
    rectangles.push({
      id: 'rectangular representation frame',
      transitionDuration: 150,
      x: 960 - w2 * numBins / 2,
      y: 300,
      width: w2 * numBins,
      height: w2 * Math.ceil(numTotalRangeBins / numBins),
      withinLayerOrdering: 200,
      layer: 3,
      opacity: 0,
    });

    // our representation
    Object.entries(binningsFine).forEach(([k, vs]) => {
      vs.forEach((v, i) => {
        rectangles.push({
          id: `phase diagram bin ${k} ${i}`,
          layer: 200,
          withinLayerOrdering: -Math.abs(parseInt(k)),
          transitionDelay: 0,
          transitionDuration: 1500,
          fill: colorBinningsFine(v),
          opacity: 1,
          x: 960 - w2 * numBins / 2 + w2 * i,
          y: 400 + w2 * parseInt(k),
          width: w2,
          height: w2,
        });
      });
    });
    rectangles.push({
      id: 'phase diagram frame',
      layer: 200,
      withinLayerOrdering: 200,
      transitionDuration: 1500,
      'stroke-opacity': 1,
      x: 960 - w2 * numBins / 2,
      y: 400 - 5 * w2,
      width: w2 * numBins,
      height: 11 * w2,
    });
    rectangles.push({
      id: 'phase diagram current frame',
      layer: 200,
      withinLayerOrdering: 190,
      transitionDuration: 1500,
      'stroke-opacity': 1,
      x: 960 - w2 * numBins / 2,
      y: 400,
      width: w2 * numBins,
      height: w2,
    });

    tOld = texts;
    pOld = paths;
    lOld = lines;
    cOld = circles;
    rOld = rectangles;
    yield { texts, paths, lines, circles, rectangles };
  }
}

async function* merge(...args: Array<StepGenerator>): StepGenerator {
  for (const arg of args) {
    for await (const a of arg) yield a;
  }
}


async function stepOnDemand(gen: StepGenerator) {
  for await (const step of gen) {
    await new Promise<void>(resolve => document.addEventListener('keypress', _ => resolve(), { once: true }));
    await render(step);
  }
}


await stepOnDemand(merge(createAxis()));
