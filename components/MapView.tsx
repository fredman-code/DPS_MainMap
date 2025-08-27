import React, { useState, useEffect } from 'react';
import { 
  View, 
  Image, 
  Dimensions, 
  StyleSheet, 
  Text, 
  TouchableOpacity 
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Line } from 'react-native-svg';
import { collection, getDocs } from 'firebase/firestore';
import db from '../firebaseConfig';
import { adjustedMaps } from './data';

// Extract the Primary GF map data from adjustedMaps
const primaryGF = adjustedMaps.find(map => map.name === "Primary GF");

if (!primaryGF) {
  throw new Error("Primary GF map not found in adjustedMaps");
}

const mapData = {
  name: primaryGF.name,
  image: primaryGF.image,
  originalWidth: primaryGF.originalWidth,
  originalHeight: primaryGF.originalHeight,
};

// Build classroom list from corridors in "Primary GF"
// Now also include the corridorId for each classroom.
const classrooms = primaryGF.corridors.reduce<
  { id: number; coords: any; name: string; corridorId: number }[]
>((acc, corridor) => {
  corridor.rooms.forEach(roomNumber => {
    const point = primaryGF.points[roomNumber - 1]; // 1-based index
    if (point) {
      acc.push({
        id: roomNumber,
        coords: point,
        name: `Class ${roomNumber}`, // Fallback name
        corridorId: corridor.id
      });
    }
  });
  return acc;
}, []);

// ------------------------------
// Scaling Setup
// ------------------------------
const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const widthRatio = screenWidth / mapData.originalWidth;
const heightRatio = screenHeight / mapData.originalHeight;
const baseScale = Math.min(widthRatio, heightRatio);

// Updated normalize function that accepts either an array or an object with a "coords" property.
const normalize = (input: any): { x: number; y: number } => {
  let coords;
  if (Array.isArray(input)) {
    coords = input;
  } else if (input && typeof input === 'object' && Array.isArray(input.coords)) {
    coords = input.coords;
  } else {
    console.error("normalize: expected an array or object with coords but received", input);
    return { x: 0, y: 0 };
  }
  const [x, y] = coords;
  return { x: x * baseScale, y: y * baseScale };
};

const roadPoints: number[][] = [
  [249, 1009], [254, 1623], [636, 1622], [644, 1012], [646, 1205],
  [820, 1200], [910, 1303], [643, 1422], [844, 1417],
  [2256, 1009], [2251, 1617], [1866, 1613], [1869, 1018], [1862, 1185],
  [1678, 1206], [1605, 1304], [1661, 1412], [1852, 1421]
];

const normalizedRoadPoints = roadPoints.map(normalize);
const normalizedClassrooms = classrooms.map(({ id, coords, name, corridorId }) => ({
  id,
  name,
  corridorId,
  coords: normalize(coords),
}));

// Instead of simply normalizing all stairs, we extract them from the corridors.
// This way, each stair gets assigned a corridorId.
// (If corridors don’t define stairs, fallback to primaryGF.stairs if available.)
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

// Fallback: if no stairs were found in corridors, use primaryGF.stairs.
if (stairsWithCorridor.length === 0 && primaryGF.stairs && Array.isArray(primaryGF.stairs)) {
  primaryGF.stairs.forEach((stair) => {
    stairsWithCorridor.push({ coords: normalize(stair), corridorId: 0 });
  });
}

// ------------------------------
// Road Connections (unchanged)
// ------------------------------
const roadConnections = new Map<number, number[]>([
  [1, [2, 4]], [2, [1, 3]], [3, [2, 8]], [4, [1, 5]],
  [5, [4, 6, 8]], [6, [5, 7]], [7, [6, 9, 16]], [8, [3, 5, 9]],
  [9, [7, 8]], [10, [13]], [11, [12]], [12, [11, 18]],
  [13, [10, 14]], [14, [13, 15, 18]], [15, [14, 16]], [16, [7, 15, 17]],
  [17, [16, 18]], [18, [12, 14, 17]]
]);

// ------------------------------
// Utility Functions
// ------------------------------
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
      const neighbors = roadConnections.get(lastNode + 1); // 1-based indexing
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

