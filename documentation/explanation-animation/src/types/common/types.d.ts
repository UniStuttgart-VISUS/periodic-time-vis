interface StepProperties {
  lines: Array<Properties>;
  circles: Array<Properties>;
  rectangles: Array<Properties>;
  paths: Array<Properties>;
  texts: Array<Properties>;
}

interface GeneralProperties {
  id: string;

  // transition
  transitionDelay?: number;
  transitionDuration?: number;

  // z-index
  layer?: number;
  withinLayerOrdering?: number;
}

type Properties = GeneralProperties & {
  [key: string]: string | number | null | undefined;
}


type StepGenerator = AsyncGenerator<StepProperties, void, void>;

