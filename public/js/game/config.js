
export const ASSETS = {
  images: {
    pieces: 'img/pieces.png',
    enemy: 'img/owl.png',
    player: 'img/player.png',
  },
  sounds: {
    select: 'sound/select.mp3',
    swap: 'sound/swap.mp3',
    invalid: 'sound/invalid.mp3',
    match: 'sound/match.mp3',
    shuffle: 'sound/clack.mp3',
    music: 'sound/music.mp3',
    shoot: 'sound/shoot.mp3',
    hurt: 'sound/hurt.mp3',
    win: 'sound/win.mp3',
    lose: 'sound/lose.mp3',
  },
};

// Board
export const COLS = 7;
export const ROWS = 7;
export const CELL = 54;
export const TYPES = 5;

// Timing and scoring
export const MOVE_RATE = 16;
export const CLEAR_TIME = 0.22;
export const POINTS_PER_PIECE = 10;

// Battle
export const PLAYER_MAX_HP = 100;
export const ENEMY_MAX_HP = 100;
export const DAMAGE_PER_PIECE = 2; // multiplied by the combo
export const ENEMY_DAMAGE = 10;
export const ATTACK_INTERVAL = 6; // seconds between enemy attacks
export const SHOT_SPEED = 620; // pixels per second
export const ENEMY_SHAKE_TIME = 0.3;
export const ENEMY_LUNGE_TIME = 0.25;
export const PLAYER_SHAKE_TIME = 0.35;

// Look

// Piece sprite sheet
export const PIECE_SHEET = {
  cols: 10,
  rows: 5,
  frames: 10,
  fps: 8,
  mode: 'loop',
  typesAs: 'rows',
  animate: 'selected', // 'selected': only the chosen piece moves, 'always': every piece moves
  idleFrame: 0,        // frame shown by pieces that aren't animating (0 is the first)
  desync: true,        // only used when animate is 'always'
  pixelArt: false,
};

export const COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#ffd43b', '#b18cff'];
export const SHAPES = [
  { sides: 0, rot: 0 },
  { sides: 3, rot: -Math.PI / 2 },
  { sides: 4, rot: Math.PI / 4 },
  { sides: 4, rot: 0 },
  { sides: 6, rot: 0 },
];
export const BAR_W = 220;
export const BAR_H = 12;
export const ENEMY_BAR_Y = 42;
export const PLAYER_BAR_Y = 624;

// Positions on the canvas (W is the canvas width)
export function createLayout(W) {
  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;
  return {
    boardX: (W - boardW) / 2,
    boardY: 176,
    boardW,
    boardH,
    enemyBox: { x: W / 2, y: 112, w: 170, h: 100 },
    playerBox: { x: W / 2, y: 592, w: 120, h: 50 },
  };
}