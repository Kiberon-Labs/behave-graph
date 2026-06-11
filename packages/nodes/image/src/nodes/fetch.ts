import { MagickFormat } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';

async function loadImageAsBuffer(url: string) {
  // Fetch the image
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  //Attempt to lookup the format from the response data
  const format = (response.headers.get('content-type') ?? '').split('/');
  const formatStr = format.length === 2 ? format[1].toUpperCase() : 'UNKNOWN';
  let detectedFormat: MagickFormat = MagickFormat.Unknown;

  if (MagickFormat[formatStr as keyof typeof MagickFormat]) {
    detectedFormat = MagickFormat[formatStr as keyof typeof MagickFormat];
  }

  return {
    data,
    settings: {
      format: detectedFormat
    }
  };
}

export const FetchImage = makePureInOutFunctionDesc({
  typeName: 'image/fetch',
  label: 'Image: Fetch',
  in: {
    url: {
      valueType: 'string',
      defaultValue: undefined,
      label: 'url'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const url = read<string>('url');

    const result = await loadImageAsBuffer(url);
    write('image', result.data);
  }
});
