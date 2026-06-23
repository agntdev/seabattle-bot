import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/ui/keyboard.js";
import {
  boardStorage,
  BOARD_SIZE,
} from "../models/board.js";
import { checkWinCondition } from "../models/move.js";
import { profileStore } from "../storage/profile-store.js";
import { type ShipType, type ShipOrientation } from "../models/ship.js";

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

function setAttackSession(ctx: Ctx, state: AttackSession): void {
  (ctx.session as Record<string, unknown>).attackState = state;
}

const FIXED_PLACEMENTS: { type: ShipType; row: number; col: number; orientation: ShipOrientation }[] = [
  { type: "carrier", row: 0, col: 0, orientation: "horizontal" },
  { type: "battleship", row: 1, col: 0, orientation: "horizontal" },
  { type: "cruiser", row: 2, col: 0, orientation: "horizontal" },
  { type: "submarine", row: 3, col: 0, orientation: "horizontal" },
  { type: "destroyer", row: 4, col: 0, orientation: "horizontal" },
];

function buildGridKeyboard(attacks: AttackCell[]): ReturnType<typeof inlineKeyboard> {
  const rows = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row: ReturnType<typeof inlineButton>[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      const attack = attacks.find((a) => a.row === r && a.col === c);
      const label = attack ? (attack.hit ? "X" : "O") : "~";
      row.push(inlineButton(label, `atk:${r}:${c}`));
    }
    rows.push(row);
  }
  return inlineKeyboard(rows);
}

async function seedOpponentBoard(opponentId: number): Promise<void> {
  for (const placement of FIXED_PLACEMENTS) {
    const result = await boardStorage.placeShip(
      opponentId,
      placement.type,
      placement.row,
      placement.col,
      placement.orientation,
    );
    if (!result.ok && result.error === "duplicate") {
      continue;
    }
  }
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
  const session = getAttackSession(ctx);

  if (!session?.opponentId) {
    await ctx.editMessageText("No active game to rematch. Start with /attack.");
    return;
  }

  const opponentId = session.opponentId;

  await boardStorage.resetBoard(opponentId);
  await seedOpponentBoard(opponentId);

  const state: AttackSession = {
    attackMsgId: session.attackMsgId,
    opponentId,
    attacks: [],
  };
  setAttackSession(ctx, state);

  const gridKeyboard = buildGridKeyboard([]);
  try {
    await ctx.editMessageText(
      "Rematch! Attack grid — tap a cell to fire!\nX = hit, O = miss, ~ = unknown",
      { reply_markup: gridKeyboard },
    );
  } catch {
    const chatId = ctx.chat!.id;
    const msg = await ctx.reply(
      "Rematch! Attack grid — tap a cell to fire!\nX = hit, O = miss, ~ = unknown",
      { reply_markup: gridKeyboard },
    );
    state.attackMsgId = msg.message_id;
    setAttackSession(ctx, state);
  }
});

composer.callbackQuery("end:replay", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Replay viewer coming soon. Check your match history with /history.",
  );
});

export default composer;