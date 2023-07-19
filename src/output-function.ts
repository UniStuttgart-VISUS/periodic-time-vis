import { Selection } from 'd3-selection';
import { circleMarker, ShapeGenerator } from './parametrized-shape';

export enum OutputType {
  Color,
  Shape,
  ColorAndShape,
};

export type ModifyFunction<T, U extends SVGElement> = (selection: Selection<U, T, any, any>) => void;


const _defaultShapeFunction: ShapeFunction = circleMarker();
const _defaultColorFunction: (_: any) => string = _ => `rebeccapurple`;
const _defaultColor: string = `rebeccapurple`;

export class OutputFunction extends EventTarget {
  protected outputType: OutputType = OutputType.Color;
  private _phase: number = 0;

  constructor(
    protected colorFunction: ColorFunction = _defaultColorFunction,
    protected colorFunctionName: string = _defaultColor,
    protected shapeFunction: ShapeFunction = _defaultShapeFunction,
  ) {
    super();

    this.resetOutputType();
  }

  trigger() {
    this.dispatchEvent(new CustomEvent('change'));
  }

  private resetOutputType() {
    if (this.shapeFunction !== _defaultShapeFunction) {
      if (this.colorFunction !== _defaultColorFunction) {
        this.outputType = OutputType.ColorAndShape;
      } else {
        this.outputType = OutputType.Shape;
      }
    } else {
      this.outputType = OutputType.Color;
    }
  }

  value(t: number): number {
    return ((t + this._phase) % 1 + 1) % 1;
  }

  invert(t: number): number {
    return ((t - this._phase) % 1 + 1) % 1;
  }

  set phase(p: number) {
    this._phase = p;
    this.trigger();
  }

  get phase(): number {
    return this._phase;
  }

  hasColor(): boolean {
    return this.outputType === OutputType.Color || this.outputType === OutputType.ColorAndShape;
  }

  hasShape(): boolean {
    return this.outputType === OutputType.Shape || this.outputType === OutputType.ColorAndShape;
  }

  get colorName(): string {
    return this.colorFunctionName;
  }

  color(t: number): string {
    return this.colorFunction(this.value(t));
  }

  draw(t: number, ctx: CanvasRenderingContext2D, size: number = 8) {
    this.shapeFunction.draw(ctx, t, size);
  }

  initializeContext(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = this.hasShape() ? 2 : 0;
  }

  resetColorFunction() {
    this.colorFunction = _defaultColorFunction;
    this.resetOutputType();
  }

  resetShapeFunction() {
    this.shapeFunction = _defaultShapeFunction;
    this.resetOutputType();
  }

  setColorFunction(colorFunction: ColorFunction, colorFunctionName: string): void {
    this.colorFunction = colorFunction;
    this.colorFunctionName = colorFunctionName;
    this.resetOutputType();
  }

  setShapeFunction(shapeFunction: ShapeFunction): void {
    this.shapeFunction = shapeFunction;
    this.resetOutputType();
  }
};

type ColorLike = string;
type ColorFunction = (value: number) => ColorLike;
type ShapeFunction = ShapeGenerator;

