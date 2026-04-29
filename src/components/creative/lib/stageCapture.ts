import type Konva from 'konva';

/**
 * Runs a callback while temporarily forcing the stage to identity transform
 * (scale=1, position=0) so capture operations (toDataURL/thumbnail) always
 * see the full creative regardless of the user's current zoom/pan state.
 *
 * Restores the previous transform on completion (including in error paths).
 */
export async function withIdentityViewport<T>(
  stage: Konva.Stage,
  fn: () => T | Promise<T>
): Promise<T> {
  const prevScale = { x: stage.scaleX(), y: stage.scaleY() };
  const prevPos = { x: stage.x(), y: stage.y() };
  const isIdentity =
    prevScale.x === 1 && prevScale.y === 1 && prevPos.x === 0 && prevPos.y === 0;

  if (!isIdentity) {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
  }

  try {
    return await fn();
  } finally {
    if (!isIdentity) {
      stage.scale(prevScale);
      stage.position(prevPos);
      stage.batchDraw();
    }
  }
}
