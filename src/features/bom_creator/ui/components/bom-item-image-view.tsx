import Image from "next/image";

const NEXT_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

export function BomItemImageView({
  alt,
  className,
  loading = "lazy",
  mimeType,
  sizes,
  src
}: {
  alt: string;
  className: string;
  loading?: "eager" | "lazy";
  mimeType: string;
  sizes: string;
  src: string;
}) {
  if (src.startsWith("data:") || !NEXT_IMAGE_MIME_TYPES.has(mimeType)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        decoding="async"
        loading={loading}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      fill
      loading={loading}
      sizes={sizes}
    />
  );
}
