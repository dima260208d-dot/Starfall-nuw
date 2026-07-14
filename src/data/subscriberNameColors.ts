/** Prefix for premium Star Guardian name colors stored in `usernameColor`. */
export const SUBSCRIBER_NAME_COLOR_PREFIX = "sg:";

export interface SubscriberNameColorDef {
  id: string;
  /** Solid accent for borders, glows, and swatch fallback. */
  accent: string;
  gradient: string;
  glow: string;
}

/** Seamless looping gradient — same tone at 0% and 100%, no visible seam while animating. */
function seamlessGradient(dark: string, mid: string, bright: string): string {
  return `linear-gradient(90deg, ${dark} 0%, ${mid} 22%, ${bright} 50%, ${mid} 78%, ${dark} 100%)`;
}

function def(id: string, accent: string, glow: string, dark: string, mid: string, bright: string): SubscriberNameColorDef {
  return { id, accent, glow, gradient: seamlessGradient(dark, mid, bright) };
}

export const SUBSCRIBER_NAME_COLORS: readonly SubscriberNameColorDef[] = [
  def("sg:gold", "#FFD740", "rgba(255, 215, 64, 0.65)", "#9A7209", "#FFD54F", "#FFFDE7"),
  def("sg:ruby", "#FF5252", "rgba(255, 82, 82, 0.6)", "#7B0010", "#E53935", "#FFCDD2"),
  def("sg:emerald", "#69F0AE", "rgba(105, 240, 174, 0.55)", "#1B5E20", "#00E676", "#E8F5E9"),
  def("sg:sapphire", "#40C4FF", "rgba(64, 196, 255, 0.55)", "#0D47A1", "#0288D1", "#E1F5FE"),
  def("sg:amethyst", "#CE93D8", "rgba(206, 147, 216, 0.6)", "#4A148C", "#AB47BC", "#F3E5F5"),
  def("sg:sunset", "#FF7043", "rgba(255, 112, 67, 0.55)", "#BF360C", "#FF5722", "#FFCCBC"),
  def("sg:aurora", "#18FFFF", "rgba(24, 255, 255, 0.5)", "#006064", "#00BCD4", "#E0F7FA"),
  def("sg:rose", "#F48FB1", "rgba(244, 143, 177, 0.55)", "#880E4F", "#EC407A", "#FCE4EC"),
  def("sg:lime", "#C6FF00", "rgba(198, 255, 0, 0.5)", "#33691E", "#AEEA00", "#F9FBE7"),
  def("sg:ice", "#B3E5FC", "rgba(179, 229, 252, 0.6)", "#01579B", "#81D4FA", "#FFFFFF"),
  def("sg:flame", "#FF9100", "rgba(255, 145, 0, 0.55)", "#E65100", "#FF6D00", "#FFF3E0"),
  def("sg:cosmic", "#7C4DFF", "rgba(124, 77, 255, 0.55)", "#1A237E", "#536DFE", "#E8EAF6"),
  def("sg:toxic", "#76FF03", "rgba(118, 255, 3, 0.45)", "#1B5E20", "#64DD17", "#F1F8E9"),
  def("sg:candy", "#FF4081", "rgba(255, 64, 129, 0.55)", "#880E4F", "#F50057", "#FCE4EC"),
  def("sg:starlight", "#FFF59D", "rgba(255, 245, 157, 0.65)", "#F57F17", "#FFD54F", "#FFFFFF"),
] as const;

const BY_ID = new Map(SUBSCRIBER_NAME_COLORS.map(c => [c.id, c]));

export function isSubscriberNameColor(value: string | undefined | null): boolean {
  return !!value && value.startsWith(SUBSCRIBER_NAME_COLOR_PREFIX);
}

export function getSubscriberNameColorDef(id: string): SubscriberNameColorDef | null {
  return BY_ID.get(id) ?? null;
}
