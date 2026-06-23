import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  matchInviteStorage,
  isExpired,
  validateCode,
} from "../models/invite.js";

const composer = new Composer<Ctx>();

composer.command("createinvite", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("This command can only be used in private chat.");
    return;
  }
  const args = ctx.message?.text?.trim().split(/\s+/) ?? [];
  if (args.length < 2) {
    await ctx.reply("Usage: /createinvite <ttl_minutes>");
    return;
  }
  const ttlMinutes = parseInt(args[1], 10);
  if (isNaN(ttlMinutes) || ttlMinutes <= 0) {
    await ctx.reply("TTL must be a positive integer (minutes).");
    return;
  }
  const ttlMs = ttlMinutes * 60 * 1000;
  const invite = await matchInviteStorage.create(ctx.from.id, ttlMs);
  await ctx.reply(`Invite created.\nCode: ${invite.code}`);
});

composer.command("checkinvite", async (ctx) => {
  if (!ctx.from) {
    await ctx.reply("This command can only be used in private chat.");
    return;
  }
  const args = ctx.message?.text?.trim().split(/\s+/) ?? [];
  if (args.length < 2) {
    await ctx.reply("Usage: /checkinvite <code>");
    return;
  }
  const code = args[1];
  const validationError = validateCode(code);
  if (validationError) {
    await ctx.reply(`Invalid code: ${validationError}`);
    return;
  }
  const invite = await matchInviteStorage.read(code);
  if (!invite) {
    await ctx.reply("Invite not found.");
    return;
  }
  if (isExpired(invite)) {
    await ctx.reply(`Invite ${invite.code} has expired.`);
    return;
  }
  await ctx.reply(
    `Invite ${invite.code}\nHost: ${invite.host_id}\nStatus: active`,
  );
});

export default composer;