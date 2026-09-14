import { Sparkles } from "lucide-react";

export function FotoModelo({
  src,
  alt,
  className = "",
  imgClassName = "",
}: {
  src?: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  if (!src) {
    return (
      <div
        className={`grid place-items-center bg-gradient-soft ${className}`}
        role="img"
        aria-label={alt}
      >
        <Sparkles className="size-10 text-secondary" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={800}
      height={800}
      loading="lazy"
      decoding="async"
      className={imgClassName || className}
    />
  );
}
