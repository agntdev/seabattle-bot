import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { newUser, userStorage } from "../models/user.js";
import { inlineKeyboard, inlineButton } from "../toolkit/ui/keyboard.js";

const composer = new Composer<Ctx>();

composer.command("start", async (ctx, next) => {
  if (ctx.match?.trim().startsWith("invite_")) {
    return next();
  }
  if (!ctx.from) {
    await ctx.reply("This command can only be used in private chat.");
    return next();
  }
  await userStorage.create(newUser(ctx.from.id, ctx.from.first_name));
  await ctx.reply(
    `Welcome, ${ctx.from.first_name}! Your profile has been created.\nReady to get started?`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Get Started", "onboarding:start")],
      ]),
    },
  );
  await next();
});

composer.callbackQuery("onboarding:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Great, you're all set!");
});

composer.command("register", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("This command can only be used in private chat.");
    return;
  }
  const existing = await userStorage.read(ctx.from.id);
  if (existing) {
    await ctx.reply("You are already registered.");
    return;
  }
  const user = newUser(ctx.from.id, ctx.from.first_name);
  await userStorage.create(user);
  await ctx.reply(`Registered! Your rating is ${user.rating}.`);
});

composer.command("profile", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("This command can only be used in private chat.");
    return;
  }
  const user = await userStorage.read(ctx.from.id);
  if (!user) {
    await ctx.reply("You are not registered yet. Use /register.");
    return;
  }
  const total = user.wins + user.losses;
  const winRate = total > 0 ? Math.round((user.wins / total) * 100) : 0;
  await ctx.reply(
    `Name: ${user.display_name}\nRating: ${user.rating}\nWins: ${user.wins}\nLosses: ${user.losses}\nWin rate: ${winRate}%`,
  );
});

export default composer;