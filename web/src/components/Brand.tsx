import { useMemo, useState } from "react";

interface BrandProps {
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Brand({ size = "md" }: BrandProps) {
  const [imgOk, setImgOk] = useState<boolean>(true);

  const { boxClass, imgClass } = useMemo(() => {
    if (size === "xl") {
      return { boxClass: "h-16 px-4", imgClass: "h-14 w-auto" };
    }
    if (size === "lg") {
      return { boxClass: "h-12 px-3", imgClass: "h-11 w-auto" };
    }
    if (size === "sm") {
      return { boxClass: "h-10 px-2", imgClass: "h-9 w-auto" };
    }
    return { boxClass: "h-11 px-2.5", imgClass: "h-10 w-auto" };
  }, [size]);

  return (
    <div
      className={`${boxClass} inline-flex items-center justify-center rounded-xl bg-transparent`}
      aria-label="Red Ember"
    >
      {imgOk ? (
        <img
          src="/assets/redember-transparent.png"
          alt="Red Ember"
          width={1536}
          height={1024}
          className={`${imgClass} object-contain`}
          draggable={false}
          loading="eager"
          decoding="async"
          onLoad={() => setImgOk(true)}
          onError={() => setImgOk(false)}
        />
      ) : (
        <span
          className="material-symbols-outlined text-primary"
          aria-hidden="true"
        >
          local_fire_department
        </span>
      )}
    </div>
  );
}
