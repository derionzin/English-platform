import {
  ASSETS, CLEAR_TIME, POINTS_PER_PIECE, DAMAGE_PER_PIECE, HEAL_PER_PIECE, DEFENSE_PER_PIECE,
  DELAY_PER_PIECE, BOOST_PER_PIECE, FIRE_POWER_DAMAGE, WATER_POWER_HEAL,
  XP_PER_PIECE, REPLAY_XP_FACTOR,
  COLORS, ELEMENTS, MIN_CHAIN, CHAIN_BONUS, createLayout,
} from './game/config.js';
import { ENEMIES, enemyImageKey } from './game/enemies.js';
import { createDrawUtils, inRect } from './game/draw-utils.js';
import { drawLoading } from './game/loading.js';
import { createEffects } from './game/effects.js';
import { createBoard } from './game/board.js';
import { createProgress } from './game/progress.js';
import { createBattle } from './game/battle.js';
import { createPowers } from './game/powers.js';
import { createEnemyView } from './game/enemy-view.js';
import { createStageSelect } from './game/stage-select.js';
import { createOverScreen } from './game/over-screen.js';
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

  // The game's own images and sounds, plus every enemy's sprite sheet.
  const manifest = {
    images: {
      ...ASSETS.images,
      ...Object.fromEntries(ENEMIES.map((e) => [enemyImageKey(e), e.sprite && e.sprite.src])),
    },
    sounds: ASSETS.sounds,
  };
  const result = await Assets.load(manifest, (done, total) => drawLoading(canvas, done, total));

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
    state: 'select', // select | playing | over
    result: null, // 'win' | 'lose'
    overAt: 0,
    phase: 'fall', // idle | clear | fall
    score: 0,
    time: 0,
    statsOpen: false,
    runXp: 0, // XP earned in the current battle
    replay: false, // true when the enemy had been beaten before
    unlockedName: null, // the enemy this win unlocked, if any
    xpFlash: 0,
    resetArmed: 0, // seconds left to confirm "Reset points"
  };

  let clearing = [];
  let clearKind = 'chain'; // 'chain' (player linked pieces) or 'power' (a power button)
  let clearTimer = 0;

  const utils = createDrawUtils(ctx);
  const effects = createEffects(W, H);
  const board = createBoard(layout);
  const progress = createProgress(student.id);
  const battle = createBattle({
    layout, effects, progress,
    onPlayerDown: () => endGame('lose'),
    onEnemyDown: () => endGame('win'),
  });
  const powers = createPowers({ layout, effects });
  const enemyView = createEnemyView(ctx, utils);
  const stageSelect = createStageSelect({ ctx, W, utils, progress, enemyView, game });
  const overScreen = createOverScreen({ ctx, W, H, utils, progress, battle, game });
  const input = createInput({
    canvas, board, powers, layout, game,
    onSelectClick: selectClick,
    onOverClick: overClick,
    onChain: startChain,
    onPower: usePower,
    onOpenStats: openStats,
    onStatsClick: statsClick,
  });
  const renderer = createRenderer({
    ctx, W, H, layout, utils, effects, board, battle, powers, progress,
    enemyView, stageSelect, overScreen, input, game, lessonPoints,
  });

  /* ---------- Game states ---------- */

  function startBattle(index) {
    game.score = 0;
    game.runXp = 0;
    game.result = null;
    game.replay = false;
    game.unlockedName = null;
    game.statsOpen = false;
    battle.start(ENEMIES[index]);
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

  function toSelect() {
    game.state = 'select';
    game.result = null;
    game.statsOpen = false;
    battle.clearShots();
    effects.clear();
    input.reset();
    Assets.stopMusic();
  }

  function selectClick(pt) {
    const i = stageSelect.cardAt(pt);
    if (i === -1) return;
    if (progress.isUnlocked(i)) {
      startBattle(i);
    } else {
      effects.showNotice(`Defeat ${ENEMIES[i - 1].name} first`);
      Assets.play('invalid');
    }
  }

  function overClick(pt) {
    const id = overScreen.hit(pt);
    if (!id) return;
    const index = ENEMIES.indexOf(battle.enemy);
    if (id === 'next') startBattle(index + 1);
    else if (id === 'again') startBattle(index);
    else toSelect();
  }

  function endGame(outcome) {
    if (game.state === 'over') return;
    game.state = 'over';
    game.result = outcome;
    game.overAt = performance.now();
    battle.clearShots();
    input.reset();
    Assets.stopMusic();

    if (outcome === 'win') {
      const enemy = battle.enemy;
      const index = ENEMIES.indexOf(enemy);
      const first = progress.markDefeated(enemy.id);
      game.replay = !first;
      game.unlockedName = first && ENEMIES[index + 1] ? ENEMIES[index + 1].name : null;

      effects.burst(layout.enemyBox.x, layout.enemyBox.y, '#ff6b6b', 40);
      effects.burst(layout.enemyBox.x, layout.enemyBox.y, '#ffd76a', 20);
      gainXp(Math.round(enemy.xp * (first ? 1 : REPLAY_XP_FACTOR)));
      Assets.play('win');
      if (game.unlockedName) Assets.play('unlock');
    } else {
      effects.burst(layout.playerBox.x, layout.playerBox.y, '#6ee7ff', 40);
      Assets.play('lose');
    }
  }

  /* ---------- XP and stats ---------- */

  function gainXp(amount) {
    if (amount <= 0) return;
    game.runXp += amount;
    game.xpFlash = 0.4;
    const levels = progress.addXp(amount);
    if (levels) {
      Assets.play('levelUp');
      effects.showNotice(`Level ${progress.level}! +${levels} point${levels > 1 ? 's' : ''}`, 3);
      effects.burst(layout.xpBar.x + layout.xpBar.w / 2, layout.xpBar.y, '#74c0fc', 24);
    }
  }

  function openStats() {
    input.reset();
    game.resetArmed = 0;
    game.statsOpen = true;
    Assets.play('select');
  }

  function statsClick(pt) {
    const s = layout.stats;

    if (inRect(pt, s.close) || !inRect(pt, s.panel)) {
      game.resetArmed = 0;
      game.statsOpen = false;
      return;
    }
    if (inRect(pt, s.reset)) {
      if (game.resetArmed > 0) {
        game.resetArmed = 0;
        progress.respec();
        battle.syncStats();
        Assets.play('shuffle');
      } else {
        game.resetArmed = 3;
      }
      return;
    }
    ELEMENTS.forEach((el, i) => {
      if (inRect(pt, s.rows[i].plus) && progress.spend(el.id)) {
        battle.syncStats();
        Assets.play('spend');
      }
    });
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
    const { playerBox } = layout;

    const spend = () => {
      powers.consume(type);
      Assets.play('power');
    };
    const showBoost = (boost) => {
      if (boost > 1) {
        effects.popup({
          x: playerBox.x, y: playerBox.y - 62,
          text: `Boost x${boost.toFixed(2)}`, color: '#b197fc',
        });
      }
    };

    if (el.power === 'clearType') {
      // Wind: removes every piece of this kind from the board.
      const cells = board.cellsOfType(type);
      if (!cells.length) {
        effects.showNotice(`No ${el.name.toLowerCase()} pieces on the board`);
        return;
      }
      spend();
      clearing = board.markClearing(cells);
      clearKind = 'power';
      clearTimer = CLEAR_TIME;
      game.phase = 'clear';
    } else if (el.power === 'blast') {
      // Fire: a shot flies from the player to the enemy.
      const boost = battle.consumeBoost();
      spend();
      showBoost(boost);
      battle.fireBlast(FIRE_POWER_DAMAGE * boost);
    } else if (el.power === 'restore') {
      // Water: a big heal.
      if (battle.playerHp >= battle.maxHp) {
        effects.showNotice('Already at full health');
        return;
      }
      const boost = battle.consumeBoost();
      spend();
      showBoost(boost);
      battle.healPlayer(WATER_POWER_HEAL * boost);
    } else if (el.power === 'fortify') {
      // Earth: fills the shield.
      if (battle.defense >= progress.maxDefense()) {
        effects.showNotice('Shield is already full');
        return;
      }
      spend();
      battle.addDefense(progress.maxDefense());
    } else if (el.power === 'overcharge') {
      // Night: maxes out the boost.
      if (battle.boost >= progress.maxBoost()) {
        effects.showNotice('Boost is already maxed');
        return;
      }
      spend();
      battle.addBoost(progress.maxBoost());
    } else {
      effects.showNotice(`${el.name} power isn't set up yet`);
    }
  }

  // Score, element effect, meter and XP for a chain the player linked.
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

    // Stat multipliers are applied inside the battle functions.
    if (el.effect === 'damage') battle.damageEnemy(effectAmount(DAMAGE_PER_PIECE));
    else if (el.effect === 'heal') battle.healPlayer(effectAmount(HEAL_PER_PIECE));
    else if (el.effect === 'defense') battle.addDefense(effectAmount(DEFENSE_PER_PIECE));
    else if (el.effect === 'delay') battle.addDelay(effectAmount(DELAY_PER_PIECE));
    else if (el.effect === 'boost') battle.addBoost(n * BOOST_PER_PIECE * mult);

    powers.fill(type, n);
    gainXp(Math.round(n * XP_PER_PIECE * mult));
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
    game.xpFlash = Math.max(0, game.xpFlash - dt);
    game.resetArmed = Math.max(0, game.resetArmed - dt);
    effects.update(dt);
    powers.update(dt);
    battle.animate(dt);
    const moving = board.move(dt);

    // The stats panel pauses the battle, and the select screen has no battle.
    if (game.statsOpen) return;
    if (game.state === 'select') return;

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