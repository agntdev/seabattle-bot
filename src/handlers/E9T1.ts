import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { newUser, userStorage } from "../models/user.js";

const composer = new Composer<Ctx>();

composer.command("register", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("This command can only be used in private chat.");
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
  const wl = user.wins + user.losses || 1;
  const ratio = ((user.wins / wl) * 100).toFixed(0);
  await ctx.reply(
    `Name: ${user.display_name}\nRating: ${user.rating}\nWins: ${user.wins}\nLosses: ${user.losses}\nWin rate: ${ratio}%`,
  );
});

export default composer;