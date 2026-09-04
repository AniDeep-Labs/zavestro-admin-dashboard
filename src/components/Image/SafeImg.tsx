import React from 'react';

/**
 * An `<img>` that cannot render as a broken image.
 *
 * A key in R2 can outlive the object it points at. A bare `<img>` then paints the browser's
 * own broken-image glyph — sometimes with the alt text inside it, so a fabric called
 * "Chambray" appears as a FAILED GRAPHIC rather than as the fabric it names. It reads as a
 * broken PAGE rather than a missing FILE, which is the wrong diagnosis to hand someone: on a
 * sample review it is the hero a reviewer is asked to judge a garment by.
 *
 * "Present but unfetchable" is a third state, distinct from "nothing was ever uploaded".
 * `fallback` is what stands in its place — usually the same placeholder the no-key branch
 * already renders, so the two absences look alike and neither looks like breakage.
 *
 * A drop-in for `<img>`: same props, same markup, no wrapper — unlike `Image`, which adds a
 * sized div and a loading skeleton and so cannot replace an img inside an existing layout.
 * Enforced by `scripts/check-image-fallback.mjs`.
 */
export type SafeImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Rendered instead of the image when `src` is empty or the fetch fails. */
  fallback?: React.ReactNode;
};

export const SafeImg: React.FC<SafeImgProps> = ({ fallback = null, onError, src, ...rest }) => {
  const [broken, setBroken] = React.useState(false);
  // Reset on a new src, or replacing a dead image would keep showing the fallback.
  React.useEffect(() => {
    setBroken(false);
  }, [src]);

  if (!src || broken) return <>{fallback}</>;
  return (
    <img
      {...rest}
      src={src}
      onError={(e) => {
        setBroken(true);
        onError?.(e);
      }}
    />
  );
};

export default SafeImg;
