import fs from "fs";

const path = "src/components/PinSelectModal.tsx";
const headEnd = '            </motionPinModalHeader';
let head = fs.readFileSync(path, "utf8");
const bad = head.indexOf(headEnd);
if (bad === -1) throw new Error("bad marker");
head = head.slice(0, bad);

const tail = `            </motionPinModalHeader`;
