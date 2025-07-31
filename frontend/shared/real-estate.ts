export interface RealEstateListing {
  id: string;
  title: string;
  prefecture: string;
  price?: number;
  floorPlan?: string;
  area?: string; // building area in square meters (string from backend)
  landArea?: string; // land area in square meters (string from backend)
  address?: string;
  imageUrl: string;
  yearBuilt?: string; // construction date as descriptive string from backend
  listingDate: string; // ISO date string
  description: string;
  features: string[];
  propertyType?: string;
  transportation?: string; // transportation info separated by /
  buildingStructure?: string; // material, floors, etc.
}

export const PREFECTURES = [
  { display: "Hokkaido", value: "hokkaido" },
  { display: "Aomori", value: "aomori" },
  { display: "Iwate", value: "iwate" },
  { display: "Miyagi", value: "miyagi" },
  { display: "Akita", value: "akita" },
  { display: "Yamagata", value: "yamagata" },
  { display: "Fukushima", value: "fukushima" },
  { display: "Tokyo", value: "tokyo" },
  { display: "Kanagawa", value: "kanagawa" },
  { display: "Saitama", value: "saitama" },
  { display: "Chiba", value: "chiba" },
  { display: "Ibaraki", value: "ibaraki" },
  { display: "Tochigi", value: "tochigi" },
  { display: "Gunma", value: "gunma" },
  { display: "Niigata", value: "niigata" },
  { display: "Yamanashi", value: "yamanashi" },
  { display: "Nagano", value: "nagano" },
  { display: "Toyama", value: "toyama" },
  { display: "Ishikawa", value: "ishikawa" },
  { display: "Fukui", value: "fukui" },
  { display: "Aichi", value: "aichi" },
  { display: "Gifu", value: "gifu" },
  { display: "Shizuoka", value: "shizuoka" },
  { display: "Mie", value: "mie" },
  { display: "Osaka", value: "osaka" },
  { display: "Hyogo", value: "hyogo" },
  { display: "Kyoto", value: "kyoto" },
  { display: "Shiga", value: "shiga" },
  { display: "Nara", value: "nara" },
  { display: "Wakayama", value: "wakayama" },
  { display: "Hiroshima", value: "hiroshima" },
  { display: "Okayama", value: "okayama" },
  { display: "Tottori", value: "tottori" },
  { display: "Shimane", value: "shimane" },
  { display: "Yamaguchi", value: "yamaguchi" },
  { display: "Tokushima", value: "tokushima" },
  { display: "Kagawa", value: "kagawa" },
  { display: "Ehime", value: "ehime" },
  { display: "Kochi", value: "kochi" },
  { display: "Fukuoka", value: "fukuoka" },
  { display: "Saga", value: "saga" },
  { display: "Nagasaki", value: "nagasaki" },
  { display: "Kumamoto", value: "kumamoto" },
  { display: "Oita", value: "oita" },
  { display: "Miyazaki", value: "miyazaki" },
  { display: "Kagoshima", value: "kagoshima" },
  { display: "Okinawa", value: "okinawa" }
] as const;

// Helper function to get backend value from display name
export const getPrefectureValue = (displayName: string): string => {
  const prefecture = PREFECTURES.find(p => p.display === displayName);
  return prefecture ? prefecture.value : displayName.toLowerCase();
};

// Helper function to get display name from backend value
export const getPrefectureDisplay = (backendValue: string): string => {
  if (!backendValue) return "Unknown";
  const prefecture = PREFECTURES.find(p => p.value === backendValue);
  return prefecture ? prefecture.display : backendValue.charAt(0).toUpperCase() + backendValue.slice(1);
};

export const FLOOR_PLANS = [
  "1R",
  "1K", 
  "1DK",
  "1LDK",
  "2K",
  "2DK", 
  "2LDK",
  "3K",
  "3DK",
  "3LDK",
  "4LDK",
  "5LDK+"
] as const;

// Mock data for development
export const PROPERTY_TYPES = [
  "Apartment",
  "House",
  "Mansion",
  "Condo",
  "Townhouse",
  "Studio"
] as const;
  
