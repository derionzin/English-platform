import {
  COLS, ROWS, CELL, COLORS, SHAPES, PIECE_SHEET, MIN_CHAIN, ELEMENTS, STAT_CAP,
  BAR_W, BAR_H, ENEMY_BAR_Y, PLAYER_BAR_Y,
  ENEMY_SHAKE_TIME, ENEMY_LUNGE_TIME, PLAYER_SHAKE_TIME,
} from './config.js';
import { ENEMIES } from './enemies.js';
import { createSpriteSheet, createAnimator } from './animation.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createRenderer({
  ctx, W, H, layout, utils, effects, board, battle, powers, progress,
  enemyView, stageSelect, overScreen, input, game, lessonPoints,
}) {
  const { roundedRect, text, ready, drawFitted } = utils;
  const { boardX, boardY, boardW, boardH, enemyBox, playerBox } = layout;

  const images = {
    player: Assets.image('player'),
  };

  const sheetImage = Assets.image('pieces');
  const pieceSheet = ready(sheetImage)
    ? createSpriteSheet(sheetImage, {
        cols: PIECE_SHEET.cols,
        rows: PIECE_SHEET.rows,
        smooth: !PIECE_SHEET.pixelArt,
      })
    : null;
  const pieceAnim = createAnimator({
    frames: PIECE_SHEET.frames,
    fps: PIECE_SHEET.fps,
    mode: PIECE_SHEET.mode,
  });

  function drawShape(type, R) {
    const shape = SHAPES[type];
    ctx.fillStyle = COLORS[type];
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (shape.sides === 0) {
      ctx.arc(0, 0, R, 0, Math.PI * 2);
    } else {
      for (let i = 0; i < shape.sides; i++) {
        const a = shape.rot + (i * Math.PI * 2) / shape.sides;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }

  // `animating` is true for pieces in the current chain and for pieces being cleared.
  function drawPiece(p, pulse, animating) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.scale * pulse, p.scale * pulse);
    ctx.globalAlpha = p.clearing ? Math.max(0, p.scale) : 1;

    if (pieceSheet) {
      let frame = PIECE_SHEET.idleFrame;
      if (PIECE_SHEET.animate === 'always') {
        frame = pieceAnim.frameAt(game.time, p.phase);
      } else if (animating && p.animStart != null) {
        frame = pieceAnim.frameAt(game.time - p.animStart);
      }
      const byRows = PIECE_SHEET.typesAs === 'rows';
      pieceSheet.draw(
        ctx,
        byRows ? frame : p.type,
        byRows ? p.type : frame,
        0, 0, CELL - 8, CELL - 8
      );
    } else {
      drawShape(p.type, CELL * 0.36);
    }
    ctx.restore();
  }

  // A small piece image, used on the power buttons and the stats panel.
  function drawIcon(type, cx, cy, size, animated) {
    ctx.save();
    ctx.translate(cx, cy);
    if (pieceSheet) {
      const frame = animated ? pieceAnim.frameAt(game.time) : PIECE_SHEET.idleFrame;
      const byRows = PIECE_SHEET.typesAs === 'rows';
      pieceSheet.draw(ctx, byRows ? frame : type, byRows ? type : frame, 0, 0, size, size);
    } else {
      drawShape(type, size * 0.4);
    }
    ctx.restore();
  }

  function drawPlaceholder(box, label, color, img, offsetX, offsetY) {
    ctx.save();
    ctx.translate(box.x + offsetX, box.y + offsetY);
    if (ready(img)) {
      drawFitted(img, 0, 0, box.w, box.h);
    } else {
      roundedRect(-box.w / 2, -box.h / 2, box.w, box.h, 12);
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
      ctx.setLineDash([]);
      text(label, 0, -4, 18, color, 'center', 600);
      text('PNG goes here', 0, 16, 12, color);
    }
    ctx.restore();
  }

  // The current enemy: its animated sprite sheet, or a labeled placeholder.
  function drawEnemy(shake, bob) {
    const enemy = battle.enemy;
    const index = ENEMIES.indexOf(enemy);
    const size = enemy.size || { w: enemyBox.w, h: enemyBox.h };
    const action = battle.action;
    const t = action.name === 'idle' ? game.time : action.t;

    const drawn = enemyView.draw(index, action.name, t, enemyBox.x + shake, enemyBox.y + bob, size.w, size.h);
    if (!drawn) {
      drawPlaceholder(
        { x: enemyBox.x, y: enemyBox.y, w: size.w, h: size.h },
        enemy.name.toUpperCase(), '#ff6b6b', null, shake, bob
      );
    }
  }

  const hpColor = (fraction) => (fraction > 0.5 ? '#51cf66' : fraction > 0.25 ? '#ffd43b' : '#ff6b6b');

  function drawBar(cx, y, hp, trail, max, color) {
    const x = cx - BAR_W / 2;

    roundedRect(x, y, BAR_W, BAR_H, BAR_H / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();

    ctx.save();
    roundedRect(x, y, BAR_W, BAR_H, BAR_H / 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(x, y, (BAR_W * Math.max(0, trail)) / max, BAR_H);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, (BAR_W * Math.max(0, hp)) / max, BAR_H);
    ctx.restore();

    roundedRect(x, y, BAR_W, BAR_H, BAR_H / 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();

    text(`${Math.ceil(hp)}/${max}`, x + BAR_W + 10, y + BAR_H - 1, 12, '#c8cdd6', 'left');
  }

  function drawPowerButtons() {
    const canUse = game.state === 'playing' && game.phase === 'idle';

    layout.powerButtons.forEach((b, i) => {
      const el = ELEMENTS[i];
      const full = powers.isReady(i);
      const fraction = Math.min(1, powers.meters[i] / el.meterMax);
      const cx = b.x + b.w / 2;
      const glow = full && canUse ? 0.5 + Math.sin(game.time * 6) * 0.5 : 0;

      roundedRect(b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();

      // The meter fills the button from the bottom.
      ctx.save();
      roundedRect(b.x, b.y, b.w, b.h, 10);
      ctx.clip();
      ctx.globalAlpha = full ? 0.4 : 0.28;
      ctx.fillStyle = el.color;
      ctx.fillRect(b.x, b.y + b.h * (1 - fraction), b.w, b.h * fraction);
      if (powers.flash[i] > 0) {
        ctx.globalAlpha = (powers.flash[i] / powers.FLASH_TIME) * 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.restore();

      roundedRect(b.x, b.y, b.w, b.h, 10);
      ctx.lineWidth = full ? 2 + glow : 1.5;
      ctx.strokeStyle = full ? '#ffd76a' : el.color;
      ctx.globalAlpha = full ? 1 : 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawIcon(i, cx, b.y + 20, 28, full);

      if (full) {
        text('READY', cx, b.y + b.h - 8, 12, '#ffd76a', 'center', 700);
      } else {
        text(`${el.name} ${Math.floor(powers.meters[i])}/${el.meterMax}`, cx, b.y + b.h - 8, 12, '#c8cdd6');
      }
    });
  }

  // Level, XP bar and the Stats button along the bottom.
  function drawBottomStrip() {
    const { xpBar, statsButton: sb } = layout;
    const points = progress.points;
    const busy = game.state === 'playing' && game.phase !== 'idle';

    text(`Lv ${progress.level}`, 16, xpBar.y + 10, 16, '#ffffff', 'left', 700);

    roundedRect(xpBar.x, xpBar.y, xpBar.w, xpBar.h, xpBar.h / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.save();
    roundedRect(xpBar.x, xpBar.y, xpBar.w, xpBar.h, xpBar.h / 2);
    ctx.clip();
    ctx.fillStyle = '#74c0fc';
    ctx.fillRect(xpBar.x, xpBar.y, xpBar.w * Math.min(1, progress.xp / progress.xpNeeded()), xpBar.h);
    if (game.xpFlash > 0) {
      ctx.globalAlpha = (game.xpFlash / 0.4) * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(xpBar.x, xpBar.y, xpBar.w, xpBar.h);
    }
    ctx.restore();
    text(`${progress.xp}/${progress.xpNeeded()} XP`, xpBar.x + xpBar.w / 2, xpBar.y + xpBar.h + 15, 12, '#8a93a8');

    ctx.globalAlpha = busy ? 0.4 : 1;
    roundedRect(sb.x, sb.y, sb.w, sb.h, 10);
    ctx.fillStyle = points > 0 ? 'rgba(255, 215, 106, 0.2)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = points > 0 ? '#ffd76a' : 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();
    text('Stats', sb.x + sb.w / 2, sb.y + sb.h / 2 + 5, 15, points > 0 ? '#ffd76a' : '#c8cdd6', 'center', 600);
    ctx.globalAlpha = 1;

    if (points > 0) {
      const pulse = 1 + Math.sin(game.time * 6) * 0.1;
      ctx.save();
      ctx.translate(sb.x + sb.w - 4, sb.y + 2);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd76a';
      ctx.fill();
      text(String(points), 0, 5, 13, '#0b1020', 'center', 700);
      ctx.restore();
    }
  }

  function drawStatsPanel() {
    const s = layout.stats;
    const points = progress.points;

    ctx.fillStyle = 'rgba(11, 16, 32, 0.82)';
    ctx.fillRect(0, 0, W, H);

    roundedRect(s.panel.x, s.panel.y, s.panel.w, s.panel.h, 16);
    ctx.fillStyle = '#141b33';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    text(`Level ${progress.level}`, W / 2, s.panel.y + 36, 24, '#ffffff', 'center', 700);
    text(
      points > 0 ? `${points} point${points === 1 ? '' : 's'} to spend` : 'No points to spend',
      W / 2, s.panel.y + 60, 15, points > 0 ? '#ffd76a' : '#8a93a8', 'center', 600
    );

    ELEMENTS.forEach((el, i) => {
      const row = s.rows[i];
      const x = s.panel.x + 20;
      const can = progress.canSpend(el.id);

      roundedRect(x, row.y, s.panel.w - 40, row.h, 10);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fill();

      drawIcon(i, x + 28, row.y + row.h / 2, 34, false);
      text(`${el.name}  ${progress.allocated(el.id)}/${STAT_CAP}`, x + 58, row.y + 24, 15, el.color, 'left', 700);
      progress.describe(el.id).forEach((line, j) => {
        text(line, x + 58, row.y + 42 + j * 15, 12, '#c8cdd6', 'left');
      });

      const p = row.plus;
      ctx.globalAlpha = can ? 1 : 0.3;
      roundedRect(p.x, p.y, p.w, p.h, 10);
      ctx.fillStyle = can ? el.color : 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      text('+', p.x + p.w / 2, p.y + p.h / 2 + 9, 28, '#0b1020', 'center', 700);
      ctx.globalAlpha = 1;
    });

    const armed = game.resetArmed > 0;
    const button = (r, label, fill, color) => {
      roundedRect(r.x, r.y, r.w, r.h, 10);
      ctx.fillStyle = fill;
      ctx.fill();
      text(label, r.x + r.w / 2, r.y + r.h / 2 + 5, 14, color, 'center', 600);
    };
    button(
      s.reset, armed ? 'Tap to confirm' : 'Reset points',
      armed ? '#ff6b6b' : 'rgba(255, 255, 255, 0.1)', armed ? '#0b1020' : '#c8cdd6'
    );
    button(s.close, 'Close', '#2f6fed', '#ffffff');
  }

  function drawNotice() {
    const { notice } = effects;
    if (notice.t <= 0) return;
    const y = boardY + boardH / 2;
    roundedRect(W / 2 - 130, y - 20, 260, 40, 20);
    ctx.fillStyle = 'rgba(11, 16, 32, 0.85)';
    ctx.fill();
    text(notice.text, W / 2, y + 6, 16, '#ffffff');
  }

  function render() {
    const { state, result, phase, score, time } = game;
    const grid = board.grid;
    const chain = input.chain;
    const validChain = chain.length >= MIN_CHAIN;

    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);
    effects.drawStars(ctx);

    // Enemy select screen
    if (state === 'select') {
      stageSelect.draw();
      effects.drawParticles(ctx);
      effects.drawPopups(ctx, text);
      drawNotice();
      drawBottomStrip();
      if (game.statsOpen) drawStatsPanel();
      return;
    }

    // Enemy
    if (result !== 'win') {
      const shake = battle.enemyShake > 0
        ? Math.sin(time * 60) * 6 * (battle.enemyShake / ENEMY_SHAKE_TIME)
        : 0;
      const lunge = battle.enemyLunge > 0
        ? Math.sin((1 - battle.enemyLunge / ENEMY_LUNGE_TIME) * Math.PI) * 12
        : 0;
      drawEnemy(shake, Math.sin(time * 2) * 3 + lunge);
    }
    drawBar(enemyBox.x, ENEMY_BAR_Y, battle.enemyHp, battle.enemyTrail, battle.enemyMax, '#ff6b6b');
    text(
      battle.enemy.name,
      enemyBox.x - BAR_W / 2 - 10, ENEMY_BAR_Y + BAR_H - 1, 13, '#ffb3b3', 'right', 700
    );

    // Attack charge
    const chargeY = ENEMY_BAR_Y + BAR_H + 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(enemyBox.x - BAR_W / 2, chargeY, BAR_W, 3);
    ctx.fillStyle = '#ffa94d';
    ctx.fillRect(enemyBox.x - BAR_W / 2, chargeY, BAR_W * (1 - battle.attackTimer / battle.interval), 3);

    // Board
    roundedRect(boardX - 6, boardY - 6, boardW + 12, boardH + 12, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) ctx.fillRect(boardX + c * CELL, boardY + r * CELL, CELL, CELL);
      }
    }

    // Work out which pieces are animating. A piece starts from its first
    // frame when it joins the chain, and keeps going while it is cleared.
    const inChain = new Set(chain.map(({ r, c }) => grid[r][c]));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;
        const active = inChain.has(p) || p.clearing;
        if (active && p.animStart == null) p.animStart = time;
        if (!active) p.animStart = null;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(boardX, boardY, boardW, boardH);
    ctx.clip();

    // Chain path, under the pieces
    if (chain.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = validChain ? 'rgba(255, 215, 106, 0.55)' : 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      chain.forEach(({ r, c }, i) => {
        const center = board.centerOf(r, c);
        if (i === 0) ctx.moveTo(center.x, center.y);
        else ctx.lineTo(center.x, center.y);
      });
      ctx.stroke();
    }

    const pulse = 1 + Math.sin(time * 8) * 0.05;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;
        const linked = inChain.has(p);
        drawPiece(p, linked ? 1.08 + (pulse - 1) : 1, linked || p.clearing);
      }
    }
    ctx.restore();

    // Outline each linked piece. Gold means the chain is long enough to clear.
    chain.forEach(({ r, c }) => {
      roundedRect(boardX + c * CELL + 2, boardY + r * CELL + 2, CELL - 4, CELL - 4, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = validChain ? '#ffd76a' : '#ffffff';
      ctx.stroke();
    });

    // Player
    const pShake = battle.playerShake > 0
      ? Math.sin(time * 70) * 6 * (battle.playerShake / PLAYER_SHAKE_TIME)
      : 0;
    if (result !== 'lose') {
      drawPlaceholder(playerBox, 'PLAYER', '#6ee7ff', images.player, pShake, Math.sin(time * 2.4) * 2);
      if (battle.playerShake > 0) {
        roundedRect(
          playerBox.x - playerBox.w / 2 + pShake,
          playerBox.y - playerBox.h / 2,
          playerBox.w,
          playerBox.h,
          12
        );
        ctx.globalAlpha = (battle.playerShake / PLAYER_SHAKE_TIME) * 0.5;
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    drawBar(
      playerBox.x, PLAYER_BAR_Y, battle.playerHp, battle.playerTrail,
      battle.maxHp, hpColor(battle.playerHp / battle.maxHp)
    );

    drawPowerButtons();

    // Shield from earth pieces
    if (battle.defense > 0) {
      if (result !== 'lose') {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(time * 4) * 0.15;
        ctx.strokeStyle = '#74c0fc';
        ctx.lineWidth = 3;
        roundedRect(
          playerBox.x - playerBox.w / 2 - 6,
          playerBox.y - playerBox.h / 2 - 6,
          playerBox.w + 12,
          playerBox.h + 12,
          16
        );
        ctx.stroke();
        ctx.restore();
      }
      text(
        `Shield ${battle.defense}/${progress.maxDefense()}`,
        playerBox.x - BAR_W / 2 - 10, PLAYER_BAR_Y + BAR_H - 1, 13, '#74c0fc', 'right', 600
      );
    }

    // Boost multiplier, always visible. The ring only shows while a boost is stored.
    const boostOn = battle.boost > 0;
    if (boostOn && result !== 'lose') {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(time * 5) * 0.2;
      ctx.strokeStyle = '#b197fc';
      ctx.lineWidth = 3;
      roundedRect(
        playerBox.x - playerBox.w / 2 - 11,
        playerBox.y - playerBox.h / 2 - 11,
        playerBox.w + 22,
        playerBox.h + 22,
        20
      );
      ctx.stroke();
      ctx.restore();
    }
    const boostX = playerBox.x + playerBox.w / 2 + 20;
    text(
      `Boost x${(1 + battle.boost).toFixed(2)}`,
      boostX, playerBox.y - 2, 14, boostOn ? '#b197fc' : '#6b7285', 'left', 700
    );
    text(`max x${(1 + progress.maxBoost()).toFixed(2)}`, boostX, playerBox.y + 16, 12, '#8a93a8', 'left');

    // Shots in flight. Volley shots that haven't left yet are skipped.
    battle.shots.forEach((s) => {
      if (s.wait > 0) return;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.core;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    });

    effects.drawParticles(ctx);
    effects.drawPopups(ctx, text);

    // HUD
    text(`★ ${lessonPoints} lesson points`, 16, 32, 16, '#ffd76a', 'left', 600);
    text(`Score ${score}`, W - 16, 32, 18, '#ffffff', 'right', 600);
    if (state === 'playing' && chain.length > 0) {
      const el = ELEMENTS[board.typeAt(chain[0].r, chain[0].c)];
      text(`${el.name} chain ${chain.length}`, W / 2, 32, 16, validChain ? '#ffd76a' : '#c8cdd6', 'center', 600);
    }

    drawNotice();

    if (state === 'over') overScreen.draw();

    drawBottomStrip();
    if (game.statsOpen) drawStatsPanel();
  }

  return { render };
}