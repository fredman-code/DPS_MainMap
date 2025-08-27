// Seniorgf.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, StyleSheet, Animated, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { adjustedMaps } from './data';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ----------------------------------------------------------------
// 1. Extract Map Data and Build Classroom List
// ----------------------------------------------------------------
const seniorGF = adjustedMaps.find((map) => map.name === 'Senior GF');
if (!seniorGF) {
  throw new Error('Senior GF map not found in adjustedMaps');
}

const mapData = {
  name: seniorGF.name,
  image: seniorGF.image,
  originalWidth: seniorGF.originalWidth,
  originalHeight: seniorGF.originalHeight,
};

// Build classroom list (using 1-indexed room numbers)
const classrooms = seniorGF.corridors.reduce<
  { id: number; coords: number[]; name: string; corridorId: number }[]
>((acc, corridor) => {
  corridor.rooms.forEach((roomNumber) => {
    const point = seniorGF.points[roomNumber - 1];
    if (point) {
      acc.push({
        id: roomNumber,
        coords: point,
        name: `Class ${roomNumber}`,
        corridorId: corridor.id,
      });
    }
  });
  return acc;
}, []);

// ----------------------------------------------------------------
// 2. Scaling Setup and Enhanced Normalize Function
// ----------------------------------------------------------------
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const widthRatio = screenWidth / mapData.originalWidth;
const heightRatio = screenHeight / mapData.originalHeight;
const baseScale = Math.min(widthRatio, heightRatio);

const normalize = (input: any): { x: number; y: number } => {
  if (Array.isArray(input)) {
    const [x, y] = input;
    return { x: x * baseScale, y: y * baseScale };
  } else if (input && typeof input === 'object') {
    if (Array.isArray(input.coords)) {
      const [x, y] = input.coords;
      return { x: x * baseScale, y: y * baseScale };
    }
    if (typeof input.x === 'number' && typeof input.y === 'number') {
      return { x: input.x * baseScale, y: input.y * baseScale };
    }
  }
  console.error('normalize: expected an array or object with coords or x,y but received', input);
  return { x: 0, y: 0 };
};

// ----------------------------------------------------------------
// 3. Road Points (Turning Points)
// ----------------------------------------------------------------
const roadPoints: number[][] = [
  [415, 814],
  [1251, 827],
  [1445, 818],
  [1995, 820],
  [2719, 816],
  [2713, 694],
  [2754, 628],
  [1273, 1240],
  [1267, 2015],
  [899, 2027],
  [895, 1929],
  [349, 1931],
];
const normalizedRoadPoints = roadPoints.map(normalize);

// Normalize classrooms.
const normalizedClassrooms = classrooms.map(({ id, coords, name, corridorId }) => ({
  id,
  name,
  corridorId,
  coords: normalize(coords),
}));

// ----------------------------------------------------------------
// 4. Process Stairs Data
// ----------------------------------------------------------------
const stairsWithCorridor = seniorGF.corridors.reduce(
  (acc, corridor) => {
    if (corridor.stairs && Array.isArray(corridor.stairs)) {
      corridor.stairs.forEach((stair) => {
        acc.push({ coords: normalize(stair), corridorId: corridor.id });
      });
    }
    return acc;
  },
  [] as { coords: { x: number; y: number }; corridorId: number }[]
);
if (stairsWithCorridor.length === 0 && seniorGF.stairs && Array.isArray(seniorGF.stairs)) {
  seniorGF.stairs.forEach((stair) => {
    stairsWithCorridor.push({ coords: normalize(stair), corridorId: 0 });
  });
}

// ----------------------------------------------------------------
// 5. Road Connections and BFS Utility Functions
// ----------------------------------------------------------------
const roadConnections = new Map<number, number[]>([
  [1, [2]],           // (1,2)
  [2, [1, 3, 8]],      // (1,2), (2,3), (2,8)
  [3, [2, 4]],         // (2,3), (4,3)
  [4, [3, 5]],         // (4,3), (4,5)
  [5, [4, 6]],         // (4,5), (5,6)
  [6, [5, 7]],         // (5,6), (6,7)
  [7, [6]],            // (6,7)
  [8, [2, 9]],         // (2,8), (9,8)
  [9, [8, 10]],        // (9,8), (10,9)
  [10, [9, 11]],       // (10,9), (11,10)
  [11, [10, 12]],      // (11,10), (12,11)
  [12, [11]],
]);
// Convert connections to 0-indexed.
const roadConnections0 = new Map<number, number[]>();
roadConnections.forEach((neighbors, key) => {
  roadConnections0.set(key - 1, neighbors.map((n) => n - 1));
});

