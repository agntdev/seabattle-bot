import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/ui/keyboard.js";
import { boardStorage, BOARD_SIZE } from "../models/board.js";
import { checkWinCondition } from "../models/move.js";
import { profileStore } from "../storage/profile-store.js";

interface AttackCell {
  row: number;
  col: number;
  hit: boolean;
}

interface AttackSession {
  attackMsgId?: number;
  opponentId?: number;
  attacks?: AttackCell[];
}

function getAttackSession(ctx: Ctx): AttackSession | undefined {
  return (ctx.session as Record<string, unknown>).attackState as AttackSession | undefined;
}

const RATING_DELTA = 25;

const composer = new Composer<Ctx>();

composer.command("endgame", async (ctx) => {
  const chatId = ctx.chat!.id;
  const attackSession = getAttackSession(ctx);

  if (!attackSession?.opponentId) {
    await ctx.reply("No active game found. Start with /attack.");
    return;
  }

  const opponentId = attackSession.opponentId;
  const board = await boardStorage.getBoard(opponentId);

  if (!checkWinCondition(board)) {
    const remaining = board.ships.filter((s) => !s.sunk).length;
    await ctx.reply(
      `The battle continues! ${remaining} enemy ship${remaining !== 1 ? "s" : ""} still afloat.`,
    );
    return;
  }

  const winnerId = chatId;
  const loserId = opponentId;

  const store = profileStore();
  const [winnerProfile, loserProfile] = await Promise.all([
    store.get(winnerId),
    store.get(loserId),
  ]);

  winnerProfile.wins += 1;
  winnerProfile.rating += RATING_DELTA;
  loserProfile.losses += 1;
  loserProfile.rating = Math.max(0, loserProfile.rating - RATING_DELTA);

  await Promise.all([
    store.set(winnerId, winnerProfile),
    store.set(loserId, loserProfile),
  ]);

  const keyboard = inlineKeyboard([
    [
      inlineButton("Rematch", "end:rematch"),
      inlineButton("View replay", "end:replay"),
    ],
  ]);

  await ctx.reply(
    `You won! All enemy ships destroyed.\n` +
      `New rating: ${winnerProfile.rating} (+${RATING_DELTA})\n` +
      `Wins: ${winnerProfile.wins} | Losses: ${winnerProfile.losses}`,
    { reply_markup: keyboard },
  );

  try {
    await ctx.api.sendMessage(
      loserId,
      `You lost. All your ships were destroyed.\n` +
        `New rating: ${loserProfile.rating} (-${RATING_DELTA})\n` +
        `Wins: ${loserProfile.wins} | Losses: ${loserProfile.losses}`,
      { reply_markup: keyboard },
    );
  } catch {
    // opponent may not be reachable
  }
});

composer.callbackQuery("end:rematch", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Rematch requested! Set up a new game with /invite or /quickmatch.",
  );
});

composer.callbackQuery("end:replay", async (ctx) => {
  await ctx.answerCallbackQuery();

  const attackSession = getAttackSession(ctx);
  if (!attackSession?.opponentId) {
    await ctx.editMessageText("No active match replay available.");
    return;
  }

  const attacks = attackSession.attacks ?? [];
  if (attacks.length === 0) {
    await ctx.editMessageText("No moves to replay for this match.");
    return;
  }

  const board = await boardStorage.getBoard(attackSession.opponentId);

  const grid: string[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array<string>(BOARD_SIZE).fill("~"),
  );

  for (const a of attacks) {
    grid[a.row][a.col] = a.hit ? "X" : "O";
  }

  const gridLines = grid.map((row, i) => `${String(i).padStart(2, " ")} ${row.join(" ")}`);
  const header = "   0 1 2 3 4 5 6 7 8 9";
  const gridText = [header, ...gridLines].join("\n");

  const shipLines = board.ships.map((s) => {
    const status = s.sunk ? "SUNK" : `hit ${s.hits.length}/${s.size}`;
    return `  ${s.type}: ${status}`;
  });

  const shipSummary =
    shipLines.length > 0 ? "\n\nShips:\n" + shipLines.join("\n") : "";

  await ctx.editMessageText(
    `Replay — attacks on opponent board:\n\n${gridText}${shipSummary}`,
  );
});

export default composer;