import {
  ASSETS, CLEAR_TIME, POINTS_PER_PIECE, DAMAGE_PER_PIECE, HEAL_PER_PIECE, DEFENSE_PER_PIECE,
  DELAY_PER_PIECE, BOOST_PER_PIECE,
  COLORS, ELEMENTS, MIN_CHAIN, CHAIN_BONUS, createLayout,
} from './game/config.js';
import { createDrawUtils } from './game/draw-utils.js';
import { drawLoading } from './game/loading.js';
import { createEffects } from './game/effects.js';
import { createBoard } from './game/board.js';
import { createBattle } from './game/battle.js';
import { createPowers } from './game/powers.js';
import { createInput } from './game/input.js';
import { createRenderer } from './game/renderer.js';

// Assets comes from assets.js, which is loaded as a normal script.

const $ = (id) => document.getElementById(id);

const student = JSON.parse(localStorage.getItem('student') || 'null');
if (!student) location.href = '/';

const entry = JSON.parse(sessionStorage.getItem('gameEntry') || 'null');

/* ---------- Page setup ---------- */

const muteBtn = $('mute');
const syncMute = () => { muteBtn.textContent = Assets.isMuted() ? 'Sound off' : 'Sound on'; };
muteBtn.onclick = () => {
  Assets.setMuted(!Assets.isMuted());
  syncMute();
};
syncMute();

if (!entry) {
  $('message').hidden = false;
  $('message').innerHTML = 'Open the game from a lesson to bring your points with you. <a href="/student.html">Go to my lessons</a>';
} else {
  $('back').href = `/student.html?lesson=${entry.lessonId}`;
  $('pointsValue').textContent = entry.points;
  $('game').hidden = false;
  loadAndStart();
}

async function loadAndStart() {
  const canvas = $('game');
  drawLoading(canvas, 0, 0);
  const started = performance.now();
  const result = await Assets.load(ASSETS, (done, total) => drawLoading(canvas, done, total));

  const wait = 400 - (performance.now() - started);
  if (result.total && wait > 0) await new Promise((r) => setTimeout(r, wait));

  startGame(entry);
}

/* ---------- The game ---------- */

