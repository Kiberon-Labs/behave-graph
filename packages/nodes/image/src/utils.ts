export const cloneImage = (image: Uint8Array): Uint8Array => {
  const dst = new ArrayBuffer(image.byteLength);
  const final = new Uint8Array(dst);
  final.set(new Uint8Array(image));
  return final;
};
