## Project summary
Build a Telegram bot that provides a two-player asynchronous (turn-by-turn at any time) Battleship (морской бой) game using inline buttons only for gameplay controls (no slash commands for game actions). The bot must support player profiles, fair matchmaking, friend/ invite games, player statistics/leaderboard, and persistent game state so players can resume moves later. All player interactions (match invites, move notifications, result notifications) are delivered via Telegram messages with inline keyboards.

## Audience
Telegram users who want to play asynchronous two-player Battleship (casual and competitive). The bot supports quick matchmaking and private friend invites; players should be able to see their own profile and compete on stats.

## Core entities
- User (Telegram user id, display name, profile stats, rating, settings)
- Profile (public summary: rating, wins, losses, accuracy, streaks)
- Match / Game (id, playerA, playerB, turn, state, created_at, last_move_at)
- Board (10x10 grid per player, ship placements, revealed hits/misses)
- Ship (type/size, coordinates, orientation, sunk flag)
- Move (match_id, player_id, coordinate, result: miss/hit/sunk, timestamp)
- MatchInvite (invite code, host_id, expires_at, optional target user_id)
- RatingChange (match result adjustments for audit)

## Integrations & notification targets
- Telegram Bot API (primary): all UI delivered via private bot messages and inline keyboards. Notifications: "Your turn", "Invite to play", "Match found", "Match result".
- Database (Postgres / MySQL): persistent storage for users, matches, boards, moves, ratings, invites.
- Optional: Admin webhook or channel for errors/metrics (not required for MVP).

## Interaction flows (concrete)
1) Onboarding
   - When a user first messages the bot or follows a shared invite link, the bot creates a profile (uses Telegram user id and display name). No gameplay via slash commands; onboarding may show a single "Get started" inline button.
2) Main menu (inline keyboard)
   - Quick Match (start matchmaking)
   - Play with Friend (create or accept invite)
   - Profile / Stats
   - Leaderboard
   - Rules / How to play
3) Matchmaking (Quick Match)
   - User taps Quick Match → bot searches for opponent matching rating window (see Assumptions). If opponent found, both receive a match start message with inline buttons: "Place ships now" or "Auto-place".
   - If no opponent within short wait, expand search window; if still none, allow wait or switch to friend invite.
4) Friend games
   - Host taps "Play with Friend" → bot generates a single-use deep-link invite (t.me/YourBot?start=invite_<code>) and an inline "Share invite" button to forward or copy code. Invite expires (see Assumptions). The invite opens the bot for the invited user and creates the match.
5) Ship placement
   - Each player places ships via inline UI: a 10x10 inline keyboard representing their board; controls to select ship type, orientation (rotate), and place at a selected cell. Also provide "Auto-place all" and "Randomize" options. Players can review and confirm placement.
6) Gameplay (asynchronous)
   - When both players confirm placement, a match message is sent to both showing: opponent name, match id, and whose turn. The player whose turn it is gets an inline 10x10 keyboard representing the opponent grid (only showing known hits/misses). Player taps a cell to fire; bot replies immediately with result (Miss / Hit / Sunk) and updates both players' match messages.
   - After a move, the bot updates turn, stores move, and sends "Your turn" notification to the other player via a message with an inline button linking to the match.
   - All interactions are done with inline buttons; no slash commands required for moves.
7) End of match
   - When all ships of one player are sunk, the bot declares winner, updates statistics and rating, and offers inline options: "Rematch", "View replay", "Back to menu".
8) Notifications & timeouts
   - Each time an opponent plays, the waiting player gets a push message with an inline button to open the match. If a player does not move within the per-move timeout, they are auto-forfeited and the opponent wins (see Assumptions).

## Persistence
- Database stores full game state (boards, ships, moves) so players can resume after disconnect or long delays.
- Store timestamps for created_at, last_move_at for inactivity handling and analytics.
- Audit log of rating changes and completed matches.

## Payments
- None in MVP. No purchases or paid features. (Can add cosmetics or boosters in future.)

## Non-goals (MVP)
- No AI / single-player opponent implementation.
- No real-time simultaneous live matches (no websockets/inline streaming required; asynchronous only).
- No in-game chat beyond simple system messages (optional later).
- No external leaderboards beyond the in-bot leaderboard.

## Assumptions & defaults
- Board size: 10x10. Rationale: standard Battleship size, fits Telegram inline keyboard limits (100 buttons).
- Ship set: standard fleet — 1×4, 2×3, 3×2, 4×1 (total 10 ships). Rationale: familiar rule set and compact.
- Matchmaking rating system: Elo-like rating starting at 1200. Rationale: simple competitive matchmaking metric.
- Initial rating: 1200 for all new users. Rationale: common default for Elo systems.
- Matchmaking window: ±200 rating initially, expanding by 100 every 15s up to full range. Rationale: balance fairness and wait time.
- Per-move timeout (async): 7 days. After expiry, inactive player forfeits the match and opponent wins. Rationale: keeps matches bounded while allowing casual play.
- Invite links: deep-links of the form t.me/YourBot?start=invite_<code>; invite codes expire after 7 days or when used. Rationale: Telegram deep-links are the simplest friend-invite UX without access to contacts.
- Notifications: bot sends a push message on each opponent move ("Your turn") with an inline button to open the match. Rationale: predictable asynchronous UX.
- UI: entire gameplay via inline keyboards and bot messages; avoid slash commands for game actions. A /start fallback is allowed for onboarding if user opens bot from link.
- Database: relational DB (Postgres recommended) to persist users, matches, boards, moves, invites, and rating history. Rationale: transactional safety for moves and ratings.
- No payments or paid features in MVP. Rationale: keep scope minimal and focus on core gameplay.

If you want any of the assumptions changed (board size, ship set, rating system, per-move timeout, invite lifetime), tell me which one to adjust and I will update the brief accordingly.