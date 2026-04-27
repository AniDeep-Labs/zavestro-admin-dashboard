export interface DesignerProfile {
  id: string;
  brandName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  experience: string;
  specialties: string[];
  bio: string;
  avatar: string;
  rating: number;
  reviews: number;
  followers: number;
  memberSince: string;
  instagram: string;
  website: string;
  totalDesigns: number;
  totalOrders: number;
  satisfaction: number;
}

export interface DesignerDesign {
  id: string;
  name: string;
  category: string;
  style: string;
  status: 'published' | 'draft' | 'archived';
  rating: number;
  reviews: number;
  views: number;
  orders: number;
  earningsThisMonth: number;
  earningsTotal: number;
  createdDate: string;
  image: string;
}

export interface DesignerOrder {
  id: string;
  customerName: string;
  designName: string;
  status: 'In Stitching' | 'Completed' | 'Delivered' | 'Pending';
  earned: number;
  isPending: boolean;
  rating?: number;
  review?: string;
  date: string;
}

export interface PayoutEntry {
  id: string;
  date: string;
  amount: number;
  status: 'Completed' | 'Processing' | 'Scheduled';
}

export interface DesignerStats {
  designViews: number;
  newFollowers: number;
  ordersPlaced: number;
  earnings: number;
  avgRating: number;
}

export interface DesignAnalytics {
  totalViews: number;
  totalOrders: number;
  totalRevenue: number;
  avgRating: number;
  conversionRate: number;
  viewsCurrentMonth: number;
  viewsPreviousMonth: number;
  viewsGrowth: number;
  ordersCurrentMonth: number;
  ordersPreviousMonth: number;
  ordersGrowth: number;
  reviewBreakdown: { stars: number; count: number }[];
  popularTailors: { name: string; orders: number }[];
  demographics: {
    ageGroups: { label: string; percentage: number }[];
    topCities: string[];
    repeatCustomers: number;
  };
}

export interface EarningsSummary {
  totalAllTime: number;
  thisMonth: number;
  thisWeek: number;
  availablePayout: number;
  lastPayoutAmount: number;
  lastPayoutDate: string;
  nextPayoutDate: string;
  payoutFrequency: string;
}

