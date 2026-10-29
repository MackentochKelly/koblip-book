// On a touch screen a tap area of at least 44px each way (Apple's minimum),
// drawn invisibly around the element so its look and the layout don't
// change: the same one the shared Button uses. For links and triggers that
// are not a Button. The element must not clip its overflow.
export const TOUCH_AREA =
  "relative pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 pointer-coarse:after:-translate-1/2"
