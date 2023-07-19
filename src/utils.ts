import { format } from 'd3-format';
import { range, bisectRight } from 'd3-array';
import { D3InterpolateColorValue } from './interpolated-color-schemes';

export const DAY_SECONDS = 60 * 60 * 24;
export const COLOR_BINS = 12;
export const DEFAULT_INTERPOLATED_COLORSCHEME: D3InterpolateColorValue = 'Blues';

type FactorEntry = [number, number, string, string, number];
const factors: Array<FactorEntry> = [
  [1, 1, 'second', 's', 3],
  [1, 5, 'second', 's', 1],
  [1, 15, 'second', 's', 2],
  [60, 1, 'minute', 'min', 3],
  [60, 5, 'minute', 'min', 1],
  [60, 15, 'minute', 'min', 2],
  [3_600, 1, 'hour', 'h', 3],
  [3_600, 4, 'hour', 'h', 1],
  [3_600, 12, 'hour', 'h', 2],
  [86_400, 1, 'day', 'd', 1],
  [604_800, 1, 'week', 'wk', 1],
  [2.629728e6, 1, 'month', 'mo', 1], 
  [3.077914e7, 1, 'year', 'a', 3],
  [3.077914e7, 5, 'year', 'a', 2],
  [3.077914e7, 10, 'year', 'a', 1],
  [3.077914e7, 50, 'year', 'a', 1],
  [3.077914e7, 100, 'year', 'a', 1],
  [3.077914e7, 500, 'year', 'a', 1],
  [3.077914e7, 1000, 'year', 'a', 1],
];

export function timeFmt(
  val: number,
  precision: number = 1,
  long: boolean = false
): string {
  let i = factors.length - 1;
  while (val / (factors[i][0] * factors[i][1]) < 1 && i > 0) --i;

  const valFmt = format(`.${precision}~f`)(val / factors[i][0]);  // actual number here
  if (long) {
    return `${valFmt} ${factors[i][2]}${valFmt === '1' ? '' : 's'}`;
  }
  return `${valFmt}${factors[i][3]}`;
}

/**
  * Generate [tick, priority] tuples from the `factors`.
  * Tick priorities range [4..6] for first, [1..3] for consecutive multiples.
  * The start and end points have priority 7.
  */
export function ticks([start, end]: [number, number]): Array<[number, number]> {
  const vals: Array<[number, number]> = [];
  let endval = end;

  // find highest possible factor
  let i = factors.length - 1;
  while (end / (factors[i][0] * factors[i][1]) < 1 && i > 0) --i;

  while (i >= 0 && start / (factors[i][0] * factors[i][1]) <= 1) {
    // add to range for the current factor
    const values = range((factors[i][0] * factors[i][1]), endval - (factors[i][0] * factors[i][1])/2, (factors[i][0] * factors[i][1]));
    const priorities = new Array(values.length).fill(factors[i][4]);
    priorities[0] = factors[i][4] + 3;

    // find the first index where the value is larger than the start value
    const idx = bisectRight(values, start);

    const entries: Array<[number, number]> = [];
    for (let j = idx; j < values.length; ++j) {
      entries.push([values[j], priorities[j]]);
    }

    vals.splice(0, 0, ...entries);

    endval = (factors[i][0] * factors[i][1]);
    --i;
  }

  if (Math.abs(start / vals[0][0] - 1) > 0.3) vals.splice(0, 0, [start, 7]);
  else vals[0][1] = 7;

  if (Math.abs(end / vals[vals.length - 1][0] - 1) > 0.3) vals.push([end, 7]);
  return vals;
}

export function allTicks([start, end]: [number, number]): Array<number> {
  const vals: Array<number> = [];
  const facts = factors.filter(d => d[1] === 1);
  let idx = 0;
  let factor = 1;
  while (facts[idx][0] * factor <= end) {
    const val = facts[idx][0] * factor;
    if (idx < facts.length - 1 && val >= facts[idx+1][0]) {
      ++idx;
      factor = 1;
      continue;
    }
    vals.push(val);
    ++factor;
  }

  return vals.filter(d => d >= start && d <= end);
}

export function linearTicks([start, end]: [Period, Period], numTicks: number = 10): Array<Period> {
  const delta = (end - start) / numTicks;

  // find highest possible factor
  let i = factors.length - 1;
  while (delta / (factors[i][0] * factors[i][1]) < 1 && i > 0) --i;
  if (i < factors.length - 1) ++i;

  // create ticks
  const factor = factors[i][0] * factors[i][1];
  const idx0 = Math.ceil(start / factor);
  const idx1 = Math.floor(end / factor);
  const idxs = range(idx0, idx1+1);

  const ticks = idxs.map(d => d * factor);

  // add start and end
  if (start < ticks[0]) ticks.splice(0, 0, start);
  if (end > ticks[ticks.length - 1]) ticks.push(end);

  return ticks;
}

export function getPhaseFactor(period: number): number {
  let i = factors.length - 1;
  while (i > 0 && period / (factors[i][0] * factors[i][1]) <= 1) --i;
  return factors[i][0];
}

const durationRe = /^\s*(?<duration>\d+(\.\d+)?)\s*(?<unit>[a-z]+)\s*$/;
export function parseDuration(durationText: string): number {
  const result = durationRe.exec(durationText);
  if (!result) throw new Error('unparsable');

  const { duration, unit } = result.groups as { duration: string, unit: string };
  const durRaw = parseFloat(duration);

  const unitFactor = factors
    .filter(d => d[1] === 1)
    .find(([_, __, long, short]) => (unit === long || unit === `${long}s` || unit === short));

  if (!unitFactor) throw new Error('unknown unit');

  return durRaw * unitFactor[0];
}

export function clamp(min: number, value: number, max: number): number {
  if (min > max) throw new Error(`clamp() cannot produce valid output: min > max (${min} > ${max})`);

  return Math.max(min, Math.min(max, value));
}
