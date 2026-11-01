import {
  PLAYER_MAX_HP, ENEMY_MAX_HP, ENEMY_DAMAGE, ATTACK_INTERVAL, SHOT_SPEED,
  ENEMY_SHAKE_TIME, ENEMY_LUNGE_TIME, PLAYER_SHAKE_TIME, DEFENSE_MAX, BOOST_MAX,
} from './config.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createBattle({ layout, effects, onPlayerDown, onEnemyDown }) {
  const { enemyBox, playerBox } = layout;

  function makeShot(kind, sx, sy, tx, ty, extra) {
    return {
      kind, sx, sy, tx, ty, x: sx, y: sy, t: 0,
      dur: Math.hypot(tx - sx, ty - sy) / SHOT_SPEED,
      done: false,
      ...extra,
    };
  }

  const battle = {
    playerHp: PLAYER_MAX_HP,
    enemyHp: ENEMY_MAX_HP,
    playerTrail: PLAYER_MAX_HP,
    enemyTrail: ENEMY_MAX_HP,
    defense: 0,
    boost: 0,
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
      battle.defense = 0;
      battle.boost = 0;
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

    healPlayer(amount) {
      const healed = Math.min(amount, PLAYER_MAX_HP - battle.playerHp);
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
      battle.defense = Math.min(DEFENSE_MAX, before + amount);
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
      const before = battle.attackTimer;
      battle.attackTimer = Math.min(ATTACK_INTERVAL, before + seconds);
      const gained = battle.attackTimer - before;
      effects.burst(enemyBox.x, enemyBox.y, '#63e6be', 12);
      effects.popup({
        x: enemyBox.x,
        y: enemyBox.y + 30,
        text: gained > 0.05 ? `+${gained.toFixed(1)}s` : 'Max delay',
        color: '#63e6be',
      });
      Assets.play('delay');
    },

    addBoost(amount) {
      const before = battle.boost;
      battle.boost = Math.min(BOOST_MAX, before + amount);
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

    // The enemy shoots at the player.
    fireShot() {
      battle.shots.push(
        makeShot(
          'enemy',
          enemyBox.x, enemyBox.y + enemyBox.h / 2,
          playerBox.x, playerBox.y,
          { color: '#ff6b6b', core: '#ffffff', trail: ['#ff8a5c', '#ffd76a'] }
        )
      );
      battle.enemyLunge = ENEMY_LUNGE_TIME;
      Assets.play('shoot');
    },

    // The fire power: the player shoots at the enemy.
    fireBlast(damage) {
      battle.shots.push(
        makeShot(
          'player',
          playerBox.x, playerBox.y - playerBox.h / 2,
          enemyBox.x, enemyBox.y + enemyBox.h / 2,
          { damage, color: '#ff922b', core: '#fff3bf', trail: ['#ffa94d', '#ffe066'] }
        )
      );
      effects.burst(playerBox.x, playerBox.y - playerBox.h / 2, '#ffa94d', 12);
      Assets.play('blast');
    },

    hitEnemy(damage) {
      battle.damageEnemy(damage);
      effects.burst(enemyBox.x, enemyBox.y, '#ff922b', 24);
      effects.burst(enemyBox.x, enemyBox.y, '#ffe066', 10);
      Assets.play('blastHit');
      if (battle.enemyHp <= 0) onEnemyDown();
    },

    hitPlayer() {
      const tx = playerBox.x;
      const ty = playerBox.y;

      // The shield takes its share of this hit and is used up.
      const blocked = Math.min(battle.defense, ENEMY_DAMAGE);
      const damage = ENEMY_DAMAGE - blocked;
      battle.defense = 0;
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
        battle.attackTimer = ATTACK_INTERVAL;
        battle.fireShot();
      }

      battle.shots.forEach((s) => {
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