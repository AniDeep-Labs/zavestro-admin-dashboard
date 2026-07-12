/**
 * Starter templates — one-click canvas layouts. Geometry is %-based so a template
 * fits any banner/collection ratio. Headline/subtitle elements are pre-bound to the
 * Content fields (Batch C), so they sync the moment a template is applied.
 */

import type { CanvasDoc, CanvasElement, CanvasBackground } from './canvasTypes';
import { DEFAULT_ELEMENT, newId } from './canvasTypes';

export interface TemplateBg { color1: string; color2: string; angle: number }

const text = (p: Partial<CanvasElement>): CanvasElement => ({ id: newId(), ...DEFAULT_ELEMENT.text(), ...p });
const button = (p: Partial<CanvasElement>): CanvasElement => ({ id: newId(), ...DEFAULT_ELEMENT.button(), ...p });
const ellipse = (p: Partial<CanvasElement>): CanvasElement => ({ id: newId(), ...DEFAULT_ELEMENT.ellipse(), ...p });
const image = (p: Partial<CanvasElement>): CanvasElement => ({ id: newId(), ...DEFAULT_ELEMENT.image(), ...p });

const bg = (b: TemplateBg, type: CanvasBackground['type'] = 'gradient'): CanvasBackground => ({
  type, color1: b.color1, color2: b.color2, angle: b.angle, fit: 'cover', focalX: 50, focalY: 50, overlay: type === 'image' ? 45 : 0,
});

export interface CanvasTemplate { id: string; label: string; build: (b: TemplateBg) => CanvasDoc }

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'centered', label: 'Centered',
    build: (b) => ({ version: 1, background: bg(b), elements: [
      text({ text: 'Your headline', x: 12, y: 28, w: 76, h: 20, align: 'center', size: 7.5, bind: 'title' }),
      text({ text: 'A short supporting line', x: 18, y: 50, w: 64, h: 9, align: 'center', size: 3.2, weight: 500, bind: 'subtitle' }),
      button({ text: 'Shop Now', x: 38, y: 68, w: 24, h: 11, align: 'center' }),
    ] }),
  },
  {
    id: 'left-editorial', label: 'Left editorial',
    build: (b) => ({ version: 1, background: bg(b), elements: [
      text({ text: 'NEW ARRIVALS', x: 7, y: 18, w: 44, h: 6, align: 'left', size: 2.6, weight: 700, letterSpacing: 8 }),
      text({ text: 'Your headline', x: 7, y: 28, w: 58, h: 26, align: 'left', size: 7.5, bind: 'title' }),
      text({ text: 'A short supporting line', x: 7, y: 60, w: 50, h: 10, align: 'left', size: 3, weight: 500, bind: 'subtitle' }),
      button({ text: 'Shop Now', x: 7, y: 76, w: 24, h: 11, align: 'center' }),
    ] }),
  },
  {
    id: 'split', label: 'Split image + text',
    build: (b) => ({ version: 1, background: bg(b), elements: [
      image({ x: 52, y: 6, w: 42, h: 88 }),
      text({ text: 'Your headline', x: 6, y: 26, w: 42, h: 22, align: 'left', size: 6.5, bind: 'title' }),
      text({ text: 'A short supporting line', x: 6, y: 54, w: 40, h: 10, align: 'left', size: 3, weight: 500, bind: 'subtitle' }),
      button({ text: 'Shop Now', x: 6, y: 72, w: 26, h: 11, align: 'center' }),
    ] }),
  },
  {
    id: 'sale-badge', label: 'Sale badge',
    build: (b) => ({ version: 1, background: bg(b), elements: [
      text({ text: 'Your headline', x: 6, y: 34, w: 54, h: 22, align: 'left', size: 7.5, bind: 'title' }),
      text({ text: 'A short supporting line', x: 6, y: 58, w: 46, h: 8, align: 'left', size: 2.8, weight: 500, bind: 'subtitle' }),
      button({ text: 'Shop Now', x: 6, y: 72, w: 26, h: 11, align: 'center' }),
      ellipse({ x: 69, y: 12, w: 25, h: 25, fill: '#C9995E' }),
      text({ text: '50%\nOFF', x: 69, y: 12, w: 25, h: 25, align: 'center', size: 4, weight: 800, color: '#ffffff', rotation: -8, lineHeight: 100 }),
    ] }),
  },
  {
    id: 'minimal', label: 'Minimal wordmark',
    build: (b) => ({ version: 1, background: bg(b, 'solid'), elements: [
      text({ text: 'Your headline', x: 10, y: 38, w: 80, h: 24, align: 'center', font: 'display', size: 9, weight: 600, bind: 'title' }),
      text({ text: 'A short supporting line', x: 25, y: 64, w: 50, h: 8, align: 'center', size: 2.6, weight: 500, letterSpacing: 6, bind: 'subtitle' }),
    ] }),
  },
  {
    id: 'full-image', label: 'Full-bleed image',
    build: (b) => ({ version: 1, background: bg(b, 'image'), elements: [
      text({ text: 'Your headline', x: 6, y: 52, w: 70, h: 20, align: 'left', size: 7.5, bind: 'title' }),
      text({ text: 'A short supporting line', x: 6, y: 74, w: 60, h: 8, align: 'left', size: 2.8, weight: 500, bind: 'subtitle' }),
      button({ text: 'Shop Now', x: 6, y: 85, w: 24, h: 10, align: 'center' }),
    ] }),
  },
];
