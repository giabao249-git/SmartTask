import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0B132B 0%, #1C2541 50%, #0F172A 100%)",
          borderRadius: 40,
          border: "2px solid rgba(255, 255, 255, 0.2)",
          position: "relative",
        }}
      >
        <svg
          width="130"
          height="130"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 14 18 C 14 13.5, 18 11, 24 11 C 30.5 11, 34 13.5, 34 17.5 C 34 21.5, 29.5 23.2, 24 24.5 C 18.5 25.8, 14 27.5, 14 31.8 C 14 36, 18.5 38.5, 24.5 38.5 C 31 38.5, 34.5 35.8, 35.5 31.5"
            stroke="#6366F1"
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 19 25.5 L 23.5 30 L 33.5 18.5"
            stroke="#38BDF8"
            strokeWidth="3.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M 37 6.5 C 37 9, 38.5 10.5, 41 10.5 C 38.5 10.5, 37 12, 37 14.5 C 37 12, 35.5 10.5, 33 10.5 C 35.5 10.5, 37 9, 37 6.5 Z"
            fill="#FACC15"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
