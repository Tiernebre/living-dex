// AUTO-GENERATED from pokeruby/data/maps/*/events.inc and
// pokeruby/include/constants/secret_bases.h. Each entry maps a
// SecretBase.secretBaseId byte to the Hoenn route + tile (x,y) +
// interior tileset (red/brown/blue/yellow cave, tree, shrub) where the
// base is set up in the overworld.
export type SecretBaseLocation = {
  route: string;
  x: number;
  y: number;
  interior: string;
};

export const SECRET_BASE_LOCATIONS: Record<number, SecretBaseLocation> = {
  1: { route: "Route 118", x: 47, y: 14, interior: "Red Cave 1" },
  2: { route: "Route 125", x: 53, y: 10, interior: "Red Cave 1" },
  3: { route: "Route 113", x: 49, y: 8, interior: "Red Cave 1" },
  11: { route: "Route 118", x: 67, y: 6, interior: "Red Cave 2" },
  12: { route: "Route 121", x: 40, y: 11, interior: "Red Cave 2" },
  13: { route: "Route 111", x: 35, y: 1, interior: "Red Cave 2" },
  21: { route: "Route 115", x: 20, y: 53, interior: "Red Cave 3" },
  22: { route: "Route 121", x: 18, y: 13, interior: "Red Cave 3" },
  23: { route: "Route 119", x: 26, y: 81, interior: "Red Cave 3" },
  31: { route: "Route 127", x: 59, y: 67, interior: "Red Cave 4" },
  32: { route: "Route 125", x: 55, y: 11, interior: "Red Cave 4" },
  33: { route: "Route 111", x: 27, y: 27, interior: "Red Cave 4" },
  41: { route: "Route 114", x: 9, y: 47, interior: "Brown Cave 1" },
  42: { route: "Route 115", x: 32, y: 39, interior: "Brown Cave 1" },
  43: { route: "Route 115", x: 23, y: 8, interior: "Brown Cave 1" },
  51: { route: "Route 114", x: 30, y: 51, interior: "Brown Cave 2" },
  52: { route: "Route 115", x: 26, y: 15, interior: "Brown Cave 2" },
  53: { route: "Route 115", x: 32, y: 46, interior: "Brown Cave 2" },
  61: { route: "Route 114", x: 11, y: 62, interior: "Brown Cave 3" },
  62: { route: "Route 115", x: 21, y: 18, interior: "Brown Cave 3" },
  63: { route: "Route 115", x: 25, y: 24, interior: "Brown Cave 3" },
  71: { route: "Route 114", x: 19, y: 70, interior: "Brown Cave 4" },
  72: { route: "Route 115", x: 32, y: 6, interior: "Brown Cave 4" },
  73: { route: "Route 114", x: 32, y: 57, interior: "Brown Cave 4" },
  81: { route: "Route 116", x: 71, y: 4, interior: "Blue Cave 1" },
  82: { route: "Route 123", x: 47, y: 3, interior: "Blue Cave 1" },
  83: { route: "Route 123", x: 57, y: 5, interior: "Blue Cave 1" },
  91: { route: "Route 116", x: 79, y: 11, interior: "Blue Cave 2" },
  92: { route: "Route 123", x: 49, y: 3, interior: "Blue Cave 2" },
  93: { route: "Route 120", x: 18, y: 12, interior: "Blue Cave 2" },
  101: { route: "Route 120", x: 28, y: 62, interior: "Blue Cave 3" },
  102: { route: "Route 116", x: 56, y: 6, interior: "Blue Cave 3" },
  103: { route: "Route 119", x: 16, y: 81, interior: "Blue Cave 3" },
  111: { route: "Route 120", x: 30, y: 62, interior: "Blue Cave 4" },
  112: { route: "Route 116", x: 55, y: 15, interior: "Blue Cave 4" },
  113: { route: "Route 119", x: 16, y: 28, interior: "Blue Cave 4" },
  121: { route: "Route 111", x: 33, y: 34, interior: "Yellow Cave 1" },
  122: { route: "Route 118", x: 29, y: 5, interior: "Yellow Cave 1" },
  123: { route: "Route 127", x: 45, y: 24, interior: "Yellow Cave 1" },
  131: { route: "Route 111", x: 24, y: 36, interior: "Yellow Cave 2" },
  132: { route: "Route 125", x: 7, y: 25, interior: "Yellow Cave 2" },
  133: { route: "Route 115", x: 8, y: 30, interior: "Yellow Cave 2" },
  141: { route: "Route 111", x: 34, y: 50, interior: "Yellow Cave 3" },
  142: { route: "Route 127", x: 59, y: 72, interior: "Yellow Cave 3" },
  143: { route: "Route 127", x: 61, y: 21, interior: "Yellow Cave 3" },
  151: { route: "Route 127", x: 67, y: 63, interior: "Yellow Cave 4" },
  152: { route: "Route 125", x: 24, y: 32, interior: "Yellow Cave 4" },
  153: { route: "Route 111", x: 35, y: 31, interior: "Yellow Cave 4" },
  161: { route: "Route 111", x: 13, y: 19, interior: "Tree 1" },
  162: { route: "Route 121", x: 43, y: 7, interior: "Tree 1" },
  163: { route: "Route 118", x: 47, y: 5, interior: "Tree 1" },
  164: { route: "Route 111", x: 14, y: 19, interior: "Tree 1" },
  171: { route: "Route 118", x: 46, y: 5, interior: "Tree 2" },
  172: { route: "Route 121", x: 42, y: 7, interior: "Tree 2" },
  173: { route: "Route 119", x: 19, y: 76, interior: "Tree 2" },
  174: { route: "Route 115", x: 7, y: 20, interior: "Tree 2" },
  181: { route: "Route 110", x: 16, y: 25, interior: "Tree 3" },
  182: { route: "Route 114", x: 11, y: 27, interior: "Tree 3" },
  183: { route: "Route 115", x: 8, y: 20, interior: "Tree 3" },
  191: { route: "Route 110", x: 17, y: 25, interior: "Tree 4" },
  192: { route: "Route 114", x: 12, y: 27, interior: "Tree 4" },
  193: { route: "Route 119", x: 18, y: 76, interior: "Tree 4" },
  201: { route: "Route 119", x: 5, y: 2, interior: "Shrub 1" },
  202: { route: "Route 119", x: 4, y: 89, interior: "Shrub 1" },
  203: { route: "Route 120", x: 38, y: 54, interior: "Shrub 1" },
  204: { route: "Route 120", x: 5, y: 76, interior: "Shrub 1" },
  211: { route: "Route 119", x: 5, y: 15, interior: "Shrub 2" },
  212: { route: "Route 119", x: 7, y: 101, interior: "Shrub 2" },
  213: { route: "Route 120", x: 31, y: 23, interior: "Shrub 2" },
  221: { route: "Route 119", x: 34, y: 24, interior: "Shrub 3" },
  222: { route: "Route 120", x: 26, y: 10, interior: "Shrub 3" },
  223: { route: "Route 119", x: 4, y: 15, interior: "Shrub 3" },
  231: { route: "Route 119", x: 31, y: 73, interior: "Shrub 4" },
  232: { route: "Route 120", x: 29, y: 85, interior: "Shrub 4" },
  233: { route: "Route 119", x: 6, y: 2, interior: "Shrub 4" },
};

export function lookupSecretBaseLocation(id: number): SecretBaseLocation | null {
  return SECRET_BASE_LOCATIONS[id] ?? null;
}
