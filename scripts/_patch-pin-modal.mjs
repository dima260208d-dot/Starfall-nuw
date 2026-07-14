import fs from "fs";

const p = "src/components/PinSelectModal.tsx";
let s = fs.readFileSync(p, "utf8");
const marker = "<motionPinModalHeader";
const idx = s.indexOf(marker);
if (idx === -1) throw new Error("marker not found");

const head = s.slice(0, idx);

const rest = `          <motionPinModalHeader
`;

// Actually build proper tail without motion tags
const tail = `          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>💬</span>
            <motionPinModalHeader
`;
