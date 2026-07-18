-- =============================================================================
-- Payouts: buy-ins and winnings, rolled up per player per year
-- =============================================================================
-- Everything here is computed, not stored — same pattern as the rest of
-- this app (standings, Record Book, etc.). A player's winnings are always
-- derived fresh from game_settings + the actual results, so there's no
-- "add to balance" step to remember, and no risk of it drifting out of
-- sync if a winner gets corrected or a buy-in changes after the fact.
--
-- poker_buy_in already exists (migration 06) — this builds the payout
-- views on top of it, it doesn't add anything new to the schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Poker: base buy-in (flat per player) + 3-putt penalties, combined into one pot.
-- -----------------------------------------------------------------------------
create or replace view v_poker_payout as
select
  pr.round_id,
  pr.winner_player_id,
  coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0) as total_three_putts,
  (gs.poker_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = pr.round_id))
    + (gs.poker_three_putt_buy_in * coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0)) as pot,
  (select count(distinct s.player_id) from scores s where s.round_id = pr.round_id) as participants,
  gs.poker_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = pr.round_id) as buy_in_pot,
  gs.poker_three_putt_buy_in
    * coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0) as three_putt_pot
from poker_results pr
join rounds r on r.id = pr.round_id
join game_settings gs on gs.event_id = r.event_id;

-- -----------------------------------------------------------------------------
-- CTP: buy-in is per round, per player (not per hole). Pot = buy-in x
-- participants; split evenly across however many par-3 holes the round's
-- ACTUAL course has (not assumed to be 4).
-- -----------------------------------------------------------------------------
create or replace view v_ctp_par3_holes as
select r.id as round_id, ch.hole_number
from rounds r
join course_holes ch on ch.course_id = r.course_id and ch.par = 3;

create or replace view v_ctp_payout as
select
  r.id as round_id,
  r.event_id,
  gs.ctp_prize as ctp_buy_in,
  (select count(distinct s.player_id) from scores s where s.round_id = r.id) as participants,
  (select count(*) from v_ctp_par3_holes p3 where p3.round_id = r.id) as par3_holes,
  gs.ctp_prize * (select count(distinct s.player_id) from scores s where s.round_id = r.id) as total_pot,
  case when (select count(*) from v_ctp_par3_holes p3 where p3.round_id = r.id) > 0 then
    round(
      (gs.ctp_prize * (select count(distinct s.player_id) from scores s where s.round_id = r.id))
      / (select count(*) from v_ctp_par3_holes p3 where p3.round_id = r.id),
      2
    )
  else null end as value_per_hole
from rounds r
join game_settings gs on gs.event_id = r.event_id;

-- -----------------------------------------------------------------------------
-- Per-player payout rows, one game at a time — each only counts rounds
-- where that game is actually flagged applicable, even though the
-- underlying result views (v_skins, v_low_net_solo_winners, etc.) don't
-- check that flag themselves.
-- -----------------------------------------------------------------------------

-- Skins: one payout row per skin won.
create or replace view v_skins_player_payout as
select sk.winner_player_id as player_id, r.event_id, sk.round_id, sp.value_per_skin as amount
from v_skins sk
join rounds r on r.id = sk.round_id and r.applies_skins = true
join v_skins_payout sp on sp.round_id = sk.round_id;

-- Low Net Solo: pot split evenly across everyone tied for lowest net.
create or replace view v_low_net_solo_payout as
select
  w.player_id,
  r.event_id,
  w.round_id,
  round(
    (gs.low_net_solo_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = w.round_id))
    / (select count(*) from v_low_net_solo_winners w2 where w2.round_id = w.round_id),
    2
  ) as amount
from v_low_net_solo_winners w
join rounds r on r.id = w.round_id and r.applies_low_net = true
join game_settings gs on gs.event_id = r.event_id;

