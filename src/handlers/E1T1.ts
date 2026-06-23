import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { matchmakingQueue } from "../storage/matchmaking-queue.js";
import { inlineButton, inlineKeyboard } from "../toolkit/ui/keyboard.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("matchmaking:quick", async (ctx) => {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const queue = matchmakingQueue();
  const userId = chatId.toString();

  const alreadyInQueue = await queue.isInQueue(userId);
  if (alreadyInQueue) {
    await ctx.reply("You are already in the matchmaking queue.");
    return;
  }

  await queue.addToQueue(userId);
  const length = await queue.queueLength();

  if (length >= 2) {
    const pair = await queue.tryMatch();
    if (pair) {
      const [p1, p2] = pair;
      const confirmKeyboard = inlineKeyboard([[
        inlineButton("Place ships now", "ships:place"),
        inlineButton("Auto-place", "ships:auto"),
      ]]);

      const p1ChatId = parseInt(p1, 10);
      const p2ChatId = parseInt(p2, 10);

      await Promise.all([
        ctx.api.sendMessage(p1ChatId, "Match found! Place ships now or Auto-place.", {
          reply_markup: confirmKeyboard,
        }),
        ctx.api.sendMessage(p2ChatId, "Match found! Place ships now or Auto-place.", {
          reply_markup: confirmKeyboard,
        }),
      ]);
      return;
    }
  }

  await ctx.editMessageText("Looking for a match...");
});

export default composer;