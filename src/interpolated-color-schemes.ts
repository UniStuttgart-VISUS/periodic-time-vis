import * as d3sc from 'd3-scale-chromatic';
import { scaleQuantize } from 'd3-scale';
import { range } from 'd3-array';

export const keys = [ 'Blues', 'BrBG', 'BuGn', 'BuPu', 'Cividis', 'Cool',
  'CubehelixDefault', 'GnBu', 'Greens', 'Greys', 'Inferno', 'Magma', 'Oranges',
  'OrRd', 'PiYG', 'Plasma', 'PRGn', 'PuBu', 'PuBuGn', 'PuOr', 'PuRd',
  'Purples', 'Rainbow', 'RdBu', 'RdGy', 'RdPu', 'RdYlBu', 'RdYlGn', 'Reds',
  'Sinebow', 'Spectral', 'Turbo', 'Viridis', 'Warm', 'YlGn', 'YlGnBu',
  'YlOrBr', 'YlOrRd' ] as const;
export type D3InterpolateColorValue = typeof keys[number];


function _isKey(key: string): key is D3InterpolateColorValue {
  if (keys.includes(key as D3InterpolateColorValue)) return true;
  return false;
}

function _getColorFunctionName(key: string): keyof typeof d3sc {
  if (_isKey(key)) return `interpolate${key}`;
  return 'interpolateViridis';
}

export default function getColorFunction(key: string, steps?: number): (t: number) => string {
  if (steps !== undefined) {
    const col = getColorFunction(key);
    const colors = range(steps).map(d => col(d / (steps - 1)));
    return scaleQuantize<string>().domain([0, 1]).range(colors);
  }

  return d3sc[_getColorFunctionName(key)] as (t: number) => string;
}


