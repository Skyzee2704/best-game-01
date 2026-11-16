// Keyboard + mouse input for Nova Drift. Movement is WASD/arrows, aim and fire are the
// mouse, Space/Shift dashes, E or right-click drops a Nova Bomb, Esc/P pauses, M mutes,
// R restarts. Edge-triggered actions are queued and handed out once per step.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_BOMB = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  const queue = [];
  let digit = 0;
  const mouse = { x: 640, y: 360, down: false };

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      queue.push(ACTION_CONFIRM);
      if (event.code === 'Space') queue.push(ACTION_DASH);
      event.preventDefault();
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') queue.push(ACTION_DASH);
    if (event.code === 'Escape' || event.code === 'KeyP') queue.push(ACTION_PAUSE);
    if (event.code === 'KeyE') queue.push(ACTION_BOMB);
    if (event.code === 'KeyM') queue.push(ACTION_MUTE);
    if (event.code === 'KeyR') queue.push(ACTION_RESTART);
    if (event.code === 'Digit1') digit = 1;
    if (event.code === 'Digit2') digit = 2;
    if (event.code === 'Digit3') digit = 3;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPoint(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = canvasPoint(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    if (event.button === 0) {
      mouse.down = true;
      queue.push(ACTION_CONFIRM);
    }
    if (event.button === 2) queue.push(ACTION_BOMB);
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised WASD/arrows direction vector. */
    direction() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Current mouse aim in canvas coordinates. */
    aim() {
      return { x: mouse.x, y: mouse.y };
    },
    get firing() {
      return mouse.down;
    },
    /** Drain all queued edge actions as one bitmask. Dash/bomb bits are kept
        queued for the arena step, which consumes them separately. */
    takeActions() {
      let bits = 0;
      const gameBits = [];
      while (queue.length > 0) {
        const bit = queue.shift();
        if (bit === ACTION_DASH || bit === ACTION_BOMB) gameBits.push(bit);
        else bits |= bit;
      }
      for (let i = gameBits.length - 1; i >= 0; i -= 1) queue.unshift(gameBits[i]);
      return bits;
    },
    /** Drain dash/bomb bits for the arena step (UI bits stay queued). */
    takeGameActions() {
      let bits = 0;
      const rest = [];
      while (queue.length > 0) {
        const bit = queue.shift();
        if (bit === ACTION_DASH || bit === ACTION_BOMB) bits |= bit;
        else rest.push(bit);
      }
      for (let i = 0; i < rest.length; i += 1) queue.push(rest[i]);
      return bits;
    },
    /** Drain a pressed upgrade digit (1, 2 or 3), 0 when none was pressed. */
    takeDigit() {
      const d = digit;
      digit = 0;
      return d;
    },
  };
}
