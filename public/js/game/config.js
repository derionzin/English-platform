
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
    heal: 'sound/heal.mp3',
    shield: 'sound/shield.mp3',
    block: 'sound/block.mp3',
    power: 'sound/power.mp3',
    powerReady: 'sound/powerReady.mp3',
    delay: 'sound/delay.mp3',
    boost: 'sound/boost.mp3',
    blast: 'sound/blast.mp3',
    blastHit: 'sound/blastHit.mp3',
    levelUp: 'sound/levelUp.mp3',
    spend: 'sound/spend.mp3',
    unlock: 'sound/unlock.mp3',
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
export const ENEMY_GROUND = 164;  // y of the enemy's feet. Bigger enemies grow upward from here.
export const DEBUG_ENEMY = false; // true draws each enemy's box (green) and shot origin (pink)

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
  { id: 'fire',  name: 'Fire',  color: '#ff6b6b', shape: { sides: 3, rot: -Math.PI / 2 }, effect: 'damage',  power: 'blast',       meterMax: 10, meterPerPiece: 1 },
  { id: 'water', name: 'Water', color: '#4dabf7', shape: { sides: 0, rot: 0 },            effect: 'heal',    power: 'restore',     meterMax: 10, meterPerPiece: 1 },
  { id: 'wind',  name: 'Wind',  color: '#63e6be', shape: { sides: 4, rot: 0 },            effect: 'delay',   power: 'clearType',   meterMax: 10, meterPerPiece: 1 },
  { id: 'earth', name: 'Earth', color: '#d9a441', shape: { sides: 4, rot: Math.PI / 4 },  effect: 'defense', power: 'fortify',     meterMax: 10, meterPerPiece: 1 },
  { id: 'night', name: 'Night', color: '#9775fa', shape: { sides: 6, rot: 0 },            effect: 'boost',   power: 'overcharge',  meterMax: 10, meterPerPiece: 1 },
];
export const COLORS = ELEMENTS.map((e) => e.color);
export const SHAPES = ELEMENTS.map((e) => e.shape);
export const BAR_W = 220;
export const BAR_H = 12;
export const ENEMY_BAR_Y = 42;
export const PLAYER_BAR_Y = 546;
export const DELAY_PER_PIECE = 0.5;  // seconds added to the enemy attack timer (wind)
export const BOOST_PER_PIECE = 0.3; // added to the next-effect multiplier (night)
export const BOOST_MAX = 2;          // 1 means the multiplier tops out at x3
export const FIRE_POWER_DAMAGE = 30;
export const WATER_POWER_HEAL = 40; 

// Power button row, below the player
export const POWER = { w: 84, h: 54, gap: 8, y: 570 };

// Progression
export const XP_PER_PIECE = 4;   // per piece in a chain, with the chain bonus
export const XP_WIN_BONUS = 60;  // for beating the enemy
export const xpToNext = (level) => 100 + (level - 1) * 40;
export const STAT_CAP = 100;      // most points one element can hold
export const REPLAY_XP_FACTOR = 0.8;

// What each stat point does
export const STATS = {
  fire:  { damage: 0.08 },                 // +8% damage
  water: { hp: 5, heal: 0.10 },            // +5 max health, +10% healing
  earth: { defense: 2, shield: 0.10 },     // +2 max shield, +10% shield gain
  wind:  { interval: 0.06, delay: 0.10 },  // +6% time between attacks, +10% delay
  night: { boost: 0.3 },                  // +0.3 max boost
};

// Positions on the canvas (W is the canvas width)
export function createLayout(W) {
  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;
  const rowW = TYPES * POWER.w + (TYPES - 1) * POWER.gap;
  const rowX = (W - rowW) / 2;

  const panel = { x: 24, y: 96, w: W - 48, h: 500 };
  const rows = Array.from({ length: TYPES }, (_, i) => {
    const y = panel.y + 76 + i * 70;
    return { y, h: 64, plus: { x: panel.x + panel.w - 76, y: y + 8, w: 48, h: 48 } };
  });

  return {
    boardX: (W - boardW) / 2,
    boardY: 176,
    boardW,
    boardH,
    enemyBox: { x: W / 2, y: 112, w: 170, h: 100 },
    playerBox: { x: W / 2, y: 592, w: 120, h: 50 },
    powerButtons: Array.from({ length: TYPES }, (_, i) => ({
      x: rowX + i * (POWER.w + POWER.gap),
      y: POWER.y,
      w: POWER.w,
      h: POWER.h,
    })),
    xpBar: { x: 64, y: 728, w: 250, h: 10 },
    statsButton: { x: W - 144, y: 718, w: 128, h: 34 },
    stats: {
      panel,
      rows,
      reset: { x: panel.x + 24, y: panel.y + panel.h - 56, w: 140, h: 40 },
      close: { x: panel.x + panel.w - 164, y: panel.y + panel.h - 56, w: 140, h: 40 },
    },
  };
}