/**
 * <picture> with AVIF + WebP sources when the photo has web-sized variants,
 * otherwise a plain <img> of the original. `sizes` tells the browser how wide
 * the image is drawn so it picks the smallest variant that looks sharp.
 */
import { imageUrl, hasVariants, srcSet, variantUrl, widthAtMost } from '../imageUrl.js'

export default function Picture({
  photo,
  sizes,
  minWidth = 0,
  maxWidth = 1600,
  fallbackWidth = 960,
  ...imgProps
}) {
  if (!hasVariants(photo)) {
    return <img src={imageUrl(photo.thumb)} {...imgProps} />
  }
  const fallback = variantUrl(photo, widthAtMost(photo, fallbackWidth), 'webp')
  return (
    <picture>
      <source type="image/avif" srcSet={srcSet(photo, 'avif', minWidth, maxWidth)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(photo, 'webp', minWidth, maxWidth)} sizes={sizes} />
      <img src={fallback} {...imgProps} />
    </picture>
  )
}
