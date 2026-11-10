export interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function labelBox(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
): LabelBox {
  const halfWidth =
    (Math.abs(Math.cos(rotation)) * width + Math.abs(Math.sin(rotation)) * height) / 2 + 2;
  const halfHeight =
    (Math.abs(Math.sin(rotation)) * width + Math.abs(Math.cos(rotation)) * height) / 2 + 2;
  return { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
}

export function labelFits(
  box: LabelBox,
  occupied: LabelBox[],
  width: number,
  height: number,
): boolean {
  return (
    box.left >= 0 &&
    box.top >= 0 &&
    box.right <= width &&
    box.bottom <= height &&
    !occupied.some(
      (other) =>
        box.left < other.right + 2 &&
        box.right > other.left - 2 &&
        box.top < other.bottom + 2 &&
        box.bottom > other.top - 2,
    )
  );
}
