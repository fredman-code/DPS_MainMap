import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, StyleSheet, Animated, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { adjustedMaps } from './data';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ----------------------------------------------------------------
// 1. Extract Map Data and Build Classroom List
// ----------------------------------------------------------------
const primaryGF = adjustedMaps.find((map) => map.name === 'Primary GF');
if (!primaryGF) {
  throw new Error('Primary GF map not found in adjustedMaps');
}

const mapData = {
  name: primaryGF.name,
  image: primaryGF.image,
  originalWidth: primaryGF.originalWidth,
  originalHeight: primaryGF.originalHeight,
};

// Build classroom list from corridors (using 1-indexed room numbers)
const classrooms = primaryGF.corridors.reduce<
  { id: number; coords: number[]; name: string; corridorId: number }[]
>((acc, corridor) => {
  corridor.rooms.forEach((roomNumber) => {
    const point = primaryGF.points[roomNumber - 1];
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
  [249, 1009],
  [254, 1623],
  [636, 1622],
  [644, 1012],
  [646, 1205],
  [820, 1200],
  [910, 1303],
  [643, 1422],
  [844, 1417],
  [2256, 1009],
  [2251, 1617],
  [1866, 1613],
  [1869, 1018],
  [1862, 1185],
  [1678, 1206],
  [1605, 1304],
  [1661, 1412],
  [1852, 1421],
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
const stairsWithCorridor = primaryGF.corridors.reduce(
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
if (stairsWithCorridor.length === 0 && primaryGF.stairs && Array.isArray(primaryGF.stairs)) {
  primaryGF.stairs.forEach((stair) => {
    stairsWithCorridor.push({ coords: normalize(stair), corridorId: 0 });
  });
}

// ----------------------------------------------------------------
// 5. Road Connections and BFS Utility Functions
// ----------------------------------------------------------------
const roadConnections = new Map<number, number[]>([
  [1, [2, 4]],
  [2, [1, 3]],
  [3, [2, 8]],
  [4, [1, 5]],
  [5, [4, 6, 8]],
  [6, [5, 7]],
  [7, [6, 9, 16]],
  [8, [3, 5, 9]],
  [9, [7, 8]],
  [10, [13,11]],
  [11, [12,10]],
  [12, [11, 18]],
  [13, [10, 14]],
  [14, [13, 15, 18]],
  [15, [14, 16]],
  [16, [7, 15, 17]],
  [17, [16, 18]],
  [18, [12, 14, 17]],
]);
// Convert keys to 0-indexed.
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
  // For exit, index indicates the exit variant: 1 = normal, 2 = reversed.
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

const findNearestStair = (reference: { x: number; y: number }): { coords: { x: number; y: number }; corridorId: number; stairIndex: number } => {
  let nearestIndex = 0;
  let minDist = Infinity;
  stairsWithCorridor.forEach((stair, i) => {
    const dist = distanceBetween(stair.coords, reference);
    if (dist < minDist) {
      minDist = dist;
      nearestIndex = i;
    }
  });
  return { ...stairsWithCorridor[nearestIndex], stairIndex: nearestIndex };
};

const computeEndpointData = (
  endpoint: Endpoint,
  reference?: { x: number; y: number }
): ComputedEndpoint => {
  if (endpoint.type === 'classroom') {
    // Lookup classroom by matching its id (1-indexed)
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
      const nearestStair = findNearestStair(reference);
      console.log('Nearest Stair Index is:', nearestStair.stairIndex);
      return nearestStair;
    } else {
      return stairsWithCorridor[endpoint.index as number];
    }
  } else if (endpoint.type === 'exit') {
    // Define the exit polyline for Primary GF.
    // Use two points for the exit. For variant 2, reverse the order.
    const exitLine = [
      { x: 245, y: 885 },
      { x: 242, y: 538 },
    ];
    const polyline = (endpoint.index === 2)
      ? exitLine.slice().reverse().map(pt => normalize(pt))
      : exitLine.map(pt => normalize(pt));
    return { polyline };
  }
  throw new Error('Invalid endpoint type');
};

// Helper: Get connection point. For classroom/stair endpoints, return their coords.
// For exit endpoints, if used as start return the last point of the polyline; if used as end, return the first.
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
const Primarygf: React.FC<MapOverlayProps> = ({ start, end, onNearestStairFound }) => {
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
    } else if (end.type === 'stair' && end.index === 'nearest') {
      if (start.type !== 'classroom') {
        throw new Error("Nearest stair option requires the other endpoint to be a classroom");
      }
      const classroom = computeEndpointData(start);
      endPoint = computeEndpointData(start, 'coords' in classroom ? classroom.coords : { x: 0, y: 0 })

      startPoint = classroom;
    } else {
      startPoint = computeEndpointData(start);
      endPoint = computeEndpointData(end);
    }

    // If the computed stair has a stairIndex, call the callback.
    if (start.type === 'stair' && start.index === 'nearest' && 'stairIndex' in startPoint) {
      onNearestStairFound && onNearestStairFound(startPoint.stairIndex!);
    }
    if (end.type === 'stair' && end.index === 'nearest' && 'stairIndex' in endPoint) {
      onNearestStairFound && onNearestStairFound(endPoint.stairIndex!);
    }

    setComputedStart(startPoint);
    setComputedEnd(endPoint);

    // If both endpoints have corridorId and match, use direct connection.
    if (
      'corridorId' in startPoint &&
      'corridorId' in endPoint &&
      startPoint.corridorId === endPoint.corridorId
    ) {
      setDirectLine(true);
      setSelectedPath([]);
    } else {
      setDirectLine(false);
      const sp = 'coords' in startPoint ? startPoint.coords : (startPoint as any).polyline[0];
      const ep = 'coords' in endPoint ? endPoint.coords : (endPoint as any).polyline[0];
      const cp1 = getClosestPointIndex(sp);
      const cp2 = getClosestPointIndex(ep);
      const validPath = findValidPath(cp1, cp2);
      if (validPath.length <= 1) {
        const startCorridor = primaryGF.corridors.find(c => 'corridorId' in startPoint ? c.id === startPoint.corridorId : false);
        const endCorridor = primaryGF.corridors.find(c => 'corridorId' in endPoint ? c.id === endPoint.corridorId : false);
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
        const startPoints: { x: number; y: number }[] =
          'polyline' in computedStart ? computedStart.polyline : [computedStart.coords];
        const endPoints: { x: number; y: number }[] =
          'polyline' in computedEnd ? computedEnd.polyline : [computedEnd.coords];
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

export default Primarygf;



