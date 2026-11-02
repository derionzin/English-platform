import {
  SHOT_SPEED, ENEMY_SHAKE_TIME, ENEMY_LUNGE_TIME, PLAYER_SHAKE_TIME, ENEMY_GROUND,
} from './config.js';
import { ENEMIES } from './enemies.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createBattle({ layout, effects, progress, onPlayerDown, onEnemyDown }) {
  const { enemyBox, playerBox } = layout;
  let enemy = ENEMIES[0];

  // Where the current enemy is: the box it is drawn in and where its shots leave from.
  function enemyGeom() {
    const size = enemy.size || { w: enemyBox.w, h: enemyBox.h };
    const off = enemy.offset || { x: 0, y: 0 };
    const x = enemyBox.x + off.x;
    const y = ENEMY_GROUND - size.h / 2 + off.y;
    const m = enemy.muzzle || { x: 0, y: size.h / 2 };
    return { x, y, size, muzzle: { x: x + m.x, y: y + m.y } };
  }

  // Seconds from the start of the attack animation to the frame the shot leaves on.
  function windup() {
    const state = enemy.sprite && enemy.sprite.states && enemy.sprite.states.attack;
    if (!state) return 0;
    const frame = state.fireFrame ?? Math.floor(state.frames / 2);
    return Math.max(0, Math.min(frame, state.frames - 1)) / state.fps;
  }

  function makeShot(kind, sx, sy, tx, ty, extra) {
    return {
      kind, sx, sy, tx, ty, x: sx, y: sy, t: 0, radius: 9,
      pending: false, began: true, startIn: 0, releaseIn: 0, done: false,
      dur: Math.hypot(tx - sx, ty - sy) / (extra.speed || SHOT_SPEED),
      ...extra,
    };
  }

  // The moment an enemy shot leaves: lunge, flash and sound.
  function release(shot) {
    battle.enemyLunge = ENEMY_LUNGE_TIME;
    effects.burst(shot.sx, shot.sy, shot.color, 6);
    Assets.play('shoot');
  }

  const battle = {
    maxHp: 0,
    interval: 0, // seconds between enemy attacks, after the Wind stat
    playerHp: 0,
    enemyMax: 0,
    enemyHp: 0,
    playerTrail: 0,
    enemyTrail: 0,
    defense: 0,
    boost: 0,
    attackTimer: 0,
    shots: [],
    enemyShake: 0,
    enemyLunge: 0,
    playerShake: 0,
    action: { name: 'idle', t: 0, dur: 0 }, // which enemy animation is playing

    get enemy() { return enemy; },
    enemyGeom,

    // Begin a fresh battle against one of the presets.
    start(newEnemy) {
      enemy = newEnemy;
      battle.reset();
    },

    reset() {
      battle.maxHp = progress.maxHp();
      battle.interval = progress.attackInterval(enemy.interval);
      battle.playerHp = battle.maxHp;
      battle.enemyMax = enemy.hp;
      battle.enemyHp = enemy.hp;
      battle.playerTrail = battle.maxHp;
      battle.enemyTrail = enemy.hp;
      battle.defense = 0;
      battle.boost = 0;
      battle.attackTimer = battle.interval;
      battle.shots = [];
      battle.enemyShake = 0;
      battle.enemyLunge = 0;
      battle.playerShake = 0;
      battle.action = { name: 'idle', t: 0, dur: 0 };
    },

    // Call after stat points change, so the battle matches the new stats.
    syncStats() {
      const newMax = progress.maxHp();
      const diff = newMax - battle.maxHp;
      battle.maxHp = newMax;
      if (diff > 0) {
        battle.playerHp += diff;
        battle.playerTrail += diff;
      }
      battle.playerHp = Math.min(battle.playerHp, newMax);
      battle.playerTrail = Math.min(battle.playerTrail, newMax);
      battle.defense = Math.min(battle.defense, progress.maxDefense());
      battle.boost = Math.min(battle.boost, progress.maxBoost());

      const newInterval = progress.attackInterval(enemy.interval);
      battle.attackTimer *= newInterval / battle.interval;
      battle.interval = newInterval;
    },

    resetAttackTimer() {
      battle.attackTimer = battle.interval;
    },

    // Removes every shot, including ones still winding up, and stops the attack animation.
    clearShots() {
      battle.shots = [];
      battle.action = { name: 'idle', t: 0, dur: 0 };
    },

    // Plays 'attack' or 'hurt' from the enemy's sprite sheet, if it has that row.
    playEnemyAction(name) {
      const states = enemy.sprite && enemy.sprite.states;
      const state = states && states[name];
      if (!state) return;
      if (name === 'hurt' && battle.action.name === 'attack') return;
      battle.action = { name, t: 0, dur: state.frames / state.fps };
    },

    damageEnemy(amount) {
      const g = enemyGeom();
      const dealt = Math.round(amount * progress.damageMult());
      battle.enemyHp = Math.max(0, battle.enemyHp - dealt);
      battle.enemyShake = ENEMY_SHAKE_TIME;
      battle.playEnemyAction('hurt');
      effects.popup({ x: g.x, y: g.y, text: `-${dealt}`, color: '#ff6b6b' });
    },

    healPlayer(amount) {
      const target = Math.round(amount * progress.healMult());
      const healed = Math.min(target, battle.maxHp - battle.playerHp);
      battle.playerHp += healed;
      if (healed > 0) {
        effects.burst(playerBox.x, playerBox.y, '#51cf66', 16);
        effects.popup({ x: playerBox.x, y: playerBox.y - 36, text: `+${healed}`, color: '#51cf66' });
      } else {
        effects.popup({ x: playerBox.x, y: playerBox.y - 36, text: 'Full health', color: '#51cf66' });
      }
      Assets.play('heal');
    },

    addDefense(amount) {
      const before = battle.defense;
      battle.defense = Math.min(progress.maxDefense(), before + Math.round(amount * progress.shieldMult()));
      const gained = battle.defense - before;
      effects.burst(playerBox.x, playerBox.y, '#74c0fc', 14);
      effects.popup({
        x: playerBox.x,
        y: playerBox.y - 36,
        text: gained > 0 ? `+${gained} shield` : 'Shield full',
        color: '#74c0fc',
      });
      Assets.play('shield');
    },

    addDelay(seconds) {
      const g = enemyGeom();
      const before = battle.attackTimer;
      battle.attackTimer = Math.min(battle.interval, before + seconds * progress.delayMult());
      const gained = battle.attackTimer - before;
      effects.burst(g.x, g.y, '#63e6be', 12);
      effects.popup({
        x: g.x,
        y: g.y + 30,
        text: gained > 0.05 ? `+${gained.toFixed(1)}s` : 'Max delay',
        color: '#63e6be',
      });
      Assets.play('delay');
    },

    addBoost(amount) {
      const before = battle.boost;
      battle.boost = Math.min(progress.maxBoost(), before + amount);
      effects.burst(playerBox.x, playerBox.y, '#b197fc', 14);
      effects.popup({
        x: playerBox.x,
        y: playerBox.y - 36,
        text: battle.boost > before ? `Next x${(1 + battle.boost).toFixed(2)}` : 'Boost maxed',
        color: '#b197fc',
      });
      Assets.play('boost');
    },

    // Returns the multiplier for the effect being applied now, and uses the boost up.
    consumeBoost() {
      const multiplier = 1 + battle.boost;
      battle.boost = 0;
      return multiplier;
    },

    // The enemy attacks: one shot, or a volley. Each shot starts its own attack
    // animation and leaves the enemy when that animation reaches its fireFrame.
    fireShot() {
      const count = enemy.volley || 1;
      const gap = enemy.volleyGap ?? 0.35;
      const lead = windup();
      const g = enemyGeom();
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 28;
        battle.shots.push(
          makeShot('enemy', g.muzzle.x, g.muzzle.y, playerBox.x + spread, playerBox.y, {
            ...enemy.shot,
            speed: enemy.shotSpeed,
            pending: true,
            began: false,
            startIn: i * gap,
            releaseIn: i * gap + lead,
          })
        );
      }
    },

    // The fire power: the player shoots at the enemy.
    fireBlast(damage) {
      const g = enemyGeom();
      battle.shots.push(
        makeShot(
          'player',
          playerBox.x, playerBox.y - playerBox.h / 2,
          g.x, g.y,
          { damage, color: '#ff922b', core: '#fff3bf', trail: ['#ffa94d', '#ffe066'] }
        )
      );
      effects.burst(playerBox.x, playerBox.y - playerBox.h / 2, '#ffa94d', 12);
      Assets.play('blast');
    },

    hitEnemy(damage) {
      const g = enemyGeom();
      battle.damageEnemy(damage);
      effects.burst(g.x, g.y, '#ff922b', 24);
      effects.burst(g.x, g.y, '#ffe066', 10);
      Assets.play('blastHit');
      if (battle.enemyHp <= 0) onEnemyDown();
    },

    hitPlayer() {
      const tx = playerBox.x;
      const ty = playerBox.y;

      // The shield soaks up what it can, and keeps whatever it didn't need.
      const blocked = Math.min(battle.defense, enemy.damage);
      const damage = enemy.damage - blocked;
      battle.defense -= blocked;
      battle.playerHp = Math.max(0, battle.playerHp - damage);

      if (damage > 0) {
        battle.playerShake = PLAYER_SHAKE_TIME;
        effects.burst(tx, ty, '#ff6b6b', 20);
        effects.burst(tx, ty, '#ffd76a', 8);
        effects.popup({ x: tx, y: ty - 36, text: `-${damage}`, color: '#ff6b6b' });
      }
      if (blocked > 0) {
        effects.burst(tx, ty, '#74c0fc', 14);
        effects.popup({
          x: tx,
          y: ty - (damage > 0 ? 62 : 36),
          text: damage > 0 ? `${blocked} blocked` : 'Blocked!',
          color: '#74c0fc',
        });
      }
      Assets.play(damage > 0 ? 'hurt' : 'block');
      if (battle.playerHp <= 0) onPlayerDown();
    },

    // Enemy attacks and shots in flight. Only runs while the game is being played.
    update(dt) {
      battle.attackTimer -= dt;
      if (battle.attackTimer <= 0) {
        battle.attackTimer = battle.interval;
        battle.fireShot();
      }

      battle.shots.forEach((s) => {
        // An enemy shot that hasn't left yet: first its attack animation starts,
        // then the shot is released when the animation reaches its fireFrame.
        if (s.pending) {
          if (!s.began) {
            s.startIn -= dt;
            if (s.startIn <= 0) {
              s.began = true;
              battle.playEnemyAction('attack');
            }
          }
          s.releaseIn -= dt;
          if (s.releaseIn <= 0) {
            s.pending = false;
            release(s);
          }
          return;
        }

        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * k;
        s.y = s.sy + (s.ty - s.sy) * k;
        effects.spark(s.x, s.y, s.trail[0]);
        effects.spark(s.x, s.y, s.trail[1]);
        if (k >= 1 && !s.done) {
          s.done = true;
          if (s.kind === 'player') battle.hitEnemy(s.damage);
          else battle.hitPlayer();
        }
      });
      battle.shots = battle.shots.filter((s) => !s.done);
    },

    // Shake timers, the enemy animation and the fading health bars.
    animate(dt) {
      battle.enemyShake = Math.max(0, battle.enemyShake - dt);
      battle.enemyLunge = Math.max(0, battle.enemyLunge - dt);
      battle.playerShake = Math.max(0, battle.playerShake - dt);

      battle.action.t += dt;
      if (battle.action.name !== 'idle' && battle.action.t >= battle.action.dur) {
        battle.action = { name: 'idle', t: 0, dur: 0 };
      }

      battle.enemyTrail =
        battle.enemyTrail > battle.enemyHp
          ? Math.max(battle.enemyHp, battle.enemyTrail - 30 * dt)
          : battle.enemyHp;
      battle.playerTrail =
        battle.playerTrail > battle.playerHp
          ? Math.max(battle.playerHp, battle.playerTrail - 30 * dt)
          : battle.playerHp;
    },
  };

  battle.reset();
  return battle;
}