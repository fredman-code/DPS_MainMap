import React from 'react';
import { View, Image, Dimensions, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { adjustedMaps } from './data';

const CorridorOverlay: React.FC = () => {
  // Use a map – for example, Senior FF.
  const seniorFF = adjustedMaps.find(map => map.name === "Senior FF");
  if (!seniorFF) {
    throw new Error("Senior FF map not found in adjustedMaps");
  } 

  const mapData = {
    image: seniorFF.image,
    originalWidth: seniorFF.originalWidth,
    originalHeight: seniorFF.originalHeight,
  };

  // Scaling: Compute a base scale factor so the map fits the device screen.
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const widthRatio = screenWidth / mapData.originalWidth;
  const heightRatio = screenHeight / mapData.originalHeight;
  const baseScale = Math.min(widthRatio, heightRatio);

  // Use the corridors array from the map.
  const corridors = seniorFF.corridors; // Each corridor has { id, coords, rooms, ... }

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
      <Svg
        width={mapData.originalWidth * baseScale}
        height={mapData.originalHeight * baseScale}
        style={StyleSheet.absoluteFill}
      >
        {corridors.map((corridor) => {
          // The corridor's coords are assumed to be [x1, y1, x2, y2]
          const [x1, y1, x2, y2] = corridor.coords;
          const rectX = x1 * baseScale;
          const rectY = y1 * baseScale;
          const rectWidth = (x2 - x1) * baseScale;
          const rectHeight = (y2 - y1) * baseScale;
          // Center for the label
          const centerX = rectX + rectWidth / 2;
          const centerY = rectY + rectHeight / 2;

          return (
            <React.Fragment key={corridor.id}>
              <Rect
                x={rectX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                fill="rgba(255,0,0,0.2)"
                stroke="red"
                strokeWidth={2}
              />
              <SvgText
                x={centerX}
                y={centerY}
                fontSize="20"
                fill="black"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {`Corridor ${corridor.id}`}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

export default CorridorOverlay;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
