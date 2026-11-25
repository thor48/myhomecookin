/* eslint-disable @next/next/no-img-element -- static brand images */

/**
 * The logo built from layers so the spoon and steam can move (see globals.css
 * and scripts/make-brand-assets.mjs). Spoon and steam images are shared; only
 * the base and the offset differ between the two versions.
 *   mark    — the house on its own (header), 484×618
 *   stacked — house + "MyHome Cookin'" + domain (login page), 632×1080
 *
 * motion: "load"  plays one stir and steam puff when the page loads
 *         "stir"  keeps stirring (while signing in)
 *         "still" no motion
 */
const VARIANTS = {
  mark: { base: "/brand/logo-mark-base.png", w: 484, h: 618, dx: 0 },
  stacked: { base: "/brand/logo-primary-base.png", w: 632, h: 1080, dx: 74 },
} as const;

const SPOON = { left: 352, top: 104, width: 86 };
const STEAM = { left: 362, top: 6, width: 74 };

export function AnimatedMark({
  variant = "mark",
  motion = "load",
  alt = "",
  className = "",
}: {
  variant?: keyof typeof VARIANTS;
  motion?: "load" | "stir" | "still";
  alt?: string;
  className?: string;
}) {
  const v = VARIANTS[variant];
  const pct = (n: number, of: number) => `${(n / of) * 100}%`;
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      className={`logo-motion-${motion} relative inline-block ${className}`}
      style={{ aspectRatio: `${v.w} / ${v.h}` }}
    >
      <img src={v.base} alt="" className="absolute inset-0 size-full" />
      <img
        src="/brand/logo-mark-spoon.png"
        alt=""
        className="logo-spoon absolute"
        style={{ left: pct(SPOON.left + v.dx, v.w), top: pct(SPOON.top, v.h), width: pct(SPOON.width, v.w) }}
      />
      <img
        src="/brand/logo-mark-steam.png"
        alt=""
        className="logo-steam absolute"
        style={{ left: pct(STEAM.left + v.dx, v.w), top: pct(STEAM.top, v.h), width: pct(STEAM.width, v.w) }}
      />
    </span>
  );
}
