import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { adjustedMaps } from './data';

const DisplayClassroomOnMap: React.FC = () => {
  // --- 1. Extract Map Data ---
  const seniorFF = adjustedMaps.find(map => map.name === "Senior FF");
  if (!seniorFF) {
    throw new Error("Senior FF map not found in adjustedMaps");
  }
  const mapData = {
    name: seniorFF.name,
    image: seniorFF.image,
    originalWidth: seniorFF.originalWidth,
    originalHeight: seniorFF.originalHeight,
  };

  // --- 2. Build Classroom List from Corridors ---
  const classrooms = seniorFF.corridors.reduce<{ id: number; coords: number[]; name: string }[]>((acc, corridor) => {
    corridor.rooms.forEach(roomNumber => {
      const point = seniorFF.points[roomNumber - 1]; // 1-based index
      if (point) {
        acc.push({
          id: roomNumber,
          coords: point,
          name: `Class ${roomNumber}`,
        });
      }
    });
    return acc;
  }, []);

  // --- 3. Setup Scaling ---
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const widthRatio = screenWidth / mapData.originalWidth;
  const heightRatio = screenHeight / mapData.originalHeight;
  const baseScale = Math.min(widthRatio, heightRatio);

  // --- 4. Normalize Coordinates ---
  const normalize = ([x, y]: number[]): { x: number; y: number } => ({
    x: x * baseScale,
    y: y * baseScale,
  });
  const normalizedClassrooms = classrooms.map(({ id, coords, name }) => ({
    id,
    name,
    coords: normalize(coords),
  }));

  // --- 5. Component State ---
  // selectedIndex is the index in the normalizedClassrooms array.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedClassroom = selectedIndex !== null ? normalizedClassrooms[selectedIndex] : null;

  return (
    <View style={styles.container}>
      {/* Map container */}
      <View style={styles.mapContainer}>
        <Image
          source={mapData.image}
          style={{
            width: mapData.originalWidth * baseScale,
            height: mapData.originalHeight * baseScale,
          }}
          resizeMode="contain"
        />
        {/* SVG overlay for marker */}
        <Svg
          width={mapData.originalWidth * baseScale}
          height={mapData.originalHeight * baseScale}
          style={StyleSheet.absoluteFill}
        >
          {selectedClassroom && (
            <>
              <Circle
                cx={selectedClassroom.coords.x}
                cy={selectedClassroom.coords.y}
                r={6}
                fill="red"
              />
              <SvgText
                x={selectedClassroom.coords.x + 8}
                y={selectedClassroom.coords.y - 8}
                fontSize="14"
                fill="black"
                fontWeight="bold"
              >
                {`${selectedClassroom.name} (${selectedClassroom.id}): (${Math.round(selectedClassroom.coords.x)}, ${Math.round(selectedClassroom.coords.y)})`}
              </SvgText>
            </>
          )}
        </Svg>
      </View>

      {/* Dropdown for classroom selection */}
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedIndex}
          onValueChange={(itemValue) => setSelectedIndex(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Classroom" value={null} />
          {normalizedClassrooms.map((classroom, idx) => (
            <Picker.Item
              key={classroom.id}
              label={`${classroom.name} (${classroom.id}): (${Math.round(classroom.coords.x)}, ${Math.round(classroom.coords.y)})`}
              value={idx}
            />
          ))}
        </Picker>
      </View>

      {/* Display selected classroom info */}
      {selectedClassroom && (
        <Text style={styles.infoText}>
          Selected {selectedClassroom.name} ({selectedClassroom.id}) - Coordinates: (
          {Math.round(selectedClassroom.coords.x)}, {Math.round(selectedClassroom.coords.y)})
        </Text>
      )}
    </View>
  );
};

export default DisplayClassroomOnMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    position: 'relative',
  },
  pickerContainer: {
    width: '80%',
    backgroundColor: '#f2f2f2',
    marginVertical: 20,
    borderRadius: 5,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  infoText: {
    fontSize: 18,
    textAlign: 'center',
  },
});
