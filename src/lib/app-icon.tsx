import { ImageResponse } from "next/og";
import { SITE_NAME } from "./site";

/**
 * Square app icon rendered on the server, so there are no image files to
 * maintain. Uses a plain letter (not an emoji) so nothing is fetched from
 * the internet at render time.
 */
export function appIcon(size: number, { maskable = false } = {}) {
  const letter = SITE_NAME.trim().charAt(0).toUpperCase() || "R";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b6461b",
          color: "#faf7f2",
          borderRadius: maskable ? 0 : size * 0.22,
          fontSize: size * (maskable ? 0.42 : 0.58),
          fontWeight: 700,
        }}
      >
        {letter}
      </div>
    ),
    { width: size, height: size },
  );
}
