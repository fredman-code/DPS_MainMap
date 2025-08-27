import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { adjustedMaps } from './data';

// ----------------------------------------------------------------
// Extract Map Data and Build Classroom List
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

// Build classroom list from corridors in "Primary GF"
const classrooms = primaryGF.corridors.reduce<
  { id: number; coords: any; name: string; corridorId: number }[]
>((acc, corridor) => {
  corridor.rooms.forEach((roomNumber) => {
    const point = primaryGF.points[roomNumber - 1]; // 1-based index
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
// Scaling Setup
// ----------------------------------------------------------------
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const widthRatio = screenWidth / mapData.originalWidth;
const heightRatio = screenHeight / mapData.originalHeight;
const baseScale = Math.min(widthRatio, heightRatio);

// Normalize function
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

const normalizedClassrooms = classrooms.map(({ id, coords, name, corridorId }) => ({
  id,
  name,
  corridorId,
  coords: normalize(coords),
}));

// ----------------------------------------------------------------
// Process Stairs Data
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
// Road Connections and Utility Functions
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
  [10, [13]],
  [11, [12]],
  [12, [11, 18]],
  [13, [10, 14]],
  [14, [13, 15, 18]],
  [15, [14, 16]],
  [16, [7, 15, 17]],
  [17, [16, 18]],
  [18, [12, 14, 17]],
]);

const getClosestPointIndex = (pointCoords: { x: number; y: number }): number => {
  let closestIndex = 0;
  let minDistance = Infinity;
  normalizedRoadPoints.forEach((point, index) => {
    const distance = Math.sqrt(
      Math.pow(point.x - pointCoords.x, 2) + Math.pow(point.y - pointCoords.y, 2)
    );
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
      const neighbors = roadConnections.get(lastNode + 1); // Keys are 1-indexed
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor - 1)) {
            queue.push([...path, neighbor - 1]);
          }
        }
      }
    }
  }
  return [];
};

// ----------------------------------------------------------------
// MapOverlay Component accepting endpoints as props
// ----------------------------------------------------------------
interface Endpoint {
  type: 'classroom' | 'stair';
  index: number | 'nearest';
}

interface MapOverlayProps {
  start: Endpoint;
  end: Endpoint;
}

// Helpers
const distanceBetween = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): number => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const findNearestStair = (reference: { x: number; y: number }) => {
  let nearest = stairsWithCorridor[0];
  let minDist = distanceBetween(nearest.coords, reference);
  stairsWithCorridor.forEach((stair) => {
    const dist = distanceBetween(stair.coords, reference);
    if (dist < minDist) {
      nearest = stair;
      minDist = dist;
    }
  });
  return nearest;
};

const computeEndpointData = (
  endpoint: Endpoint,
  reference?: { x: number; y: number }
): { coords: { x: number; y: number }; corridorId: number } => {
  if (endpoint.type === 'classroom') {
    return normalizedClassrooms[endpoint.index as number];
  } else if (endpoint.type === 'stair') {
    if (endpoint.index === 'nearest') {
      if (!reference) {
        throw new Error("Reference required for computing nearest staircase");
      }
      return findNearestStair(reference);
    } else {
      return stairsWithCorridor[endpoint.index as number];
    }
  }
  throw new Error('Invalid endpoint type');
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MapOverlay: React.FC<MapOverlayProps> = ({ start, end }) => {
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [directLine, setDirectLine] = useState<boolean>(false);
  const [computedStart, setComputedStart] = useState<{ coords: { x: number; y: number }; corridorId: number } | null>(null);
  const [computedEnd, setComputedEnd] = useState<{ coords: { x: number; y: number }; corridorId: number } | null>(null);
  const [pathData, setPathData] = useState<{ d: string; length: number } | null>(null);
  const dashOffset = useRef(new Animated.Value(0)).current;

  // Compute endpoints and valid path
  useEffect(() => {
    let startPoint: { coords: { x: number; y: number }; corridorId: number };
    let endPoint: { coords: { x: number; y: number }; corridorId: number };

    if (start.type === 'stair' && start.index === 'nearest') {
      if (end.type !== 'classroom') {
        throw new Error("Nearest stair option requires the other endpoint to be a classroom");
      }
      const classroom = computeEndpointData(end);
      startPoint = computeEndpointData(start, classroom.coords);
      endPoint = classroom;
    } else if (end.type === 'stair' && end.index === 'nearest') {
      if (start.type !== 'classroom') {
        throw new Error("Nearest stair option requires the other endpoint to be a classroom");
      }
      const classroom = computeEndpointData(start);
      endPoint = computeEndpointData(end, classroom.coords);
      startPoint = classroom;
    } else {
      startPoint = computeEndpointData(start);
      endPoint = computeEndpointData(end);
    }

    setComputedStart(startPoint);
    setComputedEnd(endPoint);

    if (startPoint.corridorId === endPoint.corridorId) {
      setDirectLine(true);
      setSelectedPath([]);
    } else {
      setDirectLine(false);
      const cp1 = getClosestPointIndex(startPoint.coords);
      const cp2 = getClosestPointIndex(endPoint.coords);
      const validPath = findValidPath(cp1, cp2);
      setSelectedPath(validPath);
    }
  }, [start, end]);

  // Build the path string and compute total length
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
        const segmentLength = Math.sqrt(
          Math.pow(points[i].x - points[i - 1].x, 2) +
          Math.pow(points[i].y - points[i - 1].y, 2)
        );
        totalLength += segmentLength;
      }
      setPathData({ d, length: totalLength });
    }
  }, [computedStart, computedEnd, selectedPath, directLine]);

  // Animate the drawing continuously in a loop using a recursive animation function.
  useEffect(() => {
    const animateLine = () => {
      if (pathData) {
        dashOffset.setValue(pathData.length);
        Animated.timing(dashOffset, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }).start(() => {
          // Restart the animation after a short delay (optional)
          animateLine();
        });
      }
    };
    animateLine();
  }, [pathData, dashOffset]);

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

export default MapOverlay;









