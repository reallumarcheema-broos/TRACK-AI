import type { Vec3 } from './vec';

/** MediaPipe Pose (BlazePose GHUM) landmark indices. "Left" is the athlete's own left side. */
export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export const LANDMARK_COUNT = 33;

export interface Landmark extends Vec3 {
  /** 0..1 likelihood that the landmark is visible (not occluded / in frame). */
  visibility: number;
}

/** One detected pose, as produced by MediaPipe's PoseLandmarker (or the simulator). */
export interface PoseInput {
  /** Normalised image coordinates: x/y in 0..1 of the frame width/height. */
  image: Landmark[];
  /** Metric 3D coordinates (metres), origin at the hip midpoint, y pointing down. */
  world: Landmark[];
}

export type BodySide = 'left' | 'right';

export interface SideJoints {
  ear: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  hip: number;
  knee: number;
  ankle: number;
  heel: number;
  toe: number;
}

export const SIDE: Record<BodySide, SideJoints> = {
  left: {
    ear: LM.LEFT_EAR,
    shoulder: LM.LEFT_SHOULDER,
    elbow: LM.LEFT_ELBOW,
    wrist: LM.LEFT_WRIST,
    hip: LM.LEFT_HIP,
    knee: LM.LEFT_KNEE,
    ankle: LM.LEFT_ANKLE,
    heel: LM.LEFT_HEEL,
    toe: LM.LEFT_FOOT_INDEX,
  },
  right: {
    ear: LM.RIGHT_EAR,
    shoulder: LM.RIGHT_SHOULDER,
    elbow: LM.RIGHT_ELBOW,
    wrist: LM.RIGHT_WRIST,
    hip: LM.RIGHT_HIP,
    knee: LM.RIGHT_KNEE,
    ankle: LM.RIGHT_ANKLE,
    heel: LM.RIGHT_HEEL,
    toe: LM.RIGHT_FOOT_INDEX,
  },
};

export const otherSide = (s: BodySide): BodySide => (s === 'left' ? 'right' : 'left');

/** Skeleton edges used for drawing. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [LM.LEFT_EAR, LM.LEFT_EYE],
  [LM.LEFT_EYE, LM.NOSE],
  [LM.NOSE, LM.RIGHT_EYE],
  [LM.RIGHT_EYE, LM.RIGHT_EAR],
  [LM.MOUTH_LEFT, LM.MOUTH_RIGHT],
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.LEFT_WRIST, LM.LEFT_INDEX],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.RIGHT_WRIST, LM.RIGHT_INDEX],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.LEFT_ANKLE, LM.LEFT_HEEL],
  [LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  [LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
  [LM.RIGHT_ANKLE, LM.RIGHT_HEEL],
  [LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
  [LM.RIGHT_ANKLE, LM.RIGHT_FOOT_INDEX],
];

/** Landmarks drawn as joints (face detail is skipped to keep the overlay readable). */
export const DRAWN_JOINTS: readonly number[] = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
  LM.LEFT_HEEL,
  LM.RIGHT_HEEL,
  LM.LEFT_FOOT_INDEX,
  LM.RIGHT_FOOT_INDEX,
];

export const BODY_REGIONS = {
  upper: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST],
  torso: [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP],
  legs: [LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE],
  feet: [LM.LEFT_ANKLE, LM.RIGHT_ANKLE, LM.LEFT_HEEL, LM.RIGHT_HEEL, LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX],
} as const;
