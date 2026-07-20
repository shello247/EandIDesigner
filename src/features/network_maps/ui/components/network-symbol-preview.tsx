"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function NetworkSymbolPreview({
  src,
  name
}: {
  src: string;
  name: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="relative flex h-14 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      {!isLoaded && !hasError ? (
        <div
          className="absolute inset-0 animate-pulse bg-slate-100"
          data-testid="network-preview-loading"
          aria-label={`Loading preview for ${name}`}
        />
      ) : null}
      {hasError ? (
        <div
          className="flex flex-col items-center gap-1 px-1 text-center text-[9px] leading-tight text-slate-500"
          data-testid="network-preview-error"
        >
          <ImageOff aria-hidden="true" size={15} />
          Preview unavailable
        </div>
      ) : (
        <Image
          src={src}
          alt={`Preview of ${name}`}
          width={72}
          height={56}
          className={[
            "h-full w-full object-contain p-1 transition-opacity",
            isLoaded ? "opacity-100" : "opacity-0"
          ].join(" ")}
          loading="lazy"
          unoptimized
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}