const getClosestPointIndex = (pointCoords: { x: number; y: number }): number => {
  let closestIndex = 0;
  let minDistance = Infinity;
  normalizedRoadPoints.forEach((point, index) => {
    const distance = Math.hypot(point.x - pointCoords.x, point.y - pointCoords.y);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
};

const findValidPath = (start: number, end: number): number[] => {
  let queue: number[][] = [[start]];
  const visited = new Set<number>();
  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) continue;
    const lastNode = path[path.length - 1];
    if (lastNode === end) return path;
    if (!visited.has(lastNode)) {
      visited.add(lastNode);
      const neighbors = roadConnections0.get(lastNode);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push([...path, neighbor]);
          }
        }
      }
    }
  }
  return [];
};

// ----------------------------------------------------------------
// 6. Extend Endpoint Type and ComputedEndpoint
// ----------------------------------------------------------------
interface Endpoint {
  type: 'classroom' | 'stair' | 'exit';
  // For classrooms, index is the classroom id (1-indexed).
  // For stairs, index can be a number or 'nearest'.
  // For exit, index indicates the exit variant:
  //    1 = normal exit polyline,
  //    2 = reversed exit polyline.
  index: number | 'nearest';
}

interface MapOverlayProps {
  start: Endpoint;
  end: Endpoint;
  onNearestStairFound?: (stairIndex: number) => void;
}

type ComputedEndpoint =
  | { coords: { x: number; y: number }; corridorId: number; stairIndex?: number }
  | { polyline: { x: number; y: number }[] };

// ----------------------------------------------------------------
// 7. Endpoint Helper Functions
// ----------------------------------------------------------------
const distanceBetween = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): number => Math.hypot(a.x - b.x, a.y - b.y);

// Modified findNearestStair returns the nearest stair's data including its index.
const findNearestStair = (
  reference: { x: number; y: number }
): { coords: { x: number; y: number }; corridorId: number; stairIndex: number } => {
  let nearestIndex = 0;
  let minDist = distanceBetween(stairsWithCorridor[0].coords, reference);
  stairsWithCorridor.forEach((stair, i) => {
    const dist = distanceBetween(stair.coords, reference);
    if (dist < minDist) {
      minDist = dist;
      nearestIndex = i;
    }
  });
  return {
    coords: stairsWithCorridor[nearestIndex].coords,
    corridorId: stairsWithCorridor[nearestIndex].corridorId,
    stairIndex: nearestIndex,
  };
};

const computeEndpointData = (
  endpoint: Endpoint,
  reference?: { x: number; y: number }
): ComputedEndpoint => {
  if (endpoint.type === 'classroom') {
    const classroom = normalizedClassrooms.find((cls) => cls.id === endpoint.index);
    if (!classroom) {
      throw new Error(`Classroom with id ${endpoint.index} not found`);
    }
    return classroom;
  } else if (endpoint.type === 'stair') {
    if (endpoint.index === 'nearest') {
      if (!reference) {
        throw new Error("Reference required for computing nearest staircase");
      }
      return findNearestStair(reference);
    } else {
      return stairsWithCorridor[endpoint.index as number];
    }
  } else if (endpoint.type === 'exit') {
    const exitLine = [
      { x: 2720, y: 664 },
      { x: 2615, y: 658 },
      { x: 2597, y: 219 },
    ];
    let polyline;
    if (endpoint.index === 2) {
      polyline = exitLine.slice().reverse().map((pt) => normalize(pt));
    } else {
      polyline = exitLine.map((pt) => normalize(pt));
    }
    return { polyline };
  }
  throw new Error('Invalid endpoint type');
};

// Helper to extract the "connection point" for an endpoint.
// For classroom or stair endpoints, use their coords.
// For exit endpoints, if used as start, use the last point of the polyline;
// if used as end, use the first point.
const getConnectionPoint = (endpoint: ComputedEndpoint, isStart: boolean): { x: number; y: number } => {
  if ('coords' in endpoint) {
    return endpoint.coords;
  } else if ('polyline' in endpoint) {
    return isStart ? endpoint.polyline[endpoint.polyline.length - 1] : endpoint.polyline[0];
  }
  throw new Error("Invalid computed endpoint");
};

