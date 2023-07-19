import { range } from 'd3-array';

export interface ShapeGenerator {
  draw(ctx: CanvasRenderingContext2D, t: number, size: number): void;
};

export function circleMarker(): ShapeGenerator {
  return {
    draw(context: CanvasRenderingContext2D, _t: number, size: number) {
      const radius = size / 2;
      context.moveTo(0, -radius);
      context.arc(0, 0, radius, -Math.PI/2, Math.PI/2, false);
      context.arc(0, 0, radius, Math.PI/2, -Math.PI/2, false);
    },
  };
}

export function parametrizedMoonPhaseShape(): ShapeGenerator {
  return {
    draw(context: CanvasRenderingContext2D, t: number, size: number) {
      const radius = size / 2;

      // go around outside, and back -> no fill
      context.moveTo(0, -radius);
      context.arc(0, 0, radius, -Math.PI/2, Math.PI/2, false);
      context.arc(0, 0, radius, Math.PI/2, -Math.PI/2, false);
      context.arc(0, 0, radius, -Math.PI/2, Math.PI/2, true);
      context.arc(0, 0, radius, Math.PI/2, -Math.PI/2, true);

      // go through center in specified section -> moon shadow
      if (t < 0.25) {
        context.ellipse(0, 0, radius * (1 - 4 * t), radius, 0, Math.PI/2, -Math.PI/2, false);
        context.arc(0, 0, radius, -Math.PI/2, Math.PI/2, false);
      } else if (t < 0.5) {
        context.ellipse(0, 0, radius * (t - 0.25) * 4, radius, 0, -Math.PI/2, Math.PI/2, false);
        context.arc(0, 0, radius, Math.PI/2, -Math.PI/2, true);
      } else if (t < 0.75) {
        context.ellipse(0, 0, radius * (0.75 - t) * 4, radius, 0, -Math.PI/2, Math.PI/2, true);
        context.arc(0, 0, radius, Math.PI/2, -Math.PI/2, false);
      } else {
        context.ellipse(0, 0, radius * (t - 0.75) * 4, radius, 0, Math.PI/2, -Math.PI/2, true);
        context.arc(0, 0, radius, -Math.PI/2, Math.PI/2, true);
      }
    }
  };
};


export function parametrizedRectangleShape(aspectRatio: number = 8): ShapeGenerator {
  const aspect = (aspectRatio > 1) ? aspectRatio : 1 / aspectRatio;

  return {
    draw(context: CanvasRenderingContext2D, t: number, size: number) {
      const angle = Math.PI * t;
      const x = Math.cos(angle);
      const y = Math.sin(angle);
      const x2 = Math.cos(angle + Math.PI/2);
      const y2 = Math.sin(angle + Math.PI/2);

      const radius = size / 2;
      const short = radius / aspect;

      context.moveTo(
        x * radius + x2 * short,
        y * radius + y2 * short,
      );
      context.lineTo(
        x * radius - x2 * short,
        y * radius - y2 * short,
      );
      context.lineTo(
        -x * radius - x2 * short,
        -y * radius - y2 * short,
      );
      context.lineTo(
        -x * radius + x2 * short,
        -y * radius + y2 * short,
      );
      context.lineTo(
        x * radius + x2 * short,
        y * radius + y2 * short,
      );
    }
  };
}


export function parametrizedStarShape(numFaces: number = 0) {
  const pointFactor = 10;

  return {
    draw(context: CanvasRenderingContext2D, t: number, size: number) {
      const radius = size / 2;

      const outerRadius = radius;
      const deltaTheta = 2 * Math.PI / numFaces;
      const points: Array<[number, number]> = [];

      range(numFaces).forEach(face => {
        range(pointFactor).forEach(point => {
          const offset = (point - pointFactor/2) / pointFactor;
          const angle = (face + offset) * deltaTheta;
          const outerX = Math.cos(angle) * outerRadius;
          const outerY = Math.sin(angle) * outerRadius;

          const pointOnArm = 1 - Math.abs(2 * offset);

          const innerX = Math.cos(face * deltaTheta) * pointOnArm * radius;
          const innerY = Math.sin(face * deltaTheta) * pointOnArm * radius;

          const x = t * outerX + (1-t) * innerX;
          const y = t * outerY + (1-t) * innerY;

          points.push([x, y]);
        });
      });

      const [firstPoint, ...rest] = points;
      context.moveTo(firstPoint[0], firstPoint[1]);
      rest.forEach(([x, y]) => context.lineTo(x, y));
      context.lineTo(firstPoint[0], firstPoint[1]);
    }
  };

}


export function parametrizedDropShape() {
  return {
    draw(context: CanvasRenderingContext2D, t: number, size: number) {
      const radius = size / 2;
      const innerRadius = radius * 0.5;
      const angle = 2 * Math.PI * t;

      // point
      context.moveTo(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
      context.lineTo(
        Math.cos(angle + Math.PI/4) * innerRadius,
        Math.sin(angle + Math.PI/4) * innerRadius,
      );
      context.arc(0, 0, innerRadius, angle + Math.PI/4, angle - Math.PI/4, false);
      context.lineTo(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    }
  };

}
