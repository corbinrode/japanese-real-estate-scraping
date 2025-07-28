export interface RealEstateListing {
  id: string;
  title: string;
  prefecture: string;
  price?: number;
  floorPlan?: string;
  area?: number; // building area in square meters
  landArea?: number; // land area in square meters
  address?: string;
  imageUrl: string;
  bedrooms: number;
  bathrooms: number;
  yearBuilt?: number;
  listingDate: string; // ISO date string
  description: string;
  features: string[];
  propertyType?: string;
  transportation?: string; // transportation info separated by /
  buildingStructure?: string; // material, floors, etc.
}

export const PREFECTURES = [
  "Tokyo",
  "Osaka",
  "Kyoto", 
  "Yokohama",
  "Nagoya",
  "Sapporo",
  "Kobe",
  "Fukuoka",
  "Sendai",
  "Hiroshima"
] as const;

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

export const mockListings: RealEstateListing[] = [
  {
    id: "1",
    title: "Modern Studio in Shibuya",
    prefecture: "Tokyo",
    price: 180000,
    floorPlan: "1R",
    area: 25,
    landArea: 0,
    address: "Shibuya, Tokyo",
    imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop",
    bedrooms: 1,
    bathrooms: 1,
    yearBuilt: 2020,
    listingDate: "2024-01-15T00:00:00.000Z",
    description: "Beautiful modern studio apartment in the heart of Shibuya. Perfect for young professionals.",
    features: ["Air conditioning", "High-speed internet", "Near station", "Security system"],
    propertyType: "Studio",
    transportation: "JR Yamanote Line - Shibuya Station 3 min walk / Tokyo Metro Hanzomon Line - Shibuya Station 5 min walk / JR Saikyo Line - Shibuya Station 3 min walk",
    buildingStructure: "Reinforced concrete, 12 floors"
  },
  {
    id: "2",
    title: "Spacious Family Home in Osaka",
    prefecture: "Osaka",
    price: 450000,
    floorPlan: "3LDK",
    area: 85,
    landArea: 120,
    address: "Namba, Osaka",
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=300&fit=crop",
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2018,
    listingDate: "2024-01-10T00:00:00.000Z",
    description: "Comfortable family apartment with modern amenities and great location.",
    features: ["Balcony", "Storage space", "Near schools", "Shopping nearby"],
    propertyType: "Apartment",
    transportation: "Osaka Metro Midosuji Line - Namba Station 5 min walk / Nankai Main Line - Namba Station 3 min walk / Kintetsu Nara Line - Osaka Namba Station 7 min walk",
    buildingStructure: "Steel frame, 8 floors"
  },
  {
    id: "3",
    title: "Traditional House in Kyoto",
    prefecture: "Kyoto",
    price: 320000,
    floorPlan: "2LDK",
    area: 70,
    landArea: 95,
    address: "Gion, Kyoto",
    imageUrl: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop",
    bedrooms: 2,
    bathrooms: 1,
    yearBuilt: 2015,
    listingDate: "2024-01-20T00:00:00.000Z",
    description: "Charming traditional-style home in historic Gion district.",
    features: ["Garden view", "Traditional design", "Historic area", "Quiet neighborhood"],
    propertyType: "House",
    transportation: "Keihan Main Line - Gion-Shijo Station 8 min walk / Kyoto City Bus - Gion Bus Stop 3 min walk / Hankyu Kyoto Line - Kawaramachi Station 12 min walk",
    buildingStructure: "Wood frame, 2 floors"
  },
  {
    id: "4",
    title: "Luxury Penthouse in Yokohama",
    prefecture: "Yokohama",
    price: 850000,
    floorPlan: "4LDK",
    area: 120,
    landArea: 0,
    address: "Minato Mirai, Yokohama",
    imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 2022,
    listingDate: "2024-01-25T00:00:00.000Z",
    description: "Stunning luxury penthouse with panoramic bay views.",
    features: ["Ocean view", "Luxury finishes", "Private elevator", "Concierge service"],
    propertyType: "Mansion",
    transportation: "JR Keihin-Tohoku Line - Sakuragicho Station 6 min walk / Yokohama Municipal Subway Blue Line - Minato Mirai Station 4 min walk / JR Tokaido Line - Yokohama Station 15 min walk",
    buildingStructure: "Reinforced concrete, 25 floors"
  },
  {
    id: "5",
    title: "Compact Apartment in Nagoya",
    prefecture: "Nagoya",
    floorPlan: "1K",
    area: 20,
    landArea: 0,
    address: "Sakae, Nagoya",
    imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop",
    bedrooms: 1,
    bathrooms: 1,
    yearBuilt: 2019,
    listingDate: "2024-01-05T00:00:00.000Z",
    description: "Efficient and modern compact living space in central Nagoya.",
    features: ["Modern kitchen", "Great location", "Low maintenance", "Student friendly"],
    propertyType: "Apartment",
    transportation: "Nagoya Municipal Subway Higashiyama Line - Sakae Station 3 min walk / Nagoya Municipal Subway Meijo Line - Sakae Station 5 min walk / Meitetsu Nagoya Line - Kanayama Station 12 min walk",
    buildingStructure: "Steel reinforced concrete, 15 floors"
  },
  {
    id: "6",
    title: "Mountain View Condo in Sapporo",
    prefecture: "Sapporo",
    price: 280000,
    floorPlan: "2DK",
    area: 55,
    landArea: 0,
    address: "Susukino, Sapporo",
    imageUrl: "https://images.unsplash.com/photo-1593696140826-c58b021acf8b?w=400&h=300&fit=crop",
    bedrooms: 2,
    bathrooms: 1,
    yearBuilt: 2017,
    listingDate: "2024-01-12T00:00:00.000Z",
    description: "Beautiful condo with mountain views and ski resort access.",
    features: ["Mountain view", "Heating system", "Near ski resorts", "Parking included"],
    propertyType: "Condo",
    transportation: "Sapporo Municipal Subway Namboku Line - Susukino Station 2 min walk / JR Hakodate Line - Sapporo Station 8 min walk / Sapporo Streetcar - Susukino Station 4 min walk",
    buildingStructure: "Reinforced concrete, 10 floors"
  },
  {
    id: "7",
    title: "Waterfront Apartment in Kobe",
    prefecture: "Kobe",
    price: 380000,
    floorPlan: "2LDK",
    area: 75,
    landArea: 0,
    address: "Harborland, Kobe",
    imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop",
    bedrooms: 2,
    bathrooms: 2,
    yearBuilt: 2021,
    listingDate: "2024-01-18T00:00:00.000Z",
    description: "Modern waterfront living with stunning harbor views.",
    features: ["Harbor view", "Modern amenities", "Waterfront location", "24/7 security"],
    propertyType: "Apartment",
    transportation: "JR Tokaido Line - Kobe Station 10 min walk / Kobe Municipal Subway Kaigan Line - Harborland Station 3 min walk / JR Kobe Line - Motomachi Station 15 min walk",
    buildingStructure: "Steel frame, 20 floors"
  },
  {
    id: "8",
    title: "Business District Office Conversion",
    prefecture: "Fukuoka",
    price: 260000,
    floorPlan: "1LDK",
    area: 45,
    landArea: 0,
    address: "Tenjin, Fukuoka",
    imageUrl: "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400&h=300&fit=crop",
    bedrooms: 1,
    bathrooms: 1,
    yearBuilt: 2020,
    listingDate: "2024-01-08T00:00:00.000Z",
    description: "Unique converted office space in the heart of business district.",
    features: ["High ceilings", "Industrial design", "Central location", "Unique layout"],
    propertyType: "Apartment",
    transportation: "Fukuoka Municipal Subway Airport Line - Tenjin Station 1 min walk / Nishitetsu Tenjin Omuta Line - Nishitetsu-Fukuoka (Tenjin) Station 5 min walk / Fukuoka Municipal Subway Nanakuma Line - Tenjin-Minami Station 8 min walk"
  },
  {
    id: "9",
    title: "Family Home Near University",
    prefecture: "Sendai",
    price: 200000,
    floorPlan: "3DK",
    area: 68,
    landArea: 110,
    address: "Aoba, Sendai",
    imageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=300&fit=crop",
    bedrooms: 3,
    bathrooms: 1,
    yearBuilt: 2016,
    listingDate: "2024-01-22T00:00:00.000Z",
    description: "Perfect for families with children attending local universities.",
    features: ["Near university", "Family friendly", "Good schools", "Public transport"],
    propertyType: "House",
    transportation: "Sendai Municipal Subway Tozai Line - Aoba-dori Ichibancho Station 12 min walk / JR Senzan Line - Sendai Station 20 min walk / Sendai Municipal Bus - Aoba District Office 5 min walk",
    buildingStructure: "Wood frame, 2 floors"
  },
  {
    id: "10",
    title: "Historic District Townhouse",
    prefecture: "Hiroshima",
    price: 340000,
    floorPlan: "3LDK",
    area: 90,
    landArea: 85,
    address: "Peace Memorial Park, Hiroshima",
    imageUrl: "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=400&h=300&fit=crop",
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2014,
    listingDate: "2024-01-14T00:00:00.000Z",
    description: "Elegant townhouse in historic district near Peace Memorial Park.",
    features: ["Historic location", "Spacious rooms", "Near memorial", "Cultural area"],
    propertyType: "Townhouse",
    transportation: "Hiroshima Electric Railway Hiroshima Main Line - Genbaku-Dome-mae Station 8 min walk / JR Sanyo Line - Yokogawa Station 15 min walk / Hiroshima Bus - Peace Memorial Park 3 min walk",
    buildingStructure: "Reinforced concrete, 3 floors"
  }
];