function startGame(entry) {
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const layout = createLayout(W);

  // Points brought from the lesson. Not used by the game yet.
  const lessonPoints = entry.points;

  // Shared state that the other modules read.
  const game = {
    state: 'ready', // ready | playing | over
    result: null, // 'win' | 'lose'
    overAt: 0,
    phase: 'fall', // idle | clear | fall
    score: 0,
    time: 0,
  };

  let clearing = [];
  let clearKind = 'chain'; // 'chain' (player linked pieces) or 'power' (a power button)
  let clearTimer = 0;

  const utils = createDrawUtils(ctx);
  const effects = createEffects(W, H);
  const board = createBoard(layout);
  const battle = createBattle({ layout, effects, onPlayerDown: () => endGame('lose') });
  const powers = createPowers({ layout, effects });
  const input = createInput({
    canvas, board, powers, game,
    onStart: startPlaying,
    onRestart: tryRestart,
    onChain: startChain,
    onPower: usePower,
  });
  const renderer = createRenderer({
    ctx, W, H, layout, utils, effects, board, battle, powers, input, game, lessonPoints,
  });

  /* ---------- Game states ---------- */

  function startPlaying() {
    game.state = 'playing';
    battle.resetAttackTimer();
    Assets.playMusic('music');
  }

  function tryRestart() {
    if (performance.now() - game.overAt > 700) restart();
  }

  function restart() {
    game.score = 0;
    game.result = null;
    battle.reset();
    powers.reset();
    effects.clear();
    clearing = [];
    clearKind = 'chain';
    input.reset();
    board.build();
    game.phase = 'fall';
    game.state = 'playing';
    Assets.playMusic('music');
  }

  function endGame(outcome) {
    game.state = 'over';
    game.result = outcome;
    game.overAt = performance.now();
    battle.clearShots();
    input.reset();
    Assets.stopMusic();
    if (outcome === 'win') {
      effects.burst(layout.enemyBox.x, layout.enemyBox.y, '#ff6b6b', 40);
      effects.burst(layout.enemyBox.x, layout.enemyBox.y, '#ffd76a', 20);
    } else {
      effects.burst(layout.playerBox.x, layout.playerBox.y, '#6ee7ff', 40);
    }
    Assets.play(outcome === 'win' ? 'win' : 'lose');
  }

  /* ---------- Turn flow ---------- */

  // The player let go of a chain that is long enough.
  function startChain(cells) {
    if (game.state !== 'playing' || game.phase !== 'idle') return;
    clearing = board.markClearing(cells);
    clearKind = 'chain';
    clearTimer = CLEAR_TIME;
    game.phase = 'clear';
  }

  // The player tapped a power button.
  function usePower(type) {
    if (game.state !== 'playing' || game.phase !== 'idle') return;
    if (!powers.isReady(type)) return;
    const el = ELEMENTS[type];

    if (el.power === 'clearType') {
      const cells = board.cellsOfType(type);
      if (!cells.length) {
        effects.showNotice(`No ${el.name.toLowerCase()} pieces on the board`);
        return;
      }
      powers.consume(type);
      Assets.play('power');
      clearing = board.markClearing(cells);
      clearKind = 'power';
      clearTimer = CLEAR_TIME;
      game.phase = 'clear';
    } else {
      // Not defined yet. The meter stays full until the power exists.
      effects.showNotice(`${el.name} power isn't set up yet`);
    }
  }

  // Score, element effect and meter for a chain the player linked.
  function applyChain(type, removed) {
    const n = removed.length;
    const mult = 1 + (n - MIN_CHAIN) * CHAIN_BONUS;
    const el = ELEMENTS[type];

    let sx = 0;
    let sy = 0;
    removed.forEach((p) => {
      sx += p.x;
      sy += p.y;
    });

    // Night builds the boost. Every other effect uses it up.
    const usesBoost = el.effect && el.effect !== 'boost';
    const boost = usesBoost ? battle.consumeBoost() : 1;
    const effectAmount = (perPiece) => n * perPiece * mult * boost;

    const gain = Math.round(n * POINTS_PER_PIECE * mult);
    game.score += gain;
    Assets.play('match', { rate: Math.min(1 + (n - MIN_CHAIN) * 0.06, 1.6) });
    effects.popup({
      x: sx / n,
      y: sy / n,
      text: mult > 1 ? `+${gain}  x${+mult.toFixed(2)}` : `+${gain}`,
    });
    if (boost > 1) {
      effects.popup({ x: sx / n, y: sy / n - 26, text: `Boost x${boost.toFixed(2)}`, color: '#b197fc' });
    }

    if (el.effect === 'damage') battle.damageEnemy(Math.round(effectAmount(DAMAGE_PER_PIECE)));
    else if (el.effect === 'heal') battle.healPlayer(Math.round(effectAmount(HEAL_PER_PIECE)));
    else if (el.effect === 'defense') battle.addDefense(Math.round(effectAmount(DEFENSE_PER_PIECE)));
    else if (el.effect === 'delay') battle.addDelay(effectAmount(DELAY_PER_PIECE));
    else if (el.effect === 'boost') battle.addBoost(n * BOOST_PER_PIECE * mult);

    powers.fill(type, n);
  }

  function finishClear() {
    const removed = board.removeCells(clearing);
    const type = removed[0].type;

    removed.forEach((p) => effects.burst(p.x, p.y, COLORS[p.type], 8));
    if (clearKind === 'chain') applyChain(type, removed);

    clearing = [];
    board.applyGravity();
    game.phase = 'fall';
    if (battle.enemyHp <= 0) endGame('win');
  }

  function reshuffle() {
    board.shuffle();
    effects.showNotice('No chains left. Reshuffled!');
    Assets.play('shuffle');
  }

  /* ---------- Loop ---------- */

  function update(dt) {
    game.time += dt;
    effects.update(dt);
    powers.update(dt);
    battle.animate(dt);
    const moving = board.move(dt);

    if (game.state === 'playing') battle.update(dt);
    if (game.state === 'over') return;

    if (game.phase === 'clear') {
      clearTimer -= dt;
      board.setClearScale(clearing, Math.max(0, clearTimer / CLEAR_TIME));
      if (clearTimer <= 0) finishClear();
    } else if (game.phase === 'fall' && !moving) {
      if (!board.hasMoves()) reshuffle();
      game.phase = 'idle';
    }
  }

  board.build();
  game.phase = 'fall';

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    renderer.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}