// utils.ts
export const adjustClassToCorridor = (
  roomCoords: [number, number],
  corridorCoords: [number, number, number, number]
): [number, number] => {
  

  let [x1, y1, x2, y2] = corridorCoords; // Corridor bounding box
  let [roomX, roomY] = roomCoords;

  let newX = roomX;
  let newY = roomY;

  // If the room is inside the corridor, no adjustment is needed.
  if (roomX >= x1 && roomX <= x2 && roomY >= y1 && roomY <= y2) {
    return [roomX, roomY];
  }

  // If the room is within the corridor's X range, adjust Y to the corridor's vertical center.
  if (roomX >= x1 && roomX <= x2) {
    newY = (y1 + y2) / 2;
  }

  // If the room is within the corridor's Y range, adjust X to the corridor's horizontal center.
  if (roomY >= y1 && roomY <= y2) {
    newX = (x1 + x2) / 2;
  }

  return [newX, newY];
};


  