// Generate additional mock listings for pagination testing
const generateMoreListings = (): RealEstateListing[] => {
  const additionalListings: RealEstateListing[] = [];

  for (let i = 11; i <= 150; i++) {
    const prefecture = PREFECTURES[Math.floor(Math.random() * PREFECTURES.length)];
    const floorPlan = FLOOR_PLANS[Math.floor(Math.random() * FLOOR_PLANS.length)];
    const propertyType = PROPERTY_TYPES[Math.floor(Math.random() * PROPERTY_TYPES.length)];
    const price = Math.floor(Math.random() * 800000) + 100000;
    const area = Math.floor(Math.random() * 120) + 20;
    const landArea = propertyType === "House" || propertyType === "Townhouse" ? Math.floor(Math.random() * 150) + 50 : 0;
    const yearBuilt = Math.floor(Math.random() * 15) + 2010;
    const bedrooms = Math.floor(Math.random() * 4) + 1;
    const bathrooms = Math.floor(Math.random() * 3) + 1;

    // Generate random listing date within last 6 months
    const date = new Date();
    date.setMonth(date.getMonth() - Math.floor(Math.random() * 6));

    const imageIds = [
      "photo-1560448204-e02f11c3d0e2",
      "photo-1564013799919-ab600027ffc6",
      "photo-1513475382585-d06e58bcb0e0",
      "photo-1512917774080-9991f1c4c750",
      "photo-1522708323590-d24dbb6b0267",
      "photo-1593696140826-c58b021acf8b",
      "photo-1502672260266-1c1ef2d93688",
      "photo-1484154218962-a197022b5858",
      "photo-1570129477492-45c003edd2be",
      "photo-1605276374104-dee2a0ed3cd6"
    ];

    const randomImageId = imageIds[Math.floor(Math.random() * imageIds.length)];

    // Generate random transportation info
    const transportOptions = [
      `JR Line - Station A ${Math.floor(Math.random() * 10) + 1} min walk`,
      `Metro Line - Station B ${Math.floor(Math.random() * 15) + 2} min walk`,
      `Local Bus - Stop C ${Math.floor(Math.random() * 8) + 1} min walk`
    ];
    const numTransports = Math.floor(Math.random() * 3) + 1;
    const selectedTransports = transportOptions.slice(0, numTransports);

    // Generate random building structure
    const materials = ["Reinforced concrete", "Steel frame", "Wood frame", "Steel reinforced concrete"];
    const material = materials[Math.floor(Math.random() * materials.length)];
    const floors = Math.floor(Math.random() * 20) + 1;

    // Some listings may not have all fields (simulate missing data)
    const hasPrice = Math.random() > 0.1; // 90% have price
    const hasFloorPlan = Math.random() > 0.05; // 95% have floor plan
    const hasArea = Math.random() > 0.05; // 95% have area
    const hasYearBuilt = Math.random() > 0.15; // 85% have year built
    const hasPropertyType = Math.random() > 0.1; // 90% have property type
    const hasTransportation = Math.random() > 0.2; // 80% have transportation
    const hasAddress = Math.random() > 0.02; // 98% have address
    const hasBuildingStructure = Math.random() > 0.3; // 70% have building structure

    additionalListings.push({
      id: i.toString(),
      title: `Property ${i} in ${prefecture}`,
      prefecture,
      ...(hasPrice && { price }),
      ...(hasFloorPlan && { floorPlan }),
      ...(hasArea && { area }),
      landArea,
      ...(hasAddress && { address: `District ${i}, ${prefecture}` }),
      imageUrl: `https://images.unsplash.com/${randomImageId}?w=400&h=300&fit=crop&q=80&id=${i}`,
      bedrooms,
      bathrooms,
      ...(hasYearBuilt && { yearBuilt }),
      listingDate: date.toISOString(),
      description: `Beautiful property located in ${prefecture}. Perfect for modern living with great amenities.`,
      features: ["Modern amenities", "Great location", "Well maintained", "Good value"],
      ...(hasPropertyType && { propertyType }),
      ...(hasTransportation && { transportation: selectedTransports.join(" / ") }),
      ...(hasBuildingStructure && { buildingStructure: `${material}, ${floors} floors` })
    });
  }

  return additionalListings;
};

export const allListings = [...mockListings, ...generateMoreListings()];
