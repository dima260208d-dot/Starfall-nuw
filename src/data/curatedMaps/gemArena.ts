export function gemArena(b: MapBuilder, style: number): void {
  placeGemCenter(b);
  // Декор только ВНЕ зоны 5×5 вокруг центра (|dx|,|dy| > 2).
  if (style === 0) {
    b.room(CX - 6, CY - 6, 5, 5, T.WALL, T.BUSH);
    b.room(CX + 2, CY + 2, 5, 5, T.WALL, T.BUSH);
    b.waterRect(CX - 1, CY - 6, 3, 2);
    b.waterRect(CX - 1, CY + 5, 3, 2);
  } else if (style === 1) {
    b.bushPatch(CX - 5, CY, 2);
    b.bushPatch(CX + 5, CY, 2);
    b.hline(CX - 6, CY - 5, 5, T.WALL);
    b.hline(CX + 2, CY + 5, 5, T.WALL);
  } else if (style === 2) {
    centerDonut(b, 6, 9);
  } else if (style === 3) {
    b.L(CX - 6, CY - 6, 4, 0, T.WALL);
    b.L(CX + 6, CY + 6, 4, 3, T.WALL);
    b.bushPatch(CX, CY - 4, 1);
    b.bushPatch(CX, CY + 4, 1);
  } else if (style === 4) {
    b.hline(CX - 6, CY - 5, 13, T.FENCE);
    b.hline(CX - 6, CY + 5, 13, T.FENCE);
    b.bushPatch(CX - 4, CY, 2);
    b.bushPatch(CX + 4, CY, 2);
  } else if (style === 5) {
    b.waterRect(CX - 5, CY - 1, 3, 3);
    b.waterRect(CX + 3, CY - 1, 3, 3);
  } else if (style === 6) {
    b.bushPatch(CX, CY - 4, 1);
    b.bushPatch(CX, CY + 4, 1);
    b.bushPatch(CX - 4, CY, 1);
    b.bushPatch(CX + 4, CY, 1);
  } else if (style === 7) {
    cornerFort(b, CX - 8, CY - 8, 0);
    cornerFort(b, CX + 8, CY + 8, 3);
  } else if (style === 8) {
    leftLaneWall(b, CY - 7, 10);
    leftLaneWall(b, CY + 7, 10);
  } else {
    b.cross(CX, CY, 5, T.SAND_WALL);
    b.set(CX, CY, T.GRASS);
    b.scatterBones(6, style * 7);
  }
}