// ----------------------------------------------------------------
// 8. MapOverlay Component
// ----------------------------------------------------------------
const Seniorgf: React.FC<MapOverlayProps> = ({ start, end, onNearestStairFound }) => {
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [directLine, setDirectLine] = useState<boolean>(false);
  const [computedStart, setComputedStart] = useState<ComputedEndpoint | null>(null);
  const [computedEnd, setComputedEnd] = useState<ComputedEndpoint | null>(null);
  const [pathData, setPathData] = useState<{ d: string; length: number } | null>(null);
  const dashOffset = useRef(new Animated.Value(0)).current;

  // Compute endpoints and valid path.
  useEffect(() => {
    let startPoint: ComputedEndpoint;
    let endPoint: ComputedEndpoint;

    if (start.type === 'stair' && start.index === 'nearest') {
      if (end.type !== 'classroom') {
        throw new Error("Nearest stair option requires the other endpoint to be a classroom");
      }
      const classroom = computeEndpointData(end);
      startPoint = computeEndpointData(start, 'coords' in classroom ? classroom.coords : { x: 0, y: 0 })

      endPoint = classroom;
      if ('stairIndex' in startPoint && startPoint.stairIndex !== undefined && onNearestStairFound) {
        onNearestStairFound(startPoint.stairIndex);
      }
    } else if (end.type === 'stair' && end.index === 'nearest') {
      if (start.type !== 'classroom') {
        throw new Error("Nearest stair option requires the other endpoint to be a classroom");
      }
      const classroom = computeEndpointData(start);
      endPoint = computeEndpointData(start, 'coords' in classroom ? classroom.coords : { x: 0, y: 0 })
      startPoint = classroom;
      if ('stairIndex' in endPoint && endPoint.stairIndex !== undefined && onNearestStairFound) {
        onNearestStairFound(endPoint.stairIndex);
      }
    } else {
      startPoint = computeEndpointData(start);
      endPoint = computeEndpointData(end);
    }

    setComputedStart(startPoint);
    setComputedEnd(endPoint);

    if ('corridorId' in startPoint && 'corridorId' in endPoint && startPoint.corridorId === endPoint.corridorId) {
      setDirectLine(true);
      setSelectedPath([]);
    } else {
      setDirectLine(false);
      const sp = getConnectionPoint(startPoint, true);
      const ep = getConnectionPoint(endPoint, false);
      const cp1 = getClosestPointIndex(sp);
      const cp2 = getClosestPointIndex(ep);
      const validPath = findValidPath(cp1, cp2);
      if (validPath.length <= 1) {
        const startCorridor = seniorGF.corridors.find(c => 'corridorId' in startPoint ? c.id === startPoint.corridorId : false);
        const endCorridor = seniorGF.corridors.find(c => 'corridorId' in endPoint ? c.id === endPoint.corridorId : false);
        if (startCorridor && endCorridor) {
          const centerStart = {
            x: ((startCorridor.coords[0] + startCorridor.coords[2]) / 2) * baseScale,
            y: ((startCorridor.coords[1] + startCorridor.coords[3]) / 2) * baseScale,
          };
          const centerEnd = {
            x: ((endCorridor.coords[0] + endCorridor.coords[2]) / 2) * baseScale,
            y: ((endCorridor.coords[1] + endCorridor.coords[3]) / 2) * baseScale,
          };
          const turningPoint = {
            x: (centerStart.x + centerEnd.x) / 2,
            y: (centerStart.y + centerEnd.y) / 2,
          };
          const fallbackPath = [cp1, getClosestPointIndex(turningPoint), cp2];
          setSelectedPath(fallbackPath);
        } else {
          setSelectedPath([]);
          setDirectLine(true);
        }
      } else {
        setSelectedPath(validPath);
      }
    }
  }, [start, end, onNearestStairFound]);

  // Build the SVG path string.
  useEffect(() => {
    if (computedStart && computedEnd) {
      let points: { x: number; y: number }[] = [];
      if (directLine) {
        const sp = getConnectionPoint(computedStart, true);
        const ep = getConnectionPoint(computedEnd, false);
        points = [sp, ep];
      } else {
        let startPoints: { x: number; y: number }[] = 'polyline' in computedStart ? computedStart.polyline : [computedStart.coords];
        let endPoints: { x: number; y: number }[] = 'polyline' in computedEnd ? computedEnd.polyline : [computedEnd.coords];
        const midPoints = selectedPath.map((index) => normalizedRoadPoints[index]);
        points = [...startPoints, ...midPoints, ...endPoints];
      }
      let d = `M ${points[0].x} ${points[0].y}`;
      let totalLength = 0;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
        totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      setPathData({ d, length: totalLength });
    }
  }, [computedStart, computedEnd, selectedPath, directLine]);

  // Animate the path drawing.
  useEffect(() => {
    if (!pathData) return;
    dashOffset.setValue(pathData.length);
    const animation = Animated.timing(dashOffset, { toValue: 0, duration: (pathData.length/100)*1000, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [pathData]);

  return (
    <View style={styles.container}>
      <Image
        source={mapData.image}
        style={{
          width: mapData.originalWidth * baseScale,
          height: mapData.originalHeight * baseScale,
        }}
        resizeMode="contain"
      />
      {pathData && (
        <Svg
          width={mapData.originalWidth * baseScale}
          height={mapData.originalHeight * baseScale}
          style={styles.svgOverlay}
        >
          <AnimatedPath
            d={pathData.d}
            stroke="#333"
            strokeWidth={2}
            fill="none"
            strokeDasharray={pathData.length}
            strokeDashoffset={dashOffset}
          />
        </Svg>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  svgOverlay: { position: 'absolute', top: 0, left: 0 },
});

export default Seniorgf;


