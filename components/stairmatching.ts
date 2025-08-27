import { maps } from "./data";

// Helper: Compute Euclidean distance between two points.
const distanceBetween = (a: [number, number], b: [number, number]): number =>
  Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));

// Helper: Given two arrays of stairs coordinates, match them into pairs.
// Each pair is chosen greedily based on the smallest distance.
export const matchStairs = (
  stairsA: [number, number][],
  stairsB: [number, number][]
): Array<{ stairA: [number, number]; stairB: [number, number]; distance: number }> => {
  const pairs: { stairA: [number, number]; stairB: [number, number]; distance: number }[] = [];
  const usedA = new Set<number>();
  const usedB = new Set<number>();

  // Build list of all possible pairs with their distances.
  const allPairs: Array<{ i: number; j: number; distance: number }> = [];
  for (let i = 0; i < stairsA.length; i++) {
    for (let j = 0; j < stairsB.length; j++) {
      const dist = distanceBetween(stairsA[i], stairsB[j]);
      allPairs.push({ i, j, distance: dist });
    }
  }
  // Sort pairs by ascending distance.
  allPairs.sort((a, b) => a.distance - b.distance);

  // Greedily assign pairs.
  for (const pair of allPairs) {
    if (!usedA.has(pair.i) && !usedB.has(pair.j)) {
      usedA.add(pair.i);
      usedB.add(pair.j);
      pairs.push({
        stairA: stairsA[pair.i],
        stairB: stairsB[pair.j],
        distance: pair.distance,
      });
    }
  }
  return pairs;
};

// Extract the maps for each floor.
const primaryGF = maps.find((m) => m.name === "Primary GF");
const primaryFF = maps.find((m) => m.name === "Primary FF");
const seniorGF = maps.find((m) => m.name === "Senior GF");
const seniorFF = maps.find((m) => m.name === "Senior FF");

// Create arrays of stair coordinates for each floor.
// Here we assert that the stairs arrays are of type [number, number][].
const primaryGFStairs: [number, number][] = primaryGF ? (primaryGF.stairs as [number, number][]) : [];
const primaryFFStairs: [number, number][] = primaryFF ? (primaryFF.stairs as [number, number][]) : [];
const seniorGFStairs: [number, number][] = seniorGF ? (seniorGF.stairs as [number, number][]) : [];
const seniorFFStairs: [number, number][] = seniorFF ? (seniorFF.stairs as [number, number][]) : [];

// For each building, create an array of stair pairs across floors.
// Note: Only pair if both floors exist.
export const primaryStairPairs =
  primaryGF && primaryFF ? matchStairs(primaryGFStairs, primaryFFStairs) : [];

export const seniorStairPairs =
  seniorGF && seniorFF ? matchStairs(seniorGFStairs, seniorFFStairs) : [];

// Optionally, log the results:
console.log("Primary Stair Pairs:", primaryStairPairs);
console.log("Senior Stair Pairs:", seniorStairPairs);

