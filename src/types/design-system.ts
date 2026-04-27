export interface Color {
  primary: string;
  primaryLight: string;
  primaryLighter: string;
  primaryDark: string;
  primaryDarker: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  border: string;
}

export interface Spacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface Typography {
  fontSize: Record<'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl', string>;
  fontWeight: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'extraBold', number>;
  lineHeight: Record<'tight' | 'normal' | 'relaxed' | 'loose', number>;
  letterSpacing: Record<'tight' | 'normal' | 'wide' | 'wider', string>;
}

export interface Shadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  emerald: string;
  gold: string;
}

export interface Radius {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  full: string;
}

export interface Transitions {
  fast: string;
  normal: string;
  slow: string;
}

export interface Breakpoint {
  mobile: number;
  tablet: number;
  desktop: number;
  wide: number;
}

export interface ZIndex {
  dropdown: number;
  sticky: number;
  fixed: number;
  modal: number;
  tooltip: number;
}

export interface DesignSystem {
  colors: Color;
  spacing: Spacing;
  typography: Typography;
  shadows: Shadows;
  radius: Radius;
  transitions: Transitions;
  breakpoints: Breakpoint;
  zIndex: ZIndex;
}
