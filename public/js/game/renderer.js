import {
  COLS, ROWS, CELL, COLORS, SHAPES, PIECE_SHEET, MIN_CHAIN,
  BAR_W, BAR_H, ENEMY_BAR_Y, PLAYER_BAR_Y,
  PLAYER_MAX_HP, ENEMY_MAX_HP, ATTACK_INTERVAL,
  ENEMY_SHAKE_TIME, ENEMY_LUNGE_TIME, PLAYER_SHAKE_TIME,
} from './config.js';
import { createSpriteSheet, createAnimator } from './animation.js';

// Assets comes from assets.js, which is loaded as a normal script.

export function createRenderer({ ctx, W, H, layout, utils, effects, board, battle, input, game, lessonPoints }) {
  const { roundedRect, text, ready, drawFitted } = utils;
  const { boardX, boardY, boardW, boardH, enemyBox, playerBox } = layout;

  const images = {
    enemy: Assets.image('enemy'),
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
      const R = CELL * 0.36;
      const shape = SHAPES[p.type];
      ctx.fillStyle = COLORS[p.type];
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

  function render() {
    const { state, result, phase, score, time } = game;
    const { notice } = effects;
    const grid = board.grid;
    const chain = input.chain;
    const validChain = chain.length >= MIN_CHAIN;

    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, W, H);
    effects.drawStars(ctx);

    // Enemy
    if (result !== 'win') {
      const shake = battle.enemyShake > 0
        ? Math.sin(time * 60) * 6 * (battle.enemyShake / ENEMY_SHAKE_TIME)
        : 0;
      const lunge = battle.enemyLunge > 0
        ? Math.sin((1 - battle.enemyLunge / ENEMY_LUNGE_TIME) * Math.PI) * 12
        : 0;
      drawPlaceholder(enemyBox, 'ENEMY', '#ff6b6b', images.enemy, shake, Math.sin(time * 2) * 3 + lunge);
    }
    drawBar(enemyBox.x, ENEMY_BAR_Y, battle.enemyHp, battle.enemyTrail, ENEMY_MAX_HP, '#ff6b6b');

    // Attack charge
    const chargeY = ENEMY_BAR_Y + BAR_H + 3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(enemyBox.x - BAR_W / 2, chargeY, BAR_W, 3);
    ctx.fillStyle = '#ffa94d';
    ctx.fillRect(enemyBox.x - BAR_W / 2, chargeY, BAR_W * (1 - battle.attackTimer / ATTACK_INTERVAL), 3);

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
      PLAYER_MAX_HP, hpColor(battle.playerHp / PLAYER_MAX_HP)
    );

    // Enemy shots
    battle.shots.forEach((s) => {
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    effects.drawParticles(ctx);
    effects.drawPopups(ctx, text);

    // HUD
    text(`★ ${lessonPoints} lesson points`, 16, 32, 16, '#ffd76a', 'left', 600);
    text(`Score ${score}`, W - 16, 32, 18, '#ffffff', 'right', 600);
    if (state === 'playing' && chain.length > 0) {
      text(`Chain ${chain.length}`, W / 2, 32, 16, validChain ? '#ffd76a' : '#c8cdd6', 'center', 600);
    }

    if (notice.t > 0) {
      const y = boardY + boardH / 2;
      roundedRect(W / 2 - 130, y - 20, 260, 40, 20);
      ctx.fillStyle = 'rgba(11, 16, 32, 0.85)';
      ctx.fill();
      text(notice.text, W / 2, y + 6, 16, '#ffffff');
    }

    // Screens
    if (state === 'ready') {
      ctx.fillStyle = 'rgba(11, 16, 32, 0.7)';
      ctx.fillRect(0, 0, W, H);
      text('Link three', W / 2, H / 2 - 70, 34, '#ffffff', 'center', 600);
      text('Tap or click to start', W / 2, H / 2 - 30, 18, '#ffd76a');
      text('Drag across touching pieces of the same kind.', W / 2, H / 2 + 6, 15, '#c8cdd6');
      text(`Link ${MIN_CHAIN} or more, then let go.`, W / 2, H / 2 + 28, 15, '#c8cdd6');
      text('Every chain hurts the enemy.', W / 2, H / 2 + 50, 15, '#c8cdd6');
      text('It fires back every few seconds.', W / 2, H / 2 + 72, 15, '#c8cdd6');
      text(`★ ${lessonPoints} lesson points ready`, W / 2, H / 2 + 112, 15, '#6ee7ff');
    } else if (state === 'over') {
      ctx.fillStyle = 'rgba(11, 16, 32, 0.75)';
      ctx.fillRect(0, 0, W, H);
      const won = result === 'win';
      text(won ? 'Victory!' : 'Defeat', W / 2, H / 2 - 50, 38, won ? '#ffd76a' : '#ff6b6b', 'center', 700);
      text(`Score ${score}`, W / 2, H / 2 - 8, 22, '#ffffff', 'center', 600);
      if (performance.now() - game.overAt > 700) {
        text('Tap or click to play again', W / 2, H / 2 + 40, 18, '#c8cdd6');
      }
    }
  }

  return { render };
}