
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
    heal: null,
    shield: null,
    block: null,
    power: null,
    powerReady: null,
  },
};

// Board
export const COLS = 7;
export const ROWS = 7;
export const CELL = 48;
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

// Element effects
export const HEAL_PER_PIECE = 3;       // water, multiplied by the chain bonus
export const DEFENSE_PER_PIECE = 1;    // earth, multiplied by the chain bonus
export const DEFENSE_MAX = ENEMY_DAMAGE; // a shield can't block more than one full hit

export const ATTACK_INTERVAL = 6; // seconds between enemy attacks
export const SHOT_SPEED = 620; // pixels per second
export const ENEMY_SHAKE_TIME = 0.3;
export const ENEMY_LUNGE_TIME = 0.25;
export const PLAYER_SHAKE_TIME = 0.35;

// Chains
export const MIN_CHAIN = 3;
export const ALLOW_DIAGONALS = false;
export const CHAIN_BONUS = 0.25;
export const HIT_RADIUS = 0.4;


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

export const ELEMENTS = [
  { id: 'fire',  name: 'Fire',  color: '#ff6b6b', shape: { sides: 3, rot: -Math.PI / 2 }, effect: 'damage',  power: null,        meterMax: 10, meterPerPiece: 1 },
  { id: 'water', name: 'Water', color: '#4dabf7', shape: { sides: 0, rot: 0 },            effect: 'heal',    power: null,        meterMax: 10, meterPerPiece: 1 },
  { id: 'wind',  name: 'Wind',  color: '#63e6be', shape: { sides: 4, rot: 0 },            effect: null,      power: 'clearType', meterMax: 10, meterPerPiece: 1 },
  { id: 'earth', name: 'Earth', color: '#d9a441', shape: { sides: 4, rot: Math.PI / 4 },  effect: 'defense', power: null,        meterMax: 10, meterPerPiece: 1 },
  { id: 'night', name: 'Night', color: '#9775fa', shape: { sides: 6, rot: 0 },            effect: null,      power: null,        meterMax: 10, meterPerPiece: 1 },
];
export const COLORS = ELEMENTS.map((e) => e.color);
export const SHAPES = ELEMENTS.map((e) => e.shape);
export const BAR_W = 220;
export const BAR_H = 12;
export const ENEMY_BAR_Y = 42;
export const PLAYER_BAR_Y = 546;

// Power button row, below the player
export const POWER = { w: 84, h: 54, gap: 8, y: 570 };

// Positions on the canvas (W is the canvas width)
export function createLayout(W) {
  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;
  const rowW = TYPES * POWER.w + (TYPES - 1) * POWER.gap;
  const rowX = (W - rowW) / 2;
  return {
    boardX: (W - boardW) / 2,
    boardY: 152,
    boardW,
    boardH,
    enemyBox: { x: W / 2, y: 102, w: 170, h: 76 },
    playerBox: { x: W / 2, y: 516, w: 120, h: 40 },
    powerButtons: Array.from({ length: TYPES }, (_, i) => ({
      x: rowX + i * (POWER.w + POWER.gap),
      y: POWER.y,
      w: POWER.w,
      h: POWER.h,
    })),
  };
}