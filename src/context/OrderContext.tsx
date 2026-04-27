import React, { createContext, useContext, useReducer } from 'react';
import type { Fabric, Design, Tailor } from '../data/mockData';

export interface OwnFabricDetails {
  type: string;
  color: string;
  quantity: string;
  condition: 'new' | 'worn' | 'stained';
  details: string;
  photos: string[];
  pickupAddress: string;
  readyToPickup: boolean;
  pickupDate: string;
}

export interface MeasurementEntry {
  id: string;
  value: string;
  confirmed: boolean;
}

export interface OrderState {
  fabricSource: 'zavestro' | 'own' | null;
  selectedFabric: Fabric | null;
  ownFabricDetails: OwnFabricDetails | null;
  selectedDesign: Design | null;
  measurementMethod: 'self' | 'professional' | null;
  measurements: Record<string, MeasurementEntry>;
  selectedTailor: Tailor | null;
  fabricMeters: number;
  couponCode: string;
  step: number;
}

type OrderAction =
  | { type: 'SET_FABRIC_SOURCE'; payload: 'zavestro' | 'own' }
  | { type: 'SET_SELECTED_FABRIC'; payload: Fabric }
  | { type: 'SET_OWN_FABRIC'; payload: OwnFabricDetails }
  | { type: 'SET_DESIGN'; payload: Design }
  | { type: 'SET_MEASUREMENT_METHOD'; payload: 'self' | 'professional' }
  | { type: 'SET_MEASUREMENT'; payload: { id: string; value: string; confirmed: boolean } }
  | { type: 'SET_TAILOR'; payload: Tailor }
  | { type: 'SET_FABRIC_METERS'; payload: number }
  | { type: 'SET_COUPON'; payload: string }
  | { type: 'SET_STEP'; payload: number }
  | { type: 'RESET' };

const initialState: OrderState = {
  fabricSource: null,
  selectedFabric: null,
  ownFabricDetails: null,
  selectedDesign: null,
  measurementMethod: null,
  measurements: {},
  selectedTailor: null,
  fabricMeters: 0,
  couponCode: '',
  step: 0,
};

function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case 'SET_FABRIC_SOURCE':
      return { ...state, fabricSource: action.payload, selectedFabric: null, ownFabricDetails: null };
    case 'SET_SELECTED_FABRIC':
      return { ...state, selectedFabric: action.payload };
    case 'SET_OWN_FABRIC':
      return { ...state, ownFabricDetails: action.payload };
    case 'SET_DESIGN':
      return { ...state, selectedDesign: action.payload };
    case 'SET_MEASUREMENT_METHOD':
      return { ...state, measurementMethod: action.payload };
    case 'SET_MEASUREMENT':
      return {
        ...state,
        measurements: {
          ...state.measurements,
          [action.payload.id]: { id: action.payload.id, value: action.payload.value, confirmed: action.payload.confirmed },
        },
      };
    case 'SET_TAILOR':
      return { ...state, selectedTailor: action.payload };
    case 'SET_FABRIC_METERS':
      return { ...state, fabricMeters: action.payload };
    case 'SET_COUPON':
      return { ...state, couponCode: action.payload };
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const OrderContext = createContext<{
  state: OrderState;
  dispatch: React.Dispatch<OrderAction>;
} | null>(null);

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(orderReducer, initialState);
  return (
    <OrderContext.Provider value={{ state, dispatch }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrder must be used within OrderProvider');
  return context;
};
