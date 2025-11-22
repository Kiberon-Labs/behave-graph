export function sleep(durationInSeconds: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.round(durationInSeconds * 1000))
  );
}
