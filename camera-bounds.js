// Bound camera focus to the physical Skyre desk while preserving orbital freedom.
//
// The table spans ~23 x 18 world units. A clamped camera target always
// remains above its surface; the camera itself may orbit around that target.
// The height cap tightens at near-horizontal, close-up views so the wooden
// desk cannot disappear below the bottom of the screen.
export const DESK_CAMERA_BOUNDS=Object.freeze({
  minX:-9.9,maxX:9.9,
  minZ:-7.35,maxZ:7.35,
  minY:-0.86,maxY:1.20,
  deskY:-1.03,
  maxDistance:43
});
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function boundedDeskTarget(target,distance,polarAngle,verticalFov,bounds=DESK_CAMERA_BOUNDS){
  // The lower portion of the camera's field of view must still include
  // the wood at the focused desk location, even at maximum tilt + zoom.
  const theta=clamp(polarAngle,0,Math.PI/2);
  const lookDown=Math.PI/2-theta;
  const halfFov=verticalFov*.5*.86; // inset ensures desk is not on a clipping edge
  let maxY=bounds.maxY;
  if(lookDown+halfFov<Math.PI/2-0.001){
    const dy=distance*(Math.sin(theta)*Math.tan(lookDown+halfFov)-Math.cos(theta));
    maxY=Math.min(maxY,bounds.deskY+Math.max(0,dy));
  }
  maxY=Math.max(bounds.minY,maxY);
  return {
    x:clamp(target.x,bounds.minX,bounds.maxX),
    y:clamp(target.y,bounds.minY,maxY),
    z:clamp(target.z,bounds.minZ,bounds.maxZ)
  };
}
export function clampOrbitToDesk(camera,controls,bounds=DESK_CAMERA_BOUNDS){
  const original=controls.target;
  const next=boundedDeskTarget(
    original,controls.getDistance(),controls.getPolarAngle(),
    camera.fov*Math.PI/180,bounds
  );
  const dx=next.x-original.x,dy=next.y-original.y,dz=next.z-original.z;
  if(dx||dy||dz){
    // OrbitControls owns the relative camera-to-target offset. Move both
    // together to avoid any jump in zoom, pitch or azimuth.
    controls.target.set(next.x,next.y,next.z);
    camera.position.x+=dx;camera.position.y+=dy;camera.position.z+=dz;
    return true;
  }
  return false;
}

