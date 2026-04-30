import type Konva from 'konva';

/**
 * Wait until every Konva.Image node in the stage has a fully-loaded HTMLImageElement.
 *
 * `useImage` resolves async — exporting before images settle silently rasterizes
 * blank squares. Walk the stage, collect any not-yet-complete <img> elements,
 * and await their `load`/`error` events (errors resolve too: skip-but-don't-hang).
 */
export function waitForStageImages(stage: Konva.Stage, timeoutMs = 5000): Promise<void> {
  const pending: HTMLImageElement[] = [];
  stage.find('Image').forEach((node) => {
    const img = (node as unknown as { image(): HTMLImageElement | undefined }).image();
    if (img && !img.complete) pending.push(img);
  });
  if (!pending.length) return Promise.resolve();

  const settled = pending.map(
    (img) =>
      new Promise<void>((resolve) => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      })
  );
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([Promise.all(settled).then(() => undefined), timeout]);
}
