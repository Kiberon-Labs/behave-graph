import { AdaptiveBlur } from './adaptiveBlur';
import { AdaptiveResize } from './adaptiveResize';
import { AdaptiveSharpen } from './adaptiveSharpen';
import { AdaptiveThreshold } from './adaptiveThreshold';
import { AddNoise } from './noise';
import { Alpha } from './alpha';
import { AutoGamma } from './autoGamma';
import { AutoLevel } from './autoLevel';
import { AutoOrient } from './autoOrient';
import { AutoThreshold } from './autoThreshold';
import { BilateralBlur } from './bilateralBlur';
import { BlackThreshold } from './blackThreshold';
import { Blur } from './blur';
import { Border } from './border';
import { BlueShift } from './blueShift';
import { BrightnessContrast } from './brightnessContrast';
import { CannyEdge } from './cannyEdge';
import { Charcoal } from './charcoal';
import { Chop } from './chop';
import { Clahe } from './clahe';
import { Clut } from './clut';
import { ColorAlpha } from './colorAlpha';
import { Compose } from './compose';
import { Contrast } from './contrast';
import { ContrastStretch } from './contrastStretch';
import { Convert } from './convert';
import { Crop } from './crop';
import { Deskew } from './deskew';
import { Distort } from './distort';
import { Evaluate } from './evaluate';
import { Extent } from './extent';
import { FetchImage } from './fetch';
import { Flip } from './flip';
import { Flop } from './flop';
import { FloodFill } from './floodFill';
import { Gamma } from './gamma';
import { GaussianBlur } from './gaussianBlur';
import { Grayscale } from './grayscale';
import { ImageProperties } from './properties';
import { InverseSigmoidalContrast } from './inverseSigmoidalContrast';
import { Level } from './level';
import { LinearStretch } from './linearStretch';
import { LiquidRescale } from './liquidRescale';
import { Modulate } from './modulate';
import { MotionBlur } from './motionBlur';
import { Negate } from './negate';
import { NegateGrayscale } from './negateGrayscale';
import { Normalize } from './normalize';
import { Oilpaint } from './oilpaint';
import { Opaque } from './opaque';
import { OutputImage } from './output';
import { ImagePreview } from './preview';
import { Quantize } from './quantize';
import { Resize } from './resize';
import { Roll } from './roll';
import { Rotate } from './rotate';
import { Sepia } from './sepia';
import { Sharpen } from './sharpen';
import { Shave } from './shave';
// Note: no image/shadow node , magick-wasm 0.0.37 declares `shadow()` in its
// types but does not implement it at runtime.
import { SigmoidalContrast } from './sigmoidalContrast';
import { Solarize } from './solarize';
import { SolidColorImage } from './solidColor';
import { Splice } from './splice';
import { Strip } from './strip';
import { Threshold } from './threshold';
import { Thumbnail } from './thumbnail';
import { Transparent } from './transparent';
import { Trim } from './trim';
import { Vignette } from './vignette';
import { Wave } from './wave';
import { WhiteThreshold } from './whiteThreshold';

export const nodes = {
  // Sources
  [SolidColorImage.typeName]: SolidColorImage,
  [FetchImage.typeName]: FetchImage,
  // Output / inspection
  [OutputImage.typeName]: OutputImage,
  [ImagePreview.typeName]: ImagePreview,
  [ImageProperties.typeName]: ImageProperties,
  // Geometry / transform
  [Resize.typeName]: Resize,
  [AdaptiveResize.typeName]: AdaptiveResize,
  [LiquidRescale.typeName]: LiquidRescale,
  [Crop.typeName]: Crop,
  [Chop.typeName]: Chop,
  [Splice.typeName]: Splice,
  [Shave.typeName]: Shave,
  [Rotate.typeName]: Rotate,
  [Roll.typeName]: Roll,
  [Deskew.typeName]: Deskew,
  [AutoOrient.typeName]: AutoOrient,
  [Thumbnail.typeName]: Thumbnail,
  [Trim.typeName]: Trim,
  [Extent.typeName]: Extent,
  [Border.typeName]: Border,
  [Flip.typeName]: Flip,
  [Flop.typeName]: Flop,
  // Color / tone
  [Grayscale.typeName]: Grayscale,
  [Negate.typeName]: Negate,
  [NegateGrayscale.typeName]: NegateGrayscale,
  [Sepia.typeName]: Sepia,
  [Solarize.typeName]: Solarize,
  [BrightnessContrast.typeName]: BrightnessContrast,
  [Contrast.typeName]: Contrast,
  [ContrastStretch.typeName]: ContrastStretch,
  [LinearStretch.typeName]: LinearStretch,
  [Modulate.typeName]: Modulate,
  [Level.typeName]: Level,
  [Gamma.typeName]: Gamma,
  [Normalize.typeName]: Normalize,
  [AutoLevel.typeName]: AutoLevel,
  [AutoGamma.typeName]: AutoGamma,
  [Clahe.typeName]: Clahe,
  [SigmoidalContrast.typeName]: SigmoidalContrast,
  [InverseSigmoidalContrast.typeName]: InverseSigmoidalContrast,
  [Threshold.typeName]: Threshold,
  [AutoThreshold.typeName]: AutoThreshold,
  [AdaptiveThreshold.typeName]: AdaptiveThreshold,
  [BlackThreshold.typeName]: BlackThreshold,
  [WhiteThreshold.typeName]: WhiteThreshold,
  [BlueShift.typeName]: BlueShift,
  [Evaluate.typeName]: Evaluate,
  // Alpha / color replacement
  [Alpha.typeName]: Alpha,
  [ColorAlpha.typeName]: ColorAlpha,
  [Opaque.typeName]: Opaque,
  [Transparent.typeName]: Transparent,
  [FloodFill.typeName]: FloodFill,
  // Blur / sharpen / artistic effects
  [Blur.typeName]: Blur,
  [GaussianBlur.typeName]: GaussianBlur,
  [AdaptiveBlur.typeName]: AdaptiveBlur,
  [MotionBlur.typeName]: MotionBlur,
  [BilateralBlur.typeName]: BilateralBlur,
  [Sharpen.typeName]: Sharpen,
  [AdaptiveSharpen.typeName]: AdaptiveSharpen,
  [Oilpaint.typeName]: Oilpaint,
  [Charcoal.typeName]: Charcoal,
  [Vignette.typeName]: Vignette,
  [CannyEdge.typeName]: CannyEdge,
  [Wave.typeName]: Wave,
  [Distort.typeName]: Distort,
  [AddNoise.typeName]: AddNoise,
  // Compositing / format / metadata
  [Compose.typeName]: Compose,
  [Clut.typeName]: Clut,
  [Quantize.typeName]: Quantize,
  [Strip.typeName]: Strip,
  [Convert.typeName]: Convert
};
