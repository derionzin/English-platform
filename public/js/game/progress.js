import {
  PLAYER_MAX_HP, DEFENSE_MAX, BOOST_MAX, ATTACK_INTERVAL,
  ELEMENTS, STATS, STAT_CAP, xpToNext,
} from './config.js';
import { ENEMIES } from './enemies.js';

// Level, XP, stat points and defeated enemies for one student, saved in the browser.
export function createProgress(studentId) {
  const key = `progress-${studentId}`;
  const emptyAlloc = () => Object.fromEntries(ELEMENTS.map((e) => [e.id, 0]));
  const fresh = () => ({ level: 1, xp: 0, points: 0, alloc: emptyAlloc(), defeated: [] });

  let data = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && typeof saved === 'object') {
      data = {
        ...fresh(),
        ...saved,
        alloc: { ...emptyAlloc(), ...(saved.alloc || {}) },
        defeated: Array.isArray(saved.defeated) ? saved.defeated : [],
      };
    }
  } catch {}

  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  };
  const pts = (id) => data.alloc[id] || 0;

  const progress = {
    get level() { return data.level; },
    get xp() { return data.xp; },
    get points() { return data.points; },

    xpNeeded: () => xpToNext(data.level),
    allocated: (id) => pts(id),
    canSpend: (id) => data.points > 0 && pts(id) < STAT_CAP,

    spend(id) {
      if (!progress.canSpend(id)) return false;
      data.alloc[id] = pts(id) + 1;
      data.points--;
      save();
      return true;
    },

    // Gives every spent point back.
    respec() {
      data.alloc = emptyAlloc();
      data.points = data.level - 1;
      save();
    },

    // Returns how many levels were gained.
    addXp(amount) {
      let levels = 0;
      data.xp += amount;
      while (data.xp >= xpToNext(data.level)) {
        data.xp -= xpToNext(data.level);
        data.level++;
        data.points++;
        levels++;
      }
      save();
      return levels;
    },

    // Enemies: the first is always open, the others need the previous one beaten.
    isDefeated: (id) => data.defeated.includes(id),
    isUnlocked: (index) => index === 0 || data.defeated.includes(ENEMIES[index - 1].id),

    // Returns true the first time an enemy is beaten.
    markDefeated(id) {
      if (data.defeated.includes(id)) return false;
      data.defeated.push(id);
      save();
      return true;
    },

    damageMult: () => 1 + STATS.fire.damage * pts('fire'),
    maxHp: () => PLAYER_MAX_HP + STATS.water.hp * pts('water'),
    healMult: () => 1 + STATS.water.heal * pts('water'),
    maxDefense: () => DEFENSE_MAX + STATS.earth.defense * pts('earth'),
    shieldMult: () => 1 + STATS.earth.shield * pts('earth'),
    attackInterval: (base = ATTACK_INTERVAL) => base * (1 + STATS.wind.interval * pts('wind')),
    delayMult: () => 1 + STATS.wind.delay * pts('wind'),
    maxBoost: () => BOOST_MAX + STATS.night.boost * pts('night'),

    // Lines of text for the stats panel.
    describe(id) {
      switch (id) {
        case 'fire':
          return [`Damage x${progress.damageMult().toFixed(2)}`];
        case 'water':
          return [`Max health ${progress.maxHp()}`, `Healing x${progress.healMult().toFixed(2)}`];
        case 'earth':
          return [`Max shield ${progress.maxDefense()}`, `Shield gain x${progress.shieldMult().toFixed(2)}`];
        case 'wind':
          return [`Enemy attack time x${(1 + STATS.wind.interval * pts('wind')).toFixed(2)}`, `Delay x${progress.delayMult().toFixed(2)}`];
        case 'night':
          return [`Max boost x${(1 + progress.maxBoost()).toFixed(2)}`];
        default:
          return [];
      }
    },
  };

  return progress;
}