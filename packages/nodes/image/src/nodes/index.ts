import { AdaptiveBlur } from './adaptiveBlur';
import { AddNoise } from './noise';
import { AutoGamma } from './autoGamma';
import { AutoLevel } from './autoLevel';
import { Blur } from './blur';
import { Border } from './border';
import { BlueShift } from './blueShift';
import { BrightnessContrast } from './brightnessContrast';
import { CannyEdge } from './cannyEdge';
import { Charcoal } from './charcoal';
import { Compose } from './compose';
import { Convert } from './convert';
import { Crop } from './crop';
import { Extent } from './extent';
import { FetchImage } from './fetch';
import { Flip } from './flip';
import { Gamma } from './gamma';
import { GaussianBlur } from './gaussianBlur';
import { Grayscale } from './grayscale';
import { ImageProperties } from './properties';
import { Level } from './level';
import { Modulate } from './modulate';
import { MotionBlur } from './motionBlur';
import { Negate } from './negate';
import { Normalize } from './normalize';
import { Oilpaint } from './oilpaint';
import { OutputImage } from './output';
import { Resize } from './resize';
import { Rotate } from './rotate';
import { Sepia } from './sepia';
import { Sharpen } from './sharpen';
import { SigmoidalContrast } from './sigmoidalContrast';
import { Solarize } from './solarize';
import { SolidColorImage } from './solidColor';
import { Threshold } from './threshold';
import { Thumbnail } from './thumbnail';
import { Trim } from './trim';
import { Vignette } from './vignette';
import { Wave } from './wave';

export const nodes = {
  // Sources
  [SolidColorImage.typeName]: SolidColorImage,
  [FetchImage.typeName]: FetchImage,
  // Output / inspection
  [OutputImage.typeName]: OutputImage,
  [ImageProperties.typeName]: ImageProperties,
  // Geometry / transform
  [Resize.typeName]: Resize,
  [Crop.typeName]: Crop,
  [Rotate.typeName]: Rotate,
  [Thumbnail.typeName]: Thumbnail,
  [Trim.typeName]: Trim,
  [Extent.typeName]: Extent,
  [Border.typeName]: Border,
  [Flip.typeName]: Flip,
  // Color / tone
  [Grayscale.typeName]: Grayscale,
  [Negate.typeName]: Negate,
  [Sepia.typeName]: Sepia,
  [Solarize.typeName]: Solarize,
  [BrightnessContrast.typeName]: BrightnessContrast,
  [Modulate.typeName]: Modulate,
  [Level.typeName]: Level,
  [Gamma.typeName]: Gamma,
  [Normalize.typeName]: Normalize,
  [AutoLevel.typeName]: AutoLevel,
  [AutoGamma.typeName]: AutoGamma,
  [SigmoidalContrast.typeName]: SigmoidalContrast,
  [Threshold.typeName]: Threshold,
  [BlueShift.typeName]: BlueShift,
  // Blur / sharpen / artistic effects
  [Blur.typeName]: Blur,
  [GaussianBlur.typeName]: GaussianBlur,
  [AdaptiveBlur.typeName]: AdaptiveBlur,
  [MotionBlur.typeName]: MotionBlur,
  [Sharpen.typeName]: Sharpen,
  [Oilpaint.typeName]: Oilpaint,
  [Charcoal.typeName]: Charcoal,
  [Vignette.typeName]: Vignette,
  [CannyEdge.typeName]: CannyEdge,
  [Wave.typeName]: Wave,
  [AddNoise.typeName]: AddNoise,
  // Compositing / format
  [Compose.typeName]: Compose,
  [Convert.typeName]: Convert
};
