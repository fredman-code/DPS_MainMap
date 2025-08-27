import React, { useRef, useState } from 'react';
import {
  View,
  Image,
  Dimensions,
  StyleSheet,
  ScrollView,
  Animated,
  PanResponder,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Svg, { Circle, Text, Line } from 'react-native-svg';

const mapData = {
  name: "Primary GF",
  image: require("../assets/SeniorFF.jpg"),
  originalWidth: 2481,
  originalHeight: 1754,
};

const points = [
    [992,606],
    [2211,597],
    [1000,970],
    [230,1606],
    [676,1601],
    [290,597],
    [2218,478],
    [2261,434],
    [1002,1677],
    [688,1677]
];

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// Calculate base scale to maintain aspect ratio
const widthRatio = screenWidth / mapData.originalWidth;
const heightRatio = screenHeight / mapData.originalHeight;
const baseScale = Math.min(widthRatio, heightRatio);

// Normalize function
const normalize = ([x, y]: number[]) => ({
  x: x * baseScale,
  y: y * baseScale,
});

const normalizedPoints = points.map(normalize);

const MapOverlay = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [selectedPoint1, setSelectedPoint1] = useState<number | null>(null);
  const [selectedPoint2, setSelectedPoint2] = useState<number | null>(null);
  const [selectedPairs, setSelectedPairs] = useState<{ point1: number; point2: number }[]>([]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (event, gestureState) => {
        if (gestureState.numberActiveTouches === 2) {
          const newScale = Math.max(1, Math.min(3, scale._value * (gestureState.scale || 1)));
          scale.setValue(newScale);
        } else {
          translateX.setValue(gestureState.dx);
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const handleSelection = () => {
    if (selectedPoint1 !== null && selectedPoint2 !== null && selectedPoint1 !== selectedPoint2) {
      console.log(`Selected Points: ${selectedPoint1 + 1} and ${selectedPoint2 + 1}`);
      setSelectedPairs([...selectedPairs, { point1: selectedPoint1, point2: selectedPoint2 }]);
      setSelectedPoint1(null);
      setSelectedPoint2(null);
    }
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      maximumZoomScale={3}
      minimumZoomScale={1}
      contentContainerStyle={{ alignItems: 'center' }}
    >
      <Animated.View
        style={[
          styles.imageContainer,
          {
            transform: [
              { scale: scale },
              { translateX: translateX },
              { translateY: translateY },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Background Image */}
        <Image
          source={mapData.image}
          style={{ width: mapData.originalWidth * baseScale, height: mapData.originalHeight * baseScale }}
          resizeMode="contain"
        />

        {/* Overlay SVG elements */}
        <Svg
          width={mapData.originalWidth * baseScale}
          height={mapData.originalHeight * baseScale}
          style={styles.svgOverlay}
        >
          {/* Draw previously selected lines */}
          {selectedPairs.map(({ point1, point2 }, index) => (
            <Line
              key={index}
              x1={normalizedPoints[point1].x}
              y1={normalizedPoints[point1].y}
              x2={normalizedPoints[point2].x}
              y2={normalizedPoints[point2].y}
              stroke="yellow"
              strokeWidth="4"
            />
          ))}

          {/* Draw circles and add labels */}
          {normalizedPoints.map(({ x, y }, index) => (
            <React.Fragment key={index}>
              <Circle cx={x} cy={y} r="10" fill="red" />
              <Text x={x + 10} y={y - 10} fontSize="16" fill="black" fontWeight="bold">
                {index + 1}
              </Text>
            </React.Fragment>
          ))}
        </Svg>
      </Animated.View>

      {/* Dropdowns for selecting points */}
      <View style={styles.dropdownContainer}>
        <Picker
          selectedValue={selectedPoint1}
          onValueChange={(itemValue) => setSelectedPoint1(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Point 1" value={null} />
          {points.map((_, index) => (
            <Picker.Item key={index} label={`Point ${index + 1}`} value={index} />
          ))}
        </Picker>

        <Picker
          selectedValue={selectedPoint2}
          onValueChange={(itemValue) => setSelectedPoint2(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Select Point 2" value={null} />
          {points.map((_, index) => (
            <Picker.Item key={index} label={`Point ${index + 1}`} value={index} />
          ))}
        </Picker>
      </View>

      {/* Button to confirm selection */}
      <View style={styles.buttonContainer}>
        <Animated.Text style={styles.button} onPress={handleSelection}>
          Confirm Selection
        </Animated.Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  dropdownContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
    backgroundColor: '#f2f2f2',
    padding: 10,
  },
  picker: {
    height: 50,
    width: 160,
  },
  buttonContainer: {
    marginTop: 10,
    backgroundColor: 'blue',
    padding: 10,
    borderRadius: 5,
  },
  button: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default MapOverlay;
