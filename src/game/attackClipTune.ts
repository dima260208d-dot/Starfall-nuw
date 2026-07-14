import * as THREE from "three";

export interface AttackClipTune {
  /** Cap clip length (seconds). */
  maxDuration?: number;
  /** Scale translation delta from first keyframe (e.g. hips lunge). */
  translationDeltaScale?: number;
  /** Bone name substrings for translation scaling (default: hips). */
  translationBones?: string[];
  /** Scale arm/hand rotation delta from first keyframe — shorter visual reach. */
  armRotationDeltaScale?: number;
  /** Playback speed while attacking. */
  timeScale?: number;
}

const DEFAULT_TRANS_BONES = ["hips"];

function scaleVectorKeyframeDelta(track: THREE.KeyframeTrack, scale: number): void {
  if (!(track instanceof THREE.VectorKeyframeTrack)) return;
  const v = track.values as number[];
  if (v.length < 3) return;
  const bx = v[0];
  const by = v[1];
  const bz = v[2];
  for (let i = 0; i < v.length; i += 3) {
    v[i] = bx + (v[i] - bx) * scale;
    v[i + 1] = by + (v[i + 1] - by) * scale;
    v[i + 2] = bz + (v[i + 2] - bz) * scale;
  }
}

function scaleQuaternionKeyframeDelta(track: THREE.KeyframeTrack, scale: number): void {
  if (!(track instanceof THREE.QuaternionKeyframeTrack)) return;
  const v = track.values as number[];
  if (v.length < 4) return;
  const bx = v[0];
  const by = v[1];
  const bz = v[2];
  const bw = v[3];
  for (let i = 0; i < v.length; i += 4) {
    let qx = bx + (v[i] - bx) * scale;
    let qy = by + (v[i + 1] - by) * scale;
    let qz = bz + (v[i + 2] - bz) * scale;
    let qw = bw + (v[i + 3] - bw) * scale;
    const len = Math.hypot(qx, qy, qz, qw) || 1;
    qx /= len;
    qy /= len;
    qz /= len;
    qw /= len;
    v[i] = qx;
    v[i + 1] = qy;
    v[i + 2] = qz;
    v[i + 3] = qw;
  }
}

function trimClipDuration(clip: THREE.AnimationClip, maxDuration: number): void {
  clip.duration = Math.min(clip.duration, maxDuration);
  for (const track of clip.tracks) {
    const times = track.times;
    let lastIdx = times.length - 1;
    while (lastIdx > 0 && times[lastIdx] > maxDuration) lastIdx--;
    if (lastIdx < times.length - 1) {
      track.trim(0, lastIdx + 1);
    }
  }
}

function boneNameFromTrack(track: THREE.KeyframeTrack): string {
  const dot = track.name.indexOf(".");
  return dot >= 0 ? track.name.slice(0, dot) : track.name;
}

/** Clone attack clip and tighten lunge / arm extension so VFX range matches gameplay. */
export function tuneAttackClip(clip: THREE.AnimationClip, tune: AttackClipTune): THREE.AnimationClip {
  const out = clip.clone();
  if (tune.maxDuration != null) trimClipDuration(out, tune.maxDuration);

  const transBones = (tune.translationBones ?? DEFAULT_TRANS_BONES).map(b => b.toLowerCase());
  const transScale = tune.translationDeltaScale ?? 1;
  const armScale = tune.armRotationDeltaScale ?? 1;

  for (const track of out.tracks) {
    const bone = boneNameFromTrack(track).toLowerCase();
    if (transScale !== 1 && transBones.some(t => bone.includes(t)) && track.name.endsWith(".position")) {
      scaleVectorKeyframeDelta(track, transScale);
    }
    if (armScale !== 1 && /arm|hand|forearm|shoulder/i.test(bone) && track.name.endsWith(".quaternion")) {
      scaleQuaternionKeyframeDelta(track, armScale);
    }
  }
  return out;
}
