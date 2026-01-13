// Mechanism image imports for local development and bundling
// These are imported as ES6 modules for proper bundling

import robotArmFront from '@/assets/mechanisms/robot_arm_front.png';
import robotArmSide from '@/assets/mechanisms/robot_arm_side.png';
import robotArmTop from '@/assets/mechanisms/robot_arm_top.png';

import cylinderFront from '@/assets/mechanisms/cylinder_front.png';
import cylinderSide from '@/assets/mechanisms/cylinder_side.png';
import cylinderTop from '@/assets/mechanisms/cylinder_top.png';

import gripperFront from '@/assets/mechanisms/gripper_front.png';
import gripperSide from '@/assets/mechanisms/gripper_side.png';
import gripperTop from '@/assets/mechanisms/gripper_top.png';

import liftFront from '@/assets/mechanisms/lift_front.png';
import liftSide from '@/assets/mechanisms/lift_side.png';
import liftTop from '@/assets/mechanisms/lift_top.png';

import stopFront from '@/assets/mechanisms/stop_front.png';
import stopSide from '@/assets/mechanisms/stop_side.png';
import stopTop from '@/assets/mechanisms/stop_top.png';

import conveyorFront from '@/assets/mechanisms/conveyor_front.png';
import conveyorSide from '@/assets/mechanisms/conveyor_side.png';
import conveyorTop from '@/assets/mechanisms/conveyor_top.png';

import turntableFront from '@/assets/mechanisms/turntable_front.png';
import turntableSide from '@/assets/mechanisms/turntable_side.png';
import turntableTop from '@/assets/mechanisms/turntable_top.png';

import cameraMountFront from '@/assets/mechanisms/camera_mount_front.png';
import cameraMountSide from '@/assets/mechanisms/camera_mount_side.png';
import cameraMountTop from '@/assets/mechanisms/camera_mount_top.png';

export interface MechanismImageSet {
  front: string;
  side: string;
  top: string;
}

export const mechanismImages: Record<string, MechanismImageSet> = {
  robot_arm: {
    front: robotArmFront,
    side: robotArmSide,
    top: robotArmTop,
  },
  cylinder: {
    front: cylinderFront,
    side: cylinderSide,
    top: cylinderTop,
  },
  gripper: {
    front: gripperFront,
    side: gripperSide,
    top: gripperTop,
  },
  lift: {
    front: liftFront,
    side: liftSide,
    top: liftTop,
  },
  stop: {
    front: stopFront,
    side: stopSide,
    top: stopTop,
  },
  conveyor: {
    front: conveyorFront,
    side: conveyorSide,
    top: conveyorTop,
  },
  turntable: {
    front: turntableFront,
    side: turntableSide,
    top: turntableTop,
  },
  camera_mount: {
    front: cameraMountFront,
    side: cameraMountSide,
    top: cameraMountTop,
  },
};

export function getMechanismImage(type: string, view: 'front' | 'side' | 'top'): string | null {
  const imageSet = mechanismImages[type];
  if (!imageSet) return null;
  return imageSet[view];
}

export function getMechanismImageSet(type: string): MechanismImageSet | null {
  return mechanismImages[type] || null;
}