export interface BankDetails {
  holderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

export const designerProfile: DesignerProfile = {
  id: 'designer-001',
  brandName: 'Priya Designs',
  ownerName: 'Priya Kumar',
  email: 'priya@designs.com',
  phone: '+91 98765 43210',
  city: 'New Delhi, Delhi',
  experience: '5-10 years',
  specialties: ['Sarees', 'Lehengas', 'Fusion Wear', 'Custom Designs'],
  bio: 'Creating timeless traditional and fusion designs. Passion for intricate embroidery & details.',
  avatar: '',
  rating: 4.8,
  reviews: 245,
  followers: 5250,
  memberSince: 'Jan 2018',
  instagram: '@priyadesigns',
  website: 'priyadesigns.com',
  totalDesigns: 45,
  totalOrders: 1250,
  satisfaction: 98,
};

export const designerStats: DesignerStats = {
  designViews: 12450,
  newFollowers: 320,
  ordersPlaced: 45,
  earnings: 22500,
  avgRating: 4.8,
};

export const designerDesigns: DesignerDesign[] = [
  {
    id: 'dd-001',
    name: 'Royal Embroidered Saree',
    category: 'Saree',
    style: 'Traditional Embroidered',
    status: 'published',
    rating: 4.8,
    reviews: 128,
    views: 5200,
    orders: 32,
    earningsThisMonth: 16000,
    earningsTotal: 48000,
    createdDate: 'Jan 15, 2024',
    image: '',
  },
  {
    id: 'dd-002',
    name: 'Modern Fusion Kurta',
    category: 'Kurta',
    style: 'Indo-Western Fusion',
    status: 'published',
    rating: 4.6,
    reviews: 89,
    views: 3100,
    orders: 8,
    earningsThisMonth: 4000,
    earningsTotal: 12000,
    createdDate: 'Feb 20, 2024',
    image: '',
  },
  {
    id: 'dd-003',
    name: 'Embroidered Lehenga',
    category: 'Lehenga',
    style: 'Heavy Bridal',
    status: 'published',
    rating: 4.9,
    reviews: 56,
    views: 2800,
    orders: 5,
    earningsThisMonth: 2500,
    earningsTotal: 10000,
    createdDate: 'Mar 1, 2024',
    image: '',
  },
  {
    id: 'dd-004',
    name: 'Contemporary Palazzo Set',
    category: 'Kurta',
    style: 'Contemporary',
    status: 'published',
    rating: 4.7,
    reviews: 67,
    views: 1900,
    orders: 12,
    earningsThisMonth: 3600,
    earningsTotal: 14400,
    createdDate: 'Dec 10, 2023',
    image: '',
  },
  {
    id: 'dd-005',
    name: 'Silk Salwar Kameez',
    category: 'Salwar',
    style: 'Traditional',
    status: 'draft',
    rating: 0,
    reviews: 0,
    views: 0,
    orders: 0,
    earningsThisMonth: 0,
    earningsTotal: 0,
    createdDate: 'Mar 10, 2024',
    image: '',
  },
  {
    id: 'dd-006',
    name: 'Classic Cotton Kurta',
    category: 'Kurta',
    style: 'Casual',
    status: 'archived',
    rating: 4.3,
    reviews: 34,
    views: 800,
    orders: 3,
    earningsThisMonth: 0,
    earningsTotal: 1500,
    createdDate: 'Aug 5, 2023',
    image: '',
  },
];

export const designerOrders: DesignerOrder[] = [
  {
    id: 'do-001',
    customerName: 'Sarah M.',
    designName: 'Royal Embroidered Saree',
    status: 'In Stitching',
    earned: 500,
    isPending: true,
    date: 'Mar 18, 2024',
  },
  {
    id: 'do-002',
    customerName: 'Priya K.',
    designName: 'Royal Embroidered Saree',
    status: 'Delivered',
    earned: 500,
    isPending: false,
    rating: 5,
    review: 'Perfect fit!',
    date: 'Mar 15, 2024',
  },
  {
    id: 'do-003',
    customerName: 'Ananya S.',
    designName: 'Modern Fusion Kurta',
    status: 'Delivered',
    earned: 500,
    isPending: false,
    rating: 5,
    review: 'Exactly as imagined',
    date: 'Mar 12, 2024',
  },
  {
    id: 'do-004',
    customerName: 'Meera R.',
    designName: 'Embroidered Lehenga',
    status: 'Completed',
    earned: 2000,
    isPending: false,
    rating: 5,
    review: 'Beautiful bridal lehenga!',
    date: 'Mar 8, 2024',
  },
  {
    id: 'do-005',
    customerName: 'Kavita L.',
    designName: 'Contemporary Palazzo Set',
    status: 'In Stitching',
    earned: 400,
    isPending: true,
    date: 'Mar 19, 2024',
  },
];

export const designAnalytics: DesignAnalytics = {
  totalViews: 5200,
  totalOrders: 32,
  totalRevenue: 48000,
  avgRating: 4.8,
  conversionRate: 0.6,
  viewsCurrentMonth: 1200,
  viewsPreviousMonth: 980,
  viewsGrowth: 22.4,
  ordersCurrentMonth: 8,
  ordersPreviousMonth: 6,
  ordersGrowth: 33,
  reviewBreakdown: [
    { stars: 5, count: 110 },
    { stars: 4, count: 15 },
    { stars: 3, count: 3 },
    { stars: 2, count: 0 },
    { stars: 1, count: 0 },
  ],
  popularTailors: [
    { name: 'Raj Tailoring', orders: 12 },
    { name: 'Neha Designs', orders: 8 },
    { name: 'Master Tailors', orders: 7 },
  ],
  demographics: {
    ageGroups: [
      { label: '25-35', percentage: 60 },
      { label: '35-45', percentage: 25 },
      { label: 'Other', percentage: 15 },
    ],
    topCities: ['Delhi', 'Mumbai', 'Bangalore'],
    repeatCustomers: 12,
  },
};

export const earningsSummary: EarningsSummary = {
  totalAllTime: 145230,
  thisMonth: 22500,
  thisWeek: 5200,
  availablePayout: 5340,
  lastPayoutAmount: 10000,
  lastPayoutDate: 'Mar 10',
  nextPayoutDate: 'Mar 15, 2024',
  payoutFrequency: 'Monthly on 15th',
};

export const bankDetails: BankDetails = {
  holderName: 'Priya Kumar',
  bankName: 'ICICI Bank',
  accountNumber: '••••••••9876',
  ifscCode: 'ICIC0000123',
};

export const payoutHistory: PayoutEntry[] = [
  { id: 'pay-001', date: 'Mar 10, 2024', amount: 10000, status: 'Completed' },
  { id: 'pay-002', date: 'Feb 15, 2024', amount: 8500, status: 'Completed' },
  { id: 'pay-003', date: 'Jan 15, 2024', amount: 9230, status: 'Completed' },
  { id: 'pay-004', date: 'Dec 15, 2023', amount: 7800, status: 'Completed' },
];

export const customerReviews = [
  {
    id: 'rev-001',
    customerName: 'Sarah J.',
    rating: 5,
    text: 'The saree turned out amazing. Exactly as I imagined. Highly recommend!',
    verified: true,
    date: 'Mar 14, 2024',
  },
  {
    id: 'rev-002',
    customerName: 'Priya K.',
    rating: 5,
    text: 'Beautiful design with perfect execution',
    verified: true,
    date: 'Mar 10, 2024',
  },
  {
    id: 'rev-003',
    customerName: 'Ananya R.',
    rating: 4,
    text: 'Great design, minor adjustment needed but overall very happy',
    verified: true,
    date: 'Mar 5, 2024',
  },
  {
    id: 'rev-004',
    customerName: 'Meera S.',
    rating: 5,
    text: 'Stunning bridal lehenga! Everyone at the wedding loved it.',
    verified: true,
    date: 'Feb 28, 2024',
  },
];
