import React from 'react';
import { R2_PUBLIC_URL } from '../../api/adminApi';
import { SafeImg } from './SafeImg';
import s from './FabricSwatch.module.css';

/**
 * [KA4-7] / [KA4-11] The one definition of a fabric swatch.
 *
 * This was six hand-rolled copies across Distribution, Cross-hub Stock and Central Stock,
 * each rendering `<img>` or a filled `<div>`/`<span>` of the same class. Two things were
 * wrong with the filled fallback, and they pull in opposite directions:
 *
 *   - it was painted `--color-bg-section`, a pale mint, so it read as a COLOUR CHIP. Every
 *     fabric without an image asserted the same colour — and this is the screen where
 *     colour is the fabric's identity;
 *   - Central Stock's variant put an image glyph in it, so it read as a FAILED image.
 *
 * The empty state is now transparent with a dashed rule: it holds the row's alignment,
 * claims no colour, and says "nothing on file" rather than "something went wrong". A key
 * that 404s falls back to the same placeholder via SafeImg, so a dead key and a missing one
 * look alike — which is honest, because to the operator they are the same fact.
 */
export const FabricSwatch: React.FC<{
  imageKeys?: string[] | null;
  /** Rows are 'sm' (34px); Central Stock's thumbnails are 'md' (40px). */
  size?: 'sm' | 'md';
  /** The fabric's name, for the placeholder's accessible label. */
  name?: string | null;
}> = ({ imageKeys, size = 'sm', name }) => {
  const key = imageKeys?.[0];
  const src = key && R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : '';
  const box = s[size];
  return (
    <SafeImg
      src={src}
      alt=""
      className={`${s.swatch} ${box}`}
      fallback={
        <span
          className={`${s.empty} ${box}`}
          title={name ? `No swatch image on file for ${name}` : 'No swatch image on file'}
          aria-label={name ? `No swatch image for ${name}` : 'No swatch image'}
        />
      }
    />
  );
};
