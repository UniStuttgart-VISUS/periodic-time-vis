import { select } from 'd3-selection';
import { max } from 'd3-array';
import 'd3-transition';

const skipKeys = new Set<string>(['id', 'transitionDelay', 'transitionDuration', 'order', 'withinLayerOrdering']);

function setProperties(sel: any) {
  const dataKeys = new Set<string>(sel.selection().data().flatMap(d => Array.from(Object.keys(d))));

  for (const key of dataKeys) {
    if (skipKeys.has(key)) continue;
    if (key === 'text') sel.text(d => d['text'] ?? null);
    else sel.attr(key, function(this: SVGElement, d) {
      if (d[key] === undefined) return this.getAttribute(key);
      return d[key];
    });
  }
}

export async function render(step: StepProperties) {
  const svg = select('svg');
  const { rectangles, circles, lines, paths, texts } = step;

  // rectangles
  svg.selectAll<SVGRectElement, Properties>('rect')
    .data(rectangles, d => d.id)
    .join(
      enter => enter.append('rect')
        .call(setProperties),
      update => update.transition()
        .duration(d => d.transitionDuration ?? 0)
        .delay(d => d.transitionDelay ?? 0)
        .call(setProperties),
      exit => exit.remove(),
    );

  // circles
  svg.selectAll<SVGRectElement, Properties>('circle')
    .data(circles, d => d.id)
    .join(
      enter => enter.append('circle')
        .call(setProperties),
      update => update.transition()
        .duration(d => d.transitionDuration ?? 0)
        .delay(d => d.transitionDelay ?? 0)
        .call(setProperties),
      exit => exit.remove(),
    );

  // paths
  svg.selectAll<SVGPathElement, Properties>('path')
    .data(paths, d => d.id)
    .join(
      enter => enter.append('path')
        .call(setProperties),
      update => update.transition()
        .duration(d => d.transitionDuration ?? 0)
        .delay(d => d.transitionDelay ?? 0)
        .call(setProperties),
      exit => exit.remove(),
    );

  // texts
  svg.selectAll<SVGTextElement, Properties>('text')
    .data(texts, d => d.id)
    .join(
      enter => enter.append('text')
        .call(setProperties),
      update => update.transition()
        .duration(d => d.transitionDuration ?? 0)
        .delay(d => d.transitionDelay ?? 0)
        .call(setProperties),
      exit => exit.remove(),
    );

  // lines
  svg.selectAll<SVGLineElement, Properties>('line')
    .data(lines, d => d.id)
    .join(
      enter => enter.append('line')
        .call(setProperties),
      update => update.transition()
        .duration(d => d.transitionDuration ?? 0)
        .delay(d => d.transitionDelay ?? 0)
        .call(setProperties),
      exit => exit.remove(),
    );

  // at the end: order by layer, and within layers
  svg.selectAll<SVGElement, GeneralProperties>('*')
    .sort((a, b) => {
      if ((a.layer ?? -1) === (b.layer ?? -1)) {
        return (a.withinLayerOrdering ?? -1) - (b.withinLayerOrdering ?? -1);
      }

      return (a.layer ?? -1) - (b.layer ?? -1);
    });

  const elems = [...rectangles, ...circles, ...paths, ...lines, ...texts];
  const maxDur = max(elems, d => d.transitionDuration) ?? 0;
  const maxDelay = max(elems, d => d.transitionDelay) ?? 0;

  await new Promise<void>(resolve => {
    setTimeout(_ => {
      requestAnimationFrame(_ => resolve());
    }, maxDur + maxDelay + 15);
  });
}
