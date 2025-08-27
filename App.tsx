// App.tsx
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text, Dimensions } from 'react-native';
import AllClassroomsScreen, { parseSelection } from './components/dropdown';
import Primarygf from './components/Primarygf';
import Seniorgf from './components/Seniorgf';
import Primaryff from './components/Primaryff';
import Seniorff from './components/Seniorff';


const App = () => {
  const [selectedClass1, setSelectedClass1] = useState<string | null>(null);
  const [selectedClass2, setSelectedClass2] = useState<string | null>(null);
  const [stairIndex, setStairIndex] = useState<number>(0);
  const [stairIndex2, setStairIndex2] = useState<number>(0);

  const key1 = `map1-${selectedClass1}-${selectedClass2}`;
const key2 = `map2-${selectedClass1}-${selectedClass2}`;
const key3 = `map3-${selectedClass1}-${selectedClass2}`;
  

 const handleNearestStairFound = (index: number) => {
  console.log('Nearest stair found (1):', index);
  setStairIndex(index+1);
};

const handleNearestStairFound2 = (index: number) => {
  console.log('Nearest stair found (2):', index);
  setStairIndex2(index+1);
};

  const renderMaps = () => {
    if (!selectedClass1 || !selectedClass2) {
      return <Text>Please select both classrooms.</Text>;
    }
    const selection1 = parseSelection(selectedClass1);
    const selection2 = parseSelection(selectedClass2);

    const building1 = selection1.floor.split(' ')[0];
    const building2 = selection2.floor.split(' ')[0];

    if (selection1.floor === selection2.floor) {
      const Component = {
        'Primary GF': Primarygf,
        'Senior GF': Seniorgf,
        'Primary FF': Primaryff,
        'Senior FF': Seniorff,
      }[selection1.floor];

      return Component ? (
        <Component
          start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
          end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
        />
      ) : (
        <Text>Invalid selection.</Text>
      );
    }

    // Same building, different floors (GF <-> FF)
    if (
      (selection1.floor.includes('GF') && selection2.floor.includes('FF') && building1 === building2) ||
      (selection1.floor.includes('FF') && selection2.floor.includes('GF') && building1 === building2)
    ) {
      return (
        <ScrollView horizontal pagingEnabled style={styles.mapScroll}>
          {/* GF Map */}
          {selection1.floor.includes('GF') ? (
            selection1.floor === 'Primary GF' ? (
              <Primarygf
                key={key1}
                start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
                end={{ type: 'stair', index: stairIndex }}
                onNearestStairFound={handleNearestStairFound}
              />
            ) : (
              <Seniorgf
                key={key1}
                start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
                end={{ type: 'stair', index: stairIndex }}
                onNearestStairFound={handleNearestStairFound}
              />
            )
          ) : selection2.floor === 'Primary GF' ? (
            <Primarygf
              key={key1}
              start={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
              end={{ type: 'stair', index: stairIndex }}
              onNearestStairFound={handleNearestStairFound}

            />
          ) : (
            <Seniorgf
              key={key1}
              start={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
              end={{ type: 'stair', index: stairIndex }}
              onNearestStairFound={handleNearestStairFound}
            />
          )}

          {/* FF Map */}
          {selection1.floor.includes('FF') ? (
            selection1.floor === 'Primary FF' ? (
              <Primaryff
                key={key2}
                start={{ type: 'stair', index: 'nearest' }}
                end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
                onNearestStairFound={handleNearestStairFound}
              />
            ) : (
              <Seniorff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound}
/>
            )
          ) : selection2.floor === 'Primary FF' ? (
            <Primaryff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound}
/>
          ) : (
            <Seniorff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound}
/>
          )}
        </ScrollView>
      );
    }

    // GF -> FF across buildings
    // GF -> FF across buildings
if (
  selection1.floor.includes('GF') &&
  selection2.floor.includes('FF') &&
  building1 !== building2
) {
  return (
    <ScrollView horizontal pagingEnabled style={styles.mapScroll}>
      {/* Map 1: GF classroom to exit */}
      {selection1.floor === 'Primary GF' ? (
        <Primarygf
          key={key1}
          start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
          end={{ type: 'exit', index: 1 }}
        />
      ) : (
        <Seniorgf
          key={key1}
          start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
          end={{ type: 'exit', index: 1 }}
        />
      )}

      {/* Map 2: exit to stair in other building (compute stair here) */}
      {selection2.floor === 'Primary FF' ? (
        <Primarygf
          key={key2}
          start={{ type: 'exit', index: 2 }}
          end={{ type: 'stair', index: stairIndex2 }}
          onNearestStairFound={handleNearestStairFound2}
        />
      ) : (
        <Seniorgf
          key={key2}
          start={{ type: 'exit', index: 2 }}
          end={{ type: 'stair', index: stairIndex2 }}
          onNearestStairFound={handleNearestStairFound2}
        />
      )}

      {/* Map 3: stair to FF classroom */}
      {selection2.floor === 'Primary FF' ? (
        <Primaryff
          key={key3}
          start={{ type: 'stair', index: stairIndex2 }}
          end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
          onNearestStairFound={handleNearestStairFound2}
        />
      ) : (
        <Seniorff
          key={key3}
          start={{ type: 'stair', index: stairIndex2 }}
          end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
          onNearestStairFound={handleNearestStairFound2}
        />
      )}
    </ScrollView>
  );
}


    // FF -> GF across buildings
    if (selection1.floor.includes('FF') && selection2.floor.includes('GF')) {
      return (
        <ScrollView horizontal pagingEnabled style={styles.mapScroll}>
          {selection1.floor === 'Primary FF' ? (
            <Primaryff
              key={key1}
              start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
              end={{ type: 'stair', index: 'nearest' }}
              onNearestStairFound={handleNearestStairFound}
            />
          ) : (
            <Seniorff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound}
/>
          )}

          {selection1.floor === 'Primary FF' ? (
            <Primarygf
              key={key2}
              start={{ type: 'stair', index: stairIndex }}
              end={{ type: 'exit', index: 1 }}
              onNearestStairFound={handleNearestStairFound}
            />
          ) : (
            <Seniorgf
              key={key2}
              start={{ type: 'stair', index: stairIndex }}
              end={{ type: 'exit', index: 1 }}
              onNearestStairFound={handleNearestStairFound}
            />
          )}

          {selection2.floor === 'Primary GF' ? (
            <Primarygf
              key={key3}
              start={{ type: 'exit', index: 2 }}
              end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
            />
          ) : (
            <Seniorgf
              key={key3}
              start={{ type: 'exit', index: 2 }}
              end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
            />
          )}
        </ScrollView>
      );
    }

    // FF -> FF across buildings
    if (
      selection1.floor.includes('FF') &&
      selection2.floor.includes('FF') &&
      building1 !== building2
    ) {
      return (
        <ScrollView horizontal pagingEnabled style={styles.mapScroll}>
          {selection1.floor === 'Primary FF' ? (
            <Primaryff
              key={key1}
              start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
              end={{ type: 'stair', index: 'nearest' }}
              onNearestStairFound={handleNearestStairFound}
            />
          ) : (
            <Seniorff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound}
/>
          )}

          {selection1.floor === 'Primary FF' ? (
            <Primarygf
              key={key2}
              start={{ type: 'stair', index: stairIndex }}
              end={{ type: 'exit', index: 1 }}
              onNearestStairFound={handleNearestStairFound}
            />
          ) : (
            <Seniorgf
              key={key2}
              start={{ type: 'stair', index: stairIndex }}
              end={{ type: 'exit', index: 1 }}
              onNearestStairFound={handleNearestStairFound}
            />
          )}

          {selection2.floor === 'Primary FF' ? (
            <Primarygf
              key={key3}
              start={{ type: 'exit', index: 2 }}
              end={{ type: 'stair', index: stairIndex2 }}
              onNearestStairFound={handleNearestStairFound2}
            />
          ) : (
            <Seniorgf
              key={key3}
              start={{ type: 'exit', index: 2 }}
              end={{ type: 'stair', index: stairIndex2 }}
              onNearestStairFound={handleNearestStairFound2}
            />
          )}

          {selection2.floor === 'Primary FF' ? (
            <Primaryff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound2}
/>
          ) : (
            <Seniorff
  key={key2}
  start={{ type: 'stair', index: 'nearest' }}
  end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
  onNearestStairFound={handleNearestStairFound2}
/>
          )}
        </ScrollView>
      );
    }

    // GF -> GF across buildings
    if (
      selection1.floor.includes('GF') &&
      selection2.floor.includes('GF') &&
      building1 !== building2
    ) {
      return (
        <ScrollView horizontal pagingEnabled style={styles.mapScroll}>
          {selection1.floor === 'Primary GF' ? (
            <Primarygf
              key={key1}
              start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
              end={{ type: 'exit', index: 1 }}
            />
          ) : (
            <Seniorgf
              key={key1}
              start={{ type: 'classroom', index: parseInt(selection1.classNumber) }}
              end={{ type: 'exit', index: 1 }}
            />
          )}

          {selection2.floor === 'Primary GF' ? (
            <Primarygf
              key={key2}
              start={{ type: 'exit', index: 2 }}
              end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
            />
          ) : (
            <Seniorgf
              key={key2}
              start={{ type: 'exit', index: 2 }}
              end={{ type: 'classroom', index: parseInt(selection2.classNumber) }}
            />
          )}
        </ScrollView>
      );
    }

    return <Text>No matching map configuration found.</Text>;
  };

  return (
    <View style={styles.container}>
      <AllClassroomsScreen
        onSelectClass1={setSelectedClass1}
        onSelectClass2={setSelectedClass2}
      />
      <View style={styles.mapsContainer}>{renderMaps()}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: '#f5f5f5',
  },
  mapsContainer: {
    flex: 1,
    marginTop: 20,
    overflow: 'hidden',
  },
  mapScroll: {
    flex: 1,
  },
  mapPage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 100, // Adjusted for top padding + dropdown
  },
  instructionText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
  },
});




export default App;











