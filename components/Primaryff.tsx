import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, StyleSheet, Animated, Alert } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { adjustedMaps } from './data';
import { adjustClassToCorridor } from './utils';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ----------------------------------------------------------------
// 1. Extract Map Data and Build Classroom List
// ----------------------------------------------------------------
const primaryFF = adjustedMaps.find((map) => map.name === 'Primary FF');
if (!primaryFF) {
  throw new Error('Primary FF map not found in adjustedMaps');
}

const mapData = {
  name: primaryFF.name,
  image: primaryFF.image,
  originalWidth: primaryFF.originalWidth,
  originalHeight: primaryFF.originalHeight,
};

// Build classroom list from corridors (using 1-indexed room numbers)
const classrooms = primaryFF.corridors.reduce(
  (acc: { id: number; coords: number[]; name: string; corridorId: number }[], corridor) => {
    corridor.rooms.forEach((roomNumber) => {
      const point = primaryFF.points[roomNumber - 1];
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
  },
  []
);

// ----------------------------------------------------------------
// 2. Scaling Setup and Enhanced Normalize Function
// ----------------------------------------------------------------
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const widthRatio = screenWidth / mapData.originalWidth;
const heightRatio = screenHeight / mapData.originalHeight;
const baseScale = Math.min(widthRatio, heightRatio);

const normalize = (input: any): { x: number; y: number } => {
  let coords;
  if (Array.isArray(input)) {
    coords = input;
  } else if (input && typeof input === 'object' && Array.isArray(input.coords)) {
    coords = input.coords;
  } else {
    console.error('normalize: expected an array or object with coords but received', input);
    return { x: 0, y: 0 };
  }
  const [x, y] = coords;
  return { x: x * baseScale, y: y * baseScale };
};

// ----------------------------------------------------------------
// 3. Road Points (Turning Points)
// ----------------------------------------------------------------
const roadPoints: number[][] = [
  [216, 971],
  [599, 970],
  [214, 1593],
  [606, 1600],
  [1826, 972],
  [2213, 970],
  [2213, 1593],
  [1826, 1600],
  [874, 1276],
  [1530, 1281],
  [604, 1176],
  [804, 1173],
  [614, 1399],
  [810, 1386],
  [1817, 1168],
  [1814, 1394],
  [1635, 1394],
  [1633, 1175],
];
const normalizedRoadPoints = roadPoints.map(normalize);

const normalizedClassrooms = classrooms.map(({ id, coords, name, corridorId }) => ({
  id,
  name,
  corridorId,
  coords: normalize(coords),
}));

// ----------------------------------------------------------------
// 4. Process Stairs Data
// ----------------------------------------------------------------
const stairsWithCorridor = primaryFF.corridors.reduce(
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
if (stairsWithCorridor.length === 0 && primaryFF.stairs && Array.isArray(primaryFF.stairs)) {
  primaryFF.stairs.forEach((stair) => {
    stairsWithCorridor.push({ coords: normalize(stair), corridorId: 0 });
  });
}

// ----------------------------------------------------------------
// 5. Road Connections and BFS Utility Functions
// ----------------------------------------------------------------
const roadConnections = new Map<number, number[]>([
  [1, [2, 3]],
  [2, [1, 4, 11]],
  [3, [1, 4]],
  [4, [2, 3, 13]],
  [5, [6, 15]],
  [6, [5, 7]],
  [7, [6, 8]],
  [8, [7, 16]],
  [9, [10, 12, 14]],
  [10, [9, 17, 18]],
  [11, [2, 12, 13]],
  [12, [9, 11]],
  [13, [4, 11, 14]],
  [14, [9, 13]],
  [15, [5, 16, 18]],
  [16, [8, 15, 17]],
  [17, [10, 16]],
  [18, [10, 15]],
]);
// Convert to 0-indexed.
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
  let visited = new Set<number>();
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
  type: 'classroom' | 'stair';
  // For classrooms, endpoint.index is the actual classroom id (1-indexed)
  index: number | 'nearest';
}

interface MapOverlayProps {
  start: Endpoint;
  end: Endpoint;
  onNearestStairFound?: (stairIndex: number) => void;
}

// We extend the return type for a computed endpoint to optionally include a stairIndex.
type ComputedEndpoint = {
  coords: { x: number; y: number };
  corridorId: number;
  stairIndex?: number;
};

// ----------------------------------------------------------------
// 7. Endpoint Helper Functions
// ----------------------------------------------------------------
const distanceBetween = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): number => Math.hypot(a.x - b.x, a.y - b.y);

// Modified findNearestStair returns the nearest stair's data including its index.
const findNearestStair = (reference: { x: number; y: number }): ComputedEndpoint => {
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
      // If a callback is provided, pass the stair index.
      return nearestStair;
    } else {
      return stairsWithCorridor[endpoint.index as number];
    }
  }
  throw new Error('Invalid endpoint type');
};

// Helper: Extract connection point for an endpoint.
// For classrooms or stairs, use their coords.
const getConnectionPoint = (endpoint: ComputedEndpoint, isStart: boolean): { x: number; y: number } => {
  return endpoint.coords;
};

// ----------------------------------------------------------------
// 8. MapOverlay Component
// ----------------------------------------------------------------
const Primaryff: React.FC<MapOverlayProps> = ({ start, end, onNearestStairFound }) => {
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
      startPoint = computeEndpointData(start, classroom.coords);
      endPoint = classroom;
      // If a nearest stair callback is provided, call it.
      if (startPoint.stairIndex !== undefined && onNearestStairFound) {
        onNearestStairFound(startPoint.stairIndex);
      }
    } else if (end.type === 'stair' && end.index === 'nearest') {
      if (start.type !== 'classroom') {
        throw new Error("Nearest stair option requires the other endpoint to be a classroom");
      }
      const classroom = computeEndpointData(start);
      endPoint = computeEndpointData(end, classroom.coords);
      startPoint = classroom;
      if (endPoint.stairIndex !== undefined && onNearestStairFound) {
        onNearestStairFound(endPoint.stairIndex);
      }
    } else {
      startPoint = computeEndpointData(start);
      endPoint = computeEndpointData(end);
    }

    setComputedStart(startPoint);
    setComputedEnd(endPoint);

    // If endpoints are in the same corridor, draw a direct connection.
    if (startPoint.corridorId === endPoint.corridorId) {
      setDirectLine(true);
      setSelectedPath([]);
    } else {
      setDirectLine(false);
      const cp1 = getClosestPointIndex(startPoint.coords);
      const cp2 = getClosestPointIndex(endPoint.coords);
      const validPath = findValidPath(cp1, cp2);
      // Fallback: if BFS returns too-short path, use corridor centers as turning point.
      if (validPath.length <= 1) {
        const startCorridor = primaryFF.corridors.find(c => c.id === startPoint.corridorId);
        const endCorridor = primaryFF.corridors.find(c => c.id === endPoint.corridorId);
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

  // Build the SVG path string and compute total length.
  useEffect(() => {
    if (computedStart && computedEnd) {
      let points: { x: number; y: number }[] = [];
      if (directLine) {
        points = [computedStart.coords, computedEnd.coords];
      } else {
        points = [
          computedStart.coords,
          ...selectedPath.map((index) => normalizedRoadPoints[index]),
          computedEnd.coords,
        ];
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

export default Primaryff;
