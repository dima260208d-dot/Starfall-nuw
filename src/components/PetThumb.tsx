import type { PetDef } from "../entities/PetData";

const base = import.meta.env.BASE_URL;

export default function PetThumb({ pet, size = 72 }: { pet: PetDef; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 50% 60%, ${pet.color}44 0%, ${pet.secondaryColor}22 55%, transparent 72%)`,
        border: `2px solid ${pet.color}99`,
        boxShadow: `0 0 ${Math.max(8, size * 0.12)}px ${pet.color}55`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <img
        src={`${base}pets/art/${pet.id}.png`}
        alt=""
        draggable={false}
        style={{
          width: "88%",
          height: "88%",
          objectFit: "contain",
          filter: `drop-shadow(0 2px 6px ${pet.color}88)`,
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </div>
  );
}
