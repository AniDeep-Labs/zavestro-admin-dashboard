export interface Fabric {
  id: string;
  name: string;
  material: string;
  color: string;
  pricePerMeter: number;
  width: number;
  gsm: number;
  care: string;
  supplier: string;
  stock: number;
  rating: number;
  reviews: number;
  image: string;
}

export interface Design {
  id: string;
  name: string;
  designer: string;
  type: string;
  style: string;
  complexity: 'Simple' | 'Medium' | 'Complex';
  rating: number;
  reviews: number;
  basePrice: number;
  designerFee: number;
  estimatedDays: string;
  image: string;
  videoPreview?: string;
  fabricRequirements: {
    type: string;
    minLength: number;
    minWidth: number;
    bestColors: string[];
  };
  measurementsNeeded: string[];
}

export interface Tailor {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviews: number;
  location: string;
  distance: string;
  speciality: string[];
  experience: number;
  responseTime: string;
  basePrice: number;
  estimatedDays: string;
  successRate: number;
  canPickup: boolean;
  pickupCost: number;
  strengths: string[];
  recentReviews: { rating: number; text: string }[];
}

export interface Order {
  id: string;
  customerName: string;
  designName: string;
  status: string;
  statusDetail: string;
  progress: number;
  date: string;
}

export interface MeasurementField {
  id: string;
  name: string;
  description: string;
  videoDuration: string;
  unit: string;
}

export const fabrics: Fabric[] = [
  {
    id: 'fab-001',
    name: 'Maroon Silk Saree',
    material: 'Silk + Cotton Blend',
    color: 'Maroon',
    pricePerMeter: 450,
    width: 60,
    gsm: 280,
    care: 'Hand wash recommended',
    supplier: 'Premium Fabrics Co.',
    stock: 250,
    rating: 4.9,
    reviews: 128,
    image: '',
  },
  {
    id: 'fab-002',
    name: 'Royal Blue Cotton',
    material: 'Pure Cotton',
    color: 'Blue',
    pricePerMeter: 320,
    width: 58,
    gsm: 200,
    care: 'Machine wash cold',
    supplier: 'Cotton Masters',
    stock: 180,
    rating: 4.7,
    reviews: 95,
    image: '',
  },
  {
    id: 'fab-003',
    name: 'White Linen Premium',
    material: 'Pure Linen',
    color: 'White',
    pricePerMeter: 580,
    width: 54,
    gsm: 180,
    care: 'Dry clean only',
    supplier: 'Linen House',
    stock: 120,
    rating: 4.8,
    reviews: 67,
    image: '',
  },
  {
    id: 'fab-004',
    name: 'Gold Thread Silk',
    material: 'Silk',
    color: 'Gold',
    pricePerMeter: 750,
    width: 62,
    gsm: 300,
    care: 'Dry clean only',
    supplier: 'Heritage Silks',
    stock: 80,
    rating: 5.0,
    reviews: 42,
    image: '',
  },
  {
    id: 'fab-005',
    name: 'Emerald Green Blend',
    material: 'Silk + Polyester Blend',
    color: 'Green',
    pricePerMeter: 390,
    width: 56,
    gsm: 240,
    care: 'Hand wash',
    supplier: 'Green Textiles',
    stock: 200,
    rating: 4.6,
    reviews: 78,
    image: '',
  },
  {
    id: 'fab-006',
    name: 'Cream Chiffon',
    material: 'Chiffon',
    color: 'Cream',
    pricePerMeter: 280,
    width: 44,
    gsm: 120,
    care: 'Hand wash delicate',
    supplier: 'Fabric World',
    stock: 300,
    rating: 4.5,
    reviews: 110,
    image: '',
  },
];

