import { groups } from 'd3';
import type { Selection } from 'd3-selection';

export default function nonoverlapLabels(
  direction: 'x' | 'y' = 'x',
  labelPadding: number = 5,
  priority: (n: any, i: number) => number = _ => 1,
): (sel: Selection<SVGTextElement, any, any, any>) => void {
  // hide tick labels that overlap with previous or next, always show first and last
  return function(sel: Selection<SVGTextElement, any, any, any>): void {
    const nodes = sel.nodes()
      .map((node, idx) => { return { node, bbox: node.getBoundingClientRect(), priority: priority(node, idx) }; });
    if (nodes.length <= 1) return;

    // group by priority
    const grouped = groups(nodes, node => node.priority)
      .sort((a, b) => b[0] - a[0]);
    grouped.forEach(group => group[1].sort((a, b) => a.bbox[direction] - b.bbox[direction]));

    const shownNodes: typeof nodes = [];

    grouped.forEach(([_, nodes]) => {
      nodes.forEach((elem) => {
        const { bbox } = elem;
        if (shownNodes.some(({ bbox: otherBbox }) => {
          // check overlap
          if (bbox.top - labelPadding > otherBbox.bottom) return false;
          if (bbox.bottom + labelPadding < otherBbox.top) return false;
          if (bbox.left - labelPadding > otherBbox.right) return false;
          if (bbox.right + labelPadding < otherBbox.left) return false;

          return true;
        })) return;

        shownNodes.push(elem);
      });
    });

    const shownNodeSet = new Set<SVGTextElement>(shownNodes.map(d => d.node));
    sel.attr('opacity', function(this: SVGTextElement) {
      return shownNodeSet.has(this) ? 1 : 0;
    });
  };
}
