// Seniorff.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { adjustedMaps } from './data';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ----------------------------------------------------------------
// 1. Extract Map Data and Build Classroom List
// ----------------------------------------------------------------
const seniorFF = adjustedMaps.find((map) => map.name === 'Senior FF');
if (!seniorFF) {
  throw new Error('Senior FF map not found in adjustedMaps');
}

const mapData = {
  name: seniorFF.name,
  image: seniorFF.image,
  originalWidth: seniorFF.originalWidth,
  originalHeight: seniorFF.originalHeight,
};

const classrooms = seniorFF.corridors.reduce(
  (acc, corridor) => {
    corridor.rooms.forEach((roomNumber) => {
      const point = seniorFF.points[roomNumber - 1];
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
  }, [] as { id: number; coords: number[]; name: string; corridorId: number }[]
);

// ----------------------------------------------------------------
// 2. Scaling Setup and Normalize Function
// ----------------------------------------------------------------
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const widthRatio = screenWidth / mapData.originalWidth;
const heightRatio = screenHeight / mapData.originalHeight;
const baseScale = Math.min(widthRatio, heightRatio);

const normalize = (input: any): { x: number; y: number } => {
  let coords: number[];
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
// 3. Road Points and Classrooms Normalized
// ----------------------------------------------------------------
const roadPoints = [
  [992, 606], [2211, 597], [1000, 970], [230, 1606], [676, 1601],
  [290, 597], [2218, 478], [2261, 434], [1002, 1677], [688, 1677],
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
const stairsWithCorridor = seniorFF.corridors.reduce(
  (acc, corridor) => {
    if (corridor.stairs && Array.isArray(corridor.stairs)) {
      corridor.stairs.forEach((stair) => {
        acc.push({ coords: normalize(stair), corridorId: corridor.id });
      });
    }
    return acc;
  }, [] as { coords: { x: number; y: number }; corridorId: number }[]
);
if (stairsWithCorridor.length === 0 && Array.isArray(seniorFF.stairs)) {
  seniorFF.stairs.forEach((stair) => {
    stairsWithCorridor.push({ coords: normalize(stair), corridorId: 0 });
  });
}

// ----------------------------------------------------------------
// 5. Road Connections and BFS Pathfinding
// ----------------------------------------------------------------
const roadConnections = new Map(
  [
    [1, [2, 3]], [2, [1, 7]], [3, [1, 9]],
    [4, [5]], [5, [4, 10]], [7, [2, 8]],
    [8, [7]], [9, [3, 10]], [10, [5, 9]],
  ] as [number, number[]][]
);
const roadConnections0 = new Map<number, number[]>();
roadConnections.forEach((neighbors, key) => {
  roadConnections0.set(key - 1, neighbors.map((n) => n - 1));
});

const getClosestPointIndex = (pointCoords: { x: number; y: number }): number => {
  let closestIndex = 0;
  let minDist = Infinity;
  normalizedRoadPoints.forEach((pt, idx) => {
    const d = Math.hypot(pt.x - pointCoords.x, pt.y - pointCoords.y);
    if (d < minDist) {
      minDist = d;
      closestIndex = idx;
    }
  });
  return closestIndex;
};

const findValidPath = (start: number, end: number): number[] => {
  const queue: number[][] = [[start]];
  const visited = new Set<number>();
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (last === end) return path;
    if (!visited.has(last)) {
      visited.add(last);
      (roadConnections0.get(last) || []).forEach((nbr) => {
        if (!visited.has(nbr)) queue.push([...path, nbr]);
      });
    }
  }
  return [];
};

// ----------------------------------------------------------------
// 6. Endpoint Types & Helpers
// ----------------------------------------------------------------
interface Endpoint { type: 'classroom' | 'stair'; index: number | 'nearest'; }
interface ComputedEndpoint { coords: { x: number; y: number }; corridorId: number; stairIndex?: number; }
const findNearestStair = (ref: { x: number; y: number }): ComputedEndpoint => {
  let idx = 0; let minD = Math.hypot(ref.x - stairsWithCorridor[0].coords.x, ref.y - stairsWithCorridor[0].coords.y);
  stairsWithCorridor.forEach((st, i) => {
    const d = Math.hypot(ref.x - st.coords.x, ref.y - st.coords.y);
    if (d < minD) { minD = d; idx = i; }
  });
  return { coords: stairsWithCorridor[idx].coords, corridorId: stairsWithCorridor[idx].corridorId, stairIndex: idx };
};
const computeEndpointData = (ep: Endpoint, ref?: { x: number; y: number }): ComputedEndpoint => {
  if (ep.type === 'classroom') {
    const cls = normalizedClassrooms.find((c) => c.id === ep.index);
    if (!cls) throw new Error(`Classroom ${ep.index} not found`);
    return cls;
  }
  if (ep.index === 'nearest') {
    if (!ref) throw new Error('Reference coords needed for nearest stair');
    return findNearestStair(ref);
  }
  return stairsWithCorridor[ep.index as number];
};

// ----------------------------------------------------------------
// 7. Seniorff Component
// ----------------------------------------------------------------
const Seniorff: React.FC<{ start: Endpoint; end: Endpoint; onNearestStairFound?: (i: number) => void; }> = ({ start, end, onNearestStairFound }) => {
  const dashOffset = useRef(new Animated.Value(0)).current;
  const [pathData, setPathData] = useState<{ d: string; length: number } | null>(null);
  const [directLine, setDirectLine] = useState(false);
  const [selPath, setSelPath] = useState<number[]>([]);
  const [cs, setCs] = useState<ComputedEndpoint | null>(null);
  const [ce, setCe] = useState<ComputedEndpoint | null>(null);

  useEffect(() => {
    let sp: ComputedEndpoint, ep: ComputedEndpoint;
    if (start.type === 'stair' && start.index === 'nearest') {
      const cl = computeEndpointData(end);
      sp = computeEndpointData(start, cl.coords);
      ep = cl;
      sp.stairIndex !== undefined && onNearestStairFound?.(sp.stairIndex);
    } else if (end.type === 'stair' && end.index === 'nearest') {
      const cl = computeEndpointData(start);
      ep = computeEndpointData(end, cl.coords);
      sp = cl;
      ep.stairIndex !== undefined && onNearestStairFound?.(ep.stairIndex);
    } else {
      sp = computeEndpointData(start);
      ep = computeEndpointData(end);
    }
    setCs(sp); setCe(ep);

    if (sp.corridorId === ep.corridorId) {
      setDirectLine(true);
      setSelPath([]);
    } else {
      // Use actual coordinates for path snapping
      const cp1 = getClosestPointIndex(sp.coords);
      const cp2 = getClosestPointIndex(ep.coords);
      if (cp1 === cp2) {
        setDirectLine(true);
        setSelPath([]);
      } else {
        setDirectLine(false);
        setSelPath(findValidPath(cp1, cp2));
      }
    }
  }, [start, end]);

  useEffect(() => {
    if (cs && ce) {
      const points = directLine
        ? [cs.coords, ce.coords]
        : [cs.coords, ...selPath.map(i => normalizedRoadPoints[i]), ce.coords];
      let d = `M ${points[0].x} ${points[0].y}`;
      let length = 0;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
        length += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
      }
      setPathData({ d, length });
    }
  }, [cs, ce, selPath, directLine]);

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
        style={{ width: mapData.originalWidth * baseScale, height: mapData.originalHeight * baseScale }}
        resizeMode="contain"
      />
      {pathData && (
        <Svg width={mapData.originalWidth * baseScale} height={mapData.originalHeight * baseScale} style={styles.svgOverlay}>
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

export default Seniorff;