export const designs: Design[] = [
  {
    id: 'des-001',
    name: 'Royal Embroidered Saree',
    designer: 'Priya Designs',
    type: 'Saree',
    style: 'Traditional Embroidered',
    complexity: 'Medium',
    rating: 4.8,
    reviews: 128,
    basePrice: 5000,
    designerFee: 500,
    estimatedDays: '10-14',
    image: '',
    fabricRequirements: {
      type: 'Silk Saree or Blend',
      minLength: 6,
      minWidth: 45,
      bestColors: ['Maroon', 'Red', 'Gold', 'Green'],
    },
    measurementsNeeded: ['Bust', 'Waist', 'Hips', 'Blouse Length', 'Sleeve Length', 'Shoulder Width', 'Saree Length'],
  },
  {
    id: 'des-002',
    name: 'Modern Fusion Kurta',
    designer: 'Style Studio',
    type: 'Kurta',
    style: 'Indo-Western Fusion',
    complexity: 'Simple',
    rating: 4.6,
    reviews: 89,
    basePrice: 2500,
    designerFee: 300,
    estimatedDays: '7-10',
    image: '',
    fabricRequirements: {
      type: 'Cotton or Linen',
      minLength: 3,
      minWidth: 44,
      bestColors: ['White', 'Blue', 'Cream'],
    },
    measurementsNeeded: ['Chest', 'Waist', 'Hips', 'Kurta Length', 'Sleeve Length', 'Shoulder Width'],
  },
  {
    id: 'des-003',
    name: 'Bridal Lehenga Collection',
    designer: 'Ananya Couture',
    type: 'Lehenga',
    style: 'Heavy Bridal',
    complexity: 'Complex',
    rating: 4.9,
    reviews: 56,
    basePrice: 15000,
    designerFee: 2000,
    estimatedDays: '20-30',
    image: '',
    fabricRequirements: {
      type: 'Heavy Silk or Velvet',
      minLength: 12,
      minWidth: 50,
      bestColors: ['Red', 'Maroon', 'Gold'],
    },
    measurementsNeeded: ['Bust', 'Waist', 'Hips', 'Lehenga Length', 'Blouse Length', 'Sleeve Length', 'Shoulder Width'],
  },
  {
    id: 'des-004',
    name: 'Casual Cotton Dress',
    designer: 'Fresh Look',
    type: 'Dress',
    style: 'Casual Western',
    complexity: 'Simple',
    rating: 4.5,
    reviews: 203,
    basePrice: 1800,
    designerFee: 200,
    estimatedDays: '5-7',
    image: '',
    fabricRequirements: {
      type: 'Cotton or Blend',
      minLength: 3,
      minWidth: 44,
      bestColors: ['Any'],
    },
    measurementsNeeded: ['Bust', 'Waist', 'Hips', 'Dress Length', 'Shoulder Width'],
  },
  {
    id: 'des-005',
    name: 'Designer Palazzo Set',
    designer: 'Priya Designs',
    type: 'Kurta',
    style: 'Contemporary',
    complexity: 'Medium',
    rating: 4.7,
    reviews: 145,
    basePrice: 3500,
    designerFee: 400,
    estimatedDays: '8-12',
    image: '',
    fabricRequirements: {
      type: 'Cotton or Chiffon',
      minLength: 5,
      minWidth: 44,
      bestColors: ['Cream', 'White', 'Pastel'],
    },
    measurementsNeeded: ['Bust', 'Waist', 'Hips', 'Kurta Length', 'Palazzo Length', 'Sleeve Length'],
  },
  {
    id: 'des-006',
    name: 'Silk Salwar Kameez',
    designer: 'Heritage Designs',
    type: 'Salwar',
    style: 'Traditional',
    complexity: 'Medium',
    rating: 4.8,
    reviews: 92,
    basePrice: 4000,
    designerFee: 450,
    estimatedDays: '10-14',
    image: '',
    fabricRequirements: {
      type: 'Silk or Blend',
      minLength: 5,
      minWidth: 44,
      bestColors: ['Green', 'Blue', 'Maroon'],
    },
    measurementsNeeded: ['Bust', 'Waist', 'Hips', 'Kameez Length', 'Salwar Length', 'Sleeve Length', 'Shoulder Width'],
  },
];

