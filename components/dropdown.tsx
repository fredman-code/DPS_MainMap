// AllClassroomsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { collection, getDocs } from 'firebase/firestore';
import db from '../firebaseConfig';
import { maps } from './data';

// Create a combined list of classrooms from all floors.
const allClassrooms = maps.reduce<{ floor: string; id: number; fallbackName: string }[]>((acc, map) => {
  const floor = map.name;
  map.corridors.forEach(corridor => {
    corridor.rooms.forEach(roomNumber => {
      // Fallback name: "Floor: Class X"
      acc.push({
        floor,
        id: roomNumber,
        fallbackName: `${floor}: Class ${roomNumber}`,
      });
    });
  });
  return acc;
}, []);

// Helper function to parse a selection string "Floor-Number" into its components.
export const parseSelection = (selection: string) => {
  const parts = selection.split('-');
  return {
    floor: parts[0],
    classNumber: parts[1],
  };
};

interface AllClassroomsScreenProps {
  onSelectClass1: (value: string | null) => void;
  onSelectClass2: (value: string | null) => void;
}

const AllClassroomsScreen: React.FC<AllClassroomsScreenProps> = ({ onSelectClass1, onSelectClass2 }) => {
  const [classroomNamesByFloor, setClassroomNamesByFloor] = useState<Record<string, Record<number, string>>>({});
  const [loading, setLoading] = useState<boolean>(true);
  
 
  const [selectedClass1, setSelectedClass1] = useState<string | null>(null);
  const [selectedClass2, setSelectedClass2] = useState<string | null>(null);

 
  useEffect(() => {
    const fetchAllNames = async () => {
      const namesByFloor: Record<string, Record<number, string>> = {};
      for (const map of maps) {
        try {
          const snapshot = await getDocs(collection(db, map.name));
          const floorNames: Record<number, string> = {};
          snapshot.forEach(doc => {
            const docId = parseInt(doc.id, 10);
            const data = doc.data();
            const fieldNames = Object.keys(data);
            if (fieldNames.length > 0) {
              floorNames[docId] = fieldNames[0];
            }
          });
          namesByFloor[map.name] = floorNames;
        } catch (error) {
          console.error(`Error fetching names for ${map.name}:`, error);
        }
      }
      setClassroomNamesByFloor(namesByFloor);
      setLoading(false);
    };
    fetchAllNames();
  }, []);

  // Whenever the local selection changes, call the parent callbacks.
  useEffect(() => {
    onSelectClass1(selectedClass1);
  }, [selectedClass1]);

  useEffect(() => {
    onSelectClass2(selectedClass2);
  }, [selectedClass2]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Classrooms (All Floors)</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedClass1}
          onValueChange={(itemValue) => setSelectedClass1(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Select Classroom 1" value={null} />
          {allClassrooms.map(cls => {
            const firebaseName = classroomNamesByFloor[cls.floor]?.[cls.id];
            const label = firebaseName ? `${cls.floor}: ${firebaseName}` : cls.fallbackName;
            const value = `${cls.floor}-${cls.id}`;
            return <Picker.Item key={value} label={label} value={value} />;
          })}
        </Picker>
      </View>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedClass2}
          onValueChange={(itemValue) => setSelectedClass2(itemValue)}
          style={styles.picker}
          itemStyle={styles.pickerItem}
        >
          <Picker.Item label="Select Classroom 2" value={null} />
          {allClassrooms.map(cls => {
            const firebaseName = classroomNamesByFloor[cls.floor]?.[cls.id];
            const label = firebaseName ? `${cls.floor}: ${firebaseName}` : cls.fallbackName;
            const value = `${cls.floor}-${cls.id}`;
            return <Picker.Item key={value} label={label} value={value} />;
          })}
        </Picker>
      </View>
      {loading && <Text style={styles.loading}>Loading classroom names...</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f4f4f4', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    color: '#333',
  },
  pickerContainer: {
    width: '90%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginVertical: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    // Add a shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 3,
  },
  picker: { 
    height: 50, 
    width: '100%',
  },
  pickerItem: {
    fontSize: 18,
    color: '#333',
  },
  loading: {
    marginTop: 20,
    fontStyle: 'italic',
    color: '#555',
  },
});

export default AllClassroomsScreen;