-- Low Net Team: buy-in is per PLAYER (pot = buy-in x total participants,
-- same convention as the other games). Tied winning teams split the pot
-- evenly across every player on every tied team — e.g. two teams tied
-- means 4 players split it, not 2 splits of a per-team half.
create or replace view v_low_net_team_payout as
with pot as (
  select
    w.round_id,
    gs.low_net_team_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = w.round_id) as total_pot,
    (select count(*) from v_low_net_team_winners w2 where w2.round_id = w.round_id) as winning_teams
  from (select distinct round_id from v_low_net_team_winners) w
  join rounds r on r.id = w.round_id and r.applies_low_net = true
  join game_settings gs on gs.event_id = r.event_id
)
select
  wp.player_id,
  r.event_id,
  w.round_id,
  round(pot.total_pot / (pot.winning_teams * 2), 2) as amount
from v_low_net_team_winners w
join teams t on t.id = w.team_id
join pot on pot.round_id = w.round_id
join rounds r on r.id = w.round_id
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id);

-- Poker: winner takes the whole pot.
create or replace view v_poker_player_payout as
select pp.winner_player_id as player_id, r.event_id, pp.round_id, pp.pot as amount
from v_poker_payout pp
join rounds r on r.id = pp.round_id and r.applies_poker = true;

-- CTP: each hole's winner gets that hole's split of the round's pot.
create or replace view v_ctp_player_payout as
select cr.player_id, r.event_id, cr.round_id, cp.value_per_hole as amount
from ctp_results cr
join rounds r on r.id = cr.round_id and r.applies_ctp = true
join v_ctp_payout cp on cp.round_id = cr.round_id;

-- -----------------------------------------------------------------------------
-- Winnings, all five payout sources combined, per player per year.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_winnings as
select player_id, event_id, sum(amount) as total_winnings
from (
  select player_id, event_id, amount from v_skins_player_payout
  union all
  select player_id, event_id, amount from v_low_net_solo_payout
  union all
  select player_id, event_id, amount from v_low_net_team_payout
  union all
  select player_id, event_id, amount from v_poker_player_payout
  union all
  select player_id, event_id, amount from v_ctp_player_payout
) all_payouts
group by player_id, event_id;

-- -----------------------------------------------------------------------------
-- Buy-ins owed, per player per year. Assumption, since there's no separate
-- "who opted into which game" tracking: anyone who logged any score for a
-- round is assumed to have bought into every game flagged applicable for
-- that round (Low Net Team only if they're actually on a team that year).
-- Poker's 3-putt penalty is per-player, based on their own putting that
-- round, not a flat fee. Flag if participation actually varies more than
-- this in practice — this would need a real opt-in table to track properly.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_buyins as
select
  s.player_id,
  r.event_id,
  sum(
    (case when r.applies_skins then gs.skins_buy_in else 0 end)
    + (case when r.applies_poker then gs.poker_buy_in + gs.poker_three_putt_buy_in * coalesce(pc.three_putts, 0) else 0 end)
    + (case when r.applies_low_net then gs.low_net_solo_buy_in else 0 end)
    + (case when r.applies_low_net and exists (
        select 1 from teams t where t.event_id = r.event_id and (t.player_a_id = s.player_id or t.player_b_id = s.player_id)
      ) then gs.low_net_team_buy_in else 0 end)
    + (case when r.applies_ctp then gs.ctp_prize else 0 end)
  ) as total_buy_ins
from (select distinct round_id, player_id from scores) s
join rounds r on r.id = s.round_id
join game_settings gs on gs.event_id = r.event_id
left join v_poker_cards pc on pc.round_id = s.round_id and pc.player_id = s.player_id
group by s.player_id, r.event_id;

-- -----------------------------------------------------------------------------
-- Net view combining both — this is what the Games admin payouts table reads.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_payouts as
select
  coalesce(w.player_id, b.player_id) as player_id,
  coalesce(w.event_id, b.event_id) as event_id,
  coalesce(w.total_winnings, 0) as total_winnings,
  coalesce(b.total_buy_ins, 0) as total_buy_ins,
  coalesce(w.total_winnings, 0) - coalesce(b.total_buy_ins, 0) as net
from v_player_year_winnings w
full outer join v_player_year_buyins b on b.player_id = w.player_id and b.event_id = w.event_id;