export const tailors: Tailor[] = [
  {
    id: 'tai-001',
    name: 'Raj Tailoring',
    avatar: '',
    rating: 4.9,
    reviews: 245,
    location: 'South Delhi',
    distance: '5km',
    speciality: ['Sarees', 'Lehengas', 'Blouses'],
    experience: 15,
    responseTime: '<2 hours',
    basePrice: 5000,
    estimatedDays: '10-12',
    successRate: 98,
    canPickup: true,
    pickupCost: 150,
    strengths: ['Expert in saree stitching', 'Fast turnaround', 'Quality guaranteed', 'Good communication'],
    recentReviews: [
      { rating: 5, text: 'Perfect fit!' },
      { rating: 5, text: 'Exactly as designed' },
    ],
  },
  {
    id: 'tai-002',
    name: 'Stitch Perfect',
    avatar: '',
    rating: 4.8,
    reviews: 189,
    location: 'Central Delhi',
    distance: '8km',
    speciality: ['Kurtas', 'Dresses', 'Fusion Wear'],
    experience: 12,
    responseTime: '<1 hour',
    basePrice: 4500,
    estimatedDays: '8-10',
    successRate: 96,
    canPickup: true,
    pickupCost: 100,
    strengths: ['Fast delivery', 'Great with fusion designs', 'Very responsive', 'Fair pricing'],
    recentReviews: [
      { rating: 5, text: 'Amazing work on my kurta!' },
      { rating: 4, text: 'Good quality, slight delay' },
    ],
  },
  {
    id: 'tai-003',
    name: 'Elite Stitch House',
    avatar: '',
    rating: 4.7,
    reviews: 156,
    location: 'East Delhi',
    distance: '12km',
    speciality: ['Lehengas', 'Bridal Wear', 'Sarees'],
    experience: 20,
    responseTime: '<3 hours',
    basePrice: 6000,
    estimatedDays: '12-15',
    successRate: 99,
    canPickup: false,
    pickupCost: 0,
    strengths: ['Bridal specialist', '20+ years experience', 'Premium finishing', 'Detailed craftsmanship'],
    recentReviews: [
      { rating: 5, text: 'My bridal lehenga was perfect!' },
      { rating: 5, text: 'Exceptional craftsmanship' },
    ],
  },
  {
    id: 'tai-004',
    name: 'Quick Stitch Studio',
    avatar: '',
    rating: 4.5,
    reviews: 312,
    location: 'North Delhi',
    distance: '6km',
    speciality: ['Kurtas', 'Casual Wear', 'Alterations'],
    experience: 8,
    responseTime: '<30 min',
    basePrice: 2000,
    estimatedDays: '5-7',
    successRate: 94,
    canPickup: true,
    pickupCost: 80,
    strengths: ['Fastest turnaround', 'Budget friendly', 'Quick responses', 'Good for casual wear'],
    recentReviews: [
      { rating: 4, text: 'Fast and affordable' },
      { rating: 5, text: 'Great value for money' },
    ],
  },
];

export const sampleOrders: Order[] = [
  {
    id: 'Z-2024-00521',
    customerName: 'Sarah',
    designName: 'Saree',
    status: 'Stitching',
    statusDetail: 'In Progress - Day 5/10',
    progress: 50,
    date: '2024-03-15',
  },
  {
    id: 'Z-2024-00520',
    customerName: 'Sarah',
    designName: 'Kurta',
    status: 'Measurements',
    statusDetail: 'Pending Approval',
    progress: 25,
    date: '2024-03-18',
  },
  {
    id: 'Z-2024-00519',
    customerName: 'Sarah',
    designName: 'Lehenga',
    status: 'Delivery',
    statusDetail: 'Ready for Delivery',
    progress: 90,
    date: '2024-03-10',
  },
];

export const measurementFields: MeasurementField[] = [
  { id: 'bust', name: 'Bust', description: 'Full chest measurement at the widest point', videoDuration: '1:30', unit: 'cm' },
  { id: 'waist', name: 'Waist', description: 'Natural waist, where you normally wear pants', videoDuration: '1:45', unit: 'cm' },
  { id: 'hips', name: 'Hips', description: 'Fullest part of hips', videoDuration: '1:20', unit: 'cm' },
  { id: 'blouse-length', name: 'Blouse Length', description: 'Shoulder to waist', videoDuration: '1:15', unit: 'cm' },
  { id: 'sleeve-length', name: 'Sleeve Length', description: 'Shoulder to wrist', videoDuration: '2:00', unit: 'cm' },
  { id: 'shoulder-width', name: 'Shoulder Width', description: 'Point to point across shoulders', videoDuration: '1:10', unit: 'cm' },
  { id: 'saree-length', name: 'Saree Length', description: 'Hip to ankle', videoDuration: '1:30', unit: 'cm' },
];