// ------------------------------
// MapOverlay Component
// ------------------------------
const MapOverlay: React.FC = () => {
  // For classroom-to-classroom path
  const [selectedClass1, setSelectedClass1] = useState<number | null>(null);
  const [selectedClass2, setSelectedClass2] = useState<number | null>(null);
  // For classroom-to-stair path; if a stair option is selected, its value is non-null.
  // It can be 'nearest' (for the nearest stair) or a specific index.
  const [selectedStair, setSelectedStair] = useState<number | 'nearest' | null>(null);
  
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  // For cases where a direct line is drawn (when both endpoints are in the same corridor)
  const [directLine, setDirectLine] = useState<{ start: { x: number; y: number }, end: { x: number; y: number } } | null>(null);
  // To hold the stair's coordinate when computing a classroom-to-stair path with turning points.
  const [stairCoord, setStairCoord] = useState<{ x: number; y: number } | null>(null);
  const [classroomNames, setClassroomNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch classroom names from Firestore (match doc ID to classroom.id)
  useEffect(() => {
    const fetchClassroomNames = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, mapData.name));
        const names: Record<number, string> = {};

        snapshot.forEach(doc => {
          const docId = parseInt(doc.id, 10);
          const data = doc.data();
          const fieldNames = Object.keys(data);
          if (fieldNames.length > 0) {
            names[docId] = fieldNames[0];
          }
        });

        setClassroomNames(names);
      } catch (error) {
        console.error("Error fetching classroom names: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClassroomNames();
  }, [mapData.name]);

  const handleSelection = () => {
    // If a stair option is selected, draw the path from the selected classroom to the stair.
    if (selectedStair !== null) {
      if (selectedClass1 === null) {
        console.error("Please select a classroom for the stair path.");
        return;
      }
      const classroom = normalizedClassrooms[selectedClass1];
      let chosenStair: { coords: { x: number; y: number }; corridorId: number } | null = null;
      if (selectedStair === 'nearest') {
        let minDistance = Infinity;
        stairsWithCorridor.forEach((stair) => {
          const distance = Math.sqrt(
            Math.pow(stair.coords.x - classroom.coords.x, 2) + Math.pow(stair.coords.y - classroom.coords.y, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            chosenStair = stair;
          }
        });
      } else {
        chosenStair = stairsWithCorridor[selectedStair];
      }
      if (!chosenStair) return;
      setStairCoord(chosenStair.coords);
      // If the classroom and stair belong to the same corridor, draw a direct line.
      if (classroom.corridorId === chosenStair.corridorId) {
        setDirectLine({ start: classroom.coords, end: chosenStair.coords });
        setSelectedPath([]);
      } else {
        // Otherwise, compute a valid path via road turning points.
        const cp1 = getClosestPointIndex(classroom.coords);
        const cp2 = getClosestPointIndex(chosenStair.coords);
        const validPath = findValidPath(cp1, cp2);
        setSelectedPath(validPath);
        setDirectLine(null);
      }
    } else if (selectedClass1 !== null && selectedClass2 !== null) {
      // For classroom-to-classroom, if both classrooms are in the same corridor draw a direct line.
      const classroom1 = normalizedClassrooms[selectedClass1];
      const classroom2 = normalizedClassrooms[selectedClass2];
      if (classroom1.corridorId === classroom2.corridorId) {
        setDirectLine({ start: classroom1.coords, end: classroom2.coords });
        setSelectedPath([]);
      } else {
        const cp1 = getClosestPointIndex(classroom1.coords);
        const cp2 = getClosestPointIndex(classroom2.coords);
        const validPath = findValidPath(cp1, cp2);
        setSelectedPath(validPath);
        setDirectLine(null);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image
        source={mapData.image}
        style={{
          width: mapData.originalWidth * baseScale,
          height: mapData.originalHeight * baseScale
        }}
        resizeMode="contain"
      />

      {/* Overlay SVG Elements */}
      <Svg
        width={mapData.originalWidth * baseScale}
        height={mapData.originalHeight * baseScale}
        style={styles.svgOverlay}
        pointerEvents="none"
      >
        {directLine ? (
          // Direct connection (either classroom-to-classroom or classroom-to-stair in the same corridor)
          <Line
            x1={directLine.start.x}
            y1={directLine.start.y}
            x2={directLine.end.x}
            y2={directLine.end.y}
            stroke="#333"
            strokeWidth={2}
          />
        ) : (
          <>
            {/* Draw the valid road path for turning points */}
            {selectedPath.map((pointIndex, i) => {
              if (i === selectedPath.length - 1) return null;
              const nextPointIndex = selectedPath[i + 1];
              return (
                <Line
                  key={i}
                  x1={normalizedRoadPoints[pointIndex].x}
                  y1={normalizedRoadPoints[pointIndex].y}
                  x2={normalizedRoadPoints[nextPointIndex].x}
                  y2={normalizedRoadPoints[nextPointIndex].y}
                  stroke="#333"
                  strokeWidth={2}
                />
              );
            })}
            {/* Draw connection line from the classroom to the first turning point */}
            {selectedClass1 !== null && selectedPath.length > 0 && (
              <Line
                x1={normalizedClassrooms[selectedClass1].coords.x}
                y1={normalizedClassrooms[selectedClass1].coords.y}
                x2={normalizedRoadPoints[selectedPath[0]].x}
                y2={normalizedRoadPoints[selectedPath[0]].y}
                stroke="#333"
                strokeWidth={2}
              />
            )}
            {/* Draw connection line from the destination to the last turning point.
                If a stair was chosen, use its coordinate; otherwise use the second classroom's. */}
            {selectedPath.length > 0 && (
              selectedStair !== null && stairCoord ? (
                <Line
                  x1={stairCoord.x}
                  y1={stairCoord.y}
                  x2={normalizedRoadPoints[selectedPath[selectedPath.length - 1]].x}
                  y2={normalizedRoadPoints[selectedPath[selectedPath.length - 1]].y}
                  stroke="#333"
                  strokeWidth={2}
                />
              ) : (
                selectedClass2 !== null && (
                  <Line
                    x1={normalizedClassrooms[selectedClass2].coords.x}
                    y1={normalizedClassrooms[selectedClass2].coords.y}
                    x2={normalizedRoadPoints[selectedPath[selectedPath.length - 1]].x}
                    y2={normalizedRoadPoints[selectedPath[selectedPath.length - 1]].y}
                    stroke="#333"
                    strokeWidth={2}
                  />
                )
              )
            )}
          </>
        )}
      </Svg>

      {/* Dropdowns for Classroom Selection */}
      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={selectedClass1}
          onValueChange={(itemValue) => setSelectedClass1(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Classroom 1" value={null} />
          {normalizedClassrooms.map((classroom, idx) => (
            <Picker.Item
              key={classroom.id}
              label={classroomNames[classroom.id] || classroom.name}
              value={idx}
            />
          ))}
        </Picker>
        <Picker
          selectedValue={selectedClass2}
          onValueChange={(itemValue) => setSelectedClass2(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Classroom 2" value={null} />
          {normalizedClassrooms.map((classroom, idx) => (
            <Picker.Item
              key={classroom.id}
              label={classroomNames[classroom.id] || classroom.name}
              value={idx}
            />
          ))}
        </Picker>
      </View>

      {/* Dropdown for Stair Selection (optional) */}
      <View style={styles.stairDropdownContainer}>
        <Picker
          selectedValue={selectedStair}
          onValueChange={(itemValue) => setSelectedStair(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Stair (optional)" value={null} />
          <Picker.Item label="Nearest Stair" value="nearest" />
          {stairsWithCorridor.map((stair, idx) => (
            <Picker.Item
              key={idx}
              label={`Stair ${idx + 1}`}
              value={idx}
            />
          ))}
        </Picker>
      </View>

      {/* Confirm Selection Button */}
      <TouchableOpacity style={styles.button} onPress={handleSelection}>
        <Text style={styles.buttonText}>Confirm Selection</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center' },
  svgOverlay: { position: 'absolute', top: 0, left: 0 },
  dropdownContainer: { flexDirection: 'row', marginVertical: 10, backgroundColor: '#f2f2f2', padding: 10 },
  stairDropdownContainer: { marginVertical: 10, backgroundColor: '#f2f2f2', padding: 10 },
  picker: { height: 50, width: 180 },
  button: { marginTop: 10, backgroundColor: 'blue', padding: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});

export default MapOverlay;
































