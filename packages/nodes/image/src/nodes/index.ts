import { Blur } from './blur';
import { CannyEdge } from './cannyEdge';
import { Compose } from './compose';
import { FetchImage } from './fetch';
import { Flip } from './flip';
import { Grayscale } from './grayscale';
import { Negate } from './negate';
import { Oilpaint } from './oilpaint';
import { OutputImage } from './output';
import { Sepia } from './sepia';
import { Solarize } from './solarize';
import { SolidColorImage } from './solidColor';
import { Vignette } from './vignette';

export const nodes = {
  [Oilpaint.typeName]: Oilpaint,
  [SolidColorImage.typeName]: SolidColorImage,
  [OutputImage.typeName]: OutputImage,
  [FetchImage.typeName]: FetchImage,
  [Blur.typeName]: Blur,
  [Flip.typeName]: Flip,
  [Grayscale.typeName]: Grayscale,
  [Negate.typeName]: Negate,
  [Sepia.typeName]: Sepia,
  [Solarize.typeName]: Solarize,
  [Compose.typeName]: Compose,
  [Vignette.typeName]: Vignette,
  [CannyEdge.typeName]: CannyEdge
};
