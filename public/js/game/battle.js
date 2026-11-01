import {
  PLAYER_MAX_HP, ENEMY_MAX_HP, ENEMY_DAMAGE, ATTACK_INTERVAL, SHOT_SPEED,
  ENEMY_SHAKE_TIME, ENEMY_LUNGE_TIME, PLAYER_SHAKE_TIME,
} from './config.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createBattle({ layout, effects, onPlayerDown }) {
  const { enemyBox, playerBox } = layout;

  const battle = {
    playerHp: PLAYER_MAX_HP,
    enemyHp: ENEMY_MAX_HP,
    playerTrail: PLAYER_MAX_HP,
    enemyTrail: ENEMY_MAX_HP,
    attackTimer: ATTACK_INTERVAL,
    shots: [],
    enemyShake: 0,
    enemyLunge: 0,
    playerShake: 0,

    reset() {
      battle.playerHp = PLAYER_MAX_HP;
      battle.enemyHp = ENEMY_MAX_HP;
      battle.playerTrail = PLAYER_MAX_HP;
      battle.enemyTrail = ENEMY_MAX_HP;
      battle.attackTimer = ATTACK_INTERVAL;
      battle.shots = [];
      battle.enemyShake = 0;
      battle.enemyLunge = 0;
      battle.playerShake = 0;
    },

    resetAttackTimer() {
      battle.attackTimer = ATTACK_INTERVAL;
    },

    clearShots() {
      battle.shots = [];
    },

    damageEnemy(amount) {
      battle.enemyHp = Math.max(0, battle.enemyHp - amount);
      battle.enemyShake = ENEMY_SHAKE_TIME;
      effects.popup({ x: enemyBox.x, y: enemyBox.y, text: `-${amount}`, color: '#ff6b6b' });
    },

    fireShot() {
      const sx = enemyBox.x;
      const sy = enemyBox.y + enemyBox.h / 2;
      const tx = playerBox.x;
      const ty = playerBox.y;
      battle.shots.push({
        sx, sy, tx, ty, x: sx, y: sy, t: 0,
        dur: Math.hypot(tx - sx, ty - sy) / SHOT_SPEED,
        done: false,
      });
      battle.enemyLunge = ENEMY_LUNGE_TIME;
      Assets.play('shoot');
    },

    hitPlayer() {
      const tx = playerBox.x;
      const ty = playerBox.y;
      battle.playerHp = Math.max(0, battle.playerHp - ENEMY_DAMAGE);
      battle.playerShake = PLAYER_SHAKE_TIME;
      effects.burst(tx, ty, '#ff6b6b', 20);
      effects.burst(tx, ty, '#ffd76a', 8);
      effects.popup({ x: tx, y: ty - 36, text: `-${ENEMY_DAMAGE}`, color: '#ff6b6b' });
      Assets.play('hurt');
      if (battle.playerHp <= 0) onPlayerDown();
    },

    // Enemy attacks. Only runs while the game is being played.
    update(dt) {
      battle.attackTimer -= dt;
      if (battle.attackTimer <= 0) {
        battle.attackTimer = ATTACK_INTERVAL;
        battle.fireShot();
      }

      battle.shots.forEach((s) => {
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.x = s.sx + (s.tx - s.sx) * k;
        s.y = s.sy + (s.ty - s.sy) * k;
        effects.spark(s.x, s.y, '#ff8a5c');
        effects.spark(s.x, s.y, '#ffd76a');
        if (k >= 1 && !s.done) {
          s.done = true;
          battle.hitPlayer();
        }
      });
      battle.shots = battle.shots.filter((s) => !s.done);
    },

    // Shake timers and the fading health bars. Runs every frame.
    animate(dt) {
      battle.enemyShake = Math.max(0, battle.enemyShake - dt);
      battle.enemyLunge = Math.max(0, battle.enemyLunge - dt);
      battle.playerShake = Math.max(0, battle.playerShake - dt);

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

  return battle;
}