/*
  The preset enemies, in the order they unlock.

    hp, damage        health, and damage per shot
    interval          seconds between attacks (the player's Wind stat stretches it)
    shotSpeed         pixels per second
    volley            shots per attack, volleyGap is the time between them
    xp                XP for beating it (replays give less)
    shot              colors and size of its shots
    size              how big it is drawn
    sprite            the sprite sheet: cols/rows of the image, and one entry
                      per animation state (row, frames, fps, mode).
                      Only `idle` is required. `attack` and `hurt` are optional.

  Sheet layout: each row is a state, frames run left to right.
  Paths are relative to game.html, so 'img/imp.png' is public/img/imp.png.
*/

const sheet = (src) => ({
  src,
  cols: 10,
  rows: 3,
  pixelArt: false,
  states: {
    idle:   { row: 0, frames: 10, fps: 10,  mode: 'loop' },
    attack: { row: 1, frames: 10, fps: 15, mode: 'once', fireFrame: 6 },
    hurt:   { row: 2, frames: 10, fps: 15,  mode: 'once' },
  },
});

export const ENEMIES = [
  {
    id: 'slime',
    name: 'slime',
    hp: 100,
    damage: 10,
    interval: 6,
    shotSpeed: 620,
    volley: 1,
    volleyGap: 0.35,
    xp: 200,
    trait: 'A calm first opponent',
    shot: { color: '#ff6b6b', core: '#ffffff', trail: ['#ff8a5c', '#ffd76a'], radius: 9 },
    size: { w: 170, h: 100 },
    sprite: sheet('img/slime.png'),
  },
  {
    id: 'imp',
    name: 'Imp',
    hp: 140,
    damage: 7,
    interval: 4,
    shotSpeed: 700,
    volley: 1,
    volleyGap: 0.35,
    xp: 260,
    trait: 'Small and quick',
    shot: { color: '#ffa94d', core: '#fff3bf', trail: ['#ffd43b', '#ff922b'], radius: 8 },
    size: { w: 150, h: 100 },
    sprite: sheet('img/imp.png'),
  },
  {
    id: 'golem',
    name: 'Golem',
    hp: 260,
    damage: 18,
    interval: 8,
    shotSpeed: 460,
    volley: 1,
    volleyGap: 0.35,
    xp: 300,
    trait: 'Slow, but hits hard',
    shot: { color: '#d9a441', core: '#fff3bf', trail: ['#c08a2e', '#ffe066'], radius: 13 },
    size: { w: 180, h: 100 },
    sprite: sheet('img/golem.png'),
  },
  {
    id: 'wraith',
    name: 'Wraith',
    hp: 200,
    damage: 7,
    interval: 6,
    shotSpeed: 620,
    volley: 3,
    volleyGap: 0.3,
    xp: 500,
    trait: 'Fires three shots at once',
    shot: { color: '#9775fa', core: '#e5dbff', trail: ['#b197fc', '#d0bfff'], radius: 8 },
    size: { w: 160, h: 100 },
    sprite: sheet('img/wraith.png'),
  },
  {
    id: 'dragon',
    name: 'Dragon',
    hp: 400,
    damage: 12,
    interval: 5,
    shotSpeed: 700,
    volley: 2,
    volleyGap: 0.4,
    xp: 800,
    trait: 'The final challenge',
    shot: { color: '#ff922b', core: '#fff3bf', trail: ['#ff6b6b', '#ffe066'], radius: 11 },
    size: { w: 200, h: 110 },
    sprite: sheet('img/dragon.png'),
  },
];

// The name the loader uses for an enemy's sprite sheet.
export const enemyImageKey = (enemy) => 'enemy_' + enemy.id;