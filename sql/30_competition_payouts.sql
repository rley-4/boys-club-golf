-- =============================================================================
-- Competition payouts: Solo / Team / Carroll Cup
-- =============================================================================
-- Separate from Game payouts (migration 29) — these are buy-ins and payouts
-- for the season-long standings themselves (final Solo place, final Team
-- place, Carroll Cup outcome), not the daily round games. Same computed,
-- not-stored philosophy: nothing to keep in sync by hand.
--
-- Unlike the Game payouts (which auto-split a pot evenly), here the admin
-- explicitly sets a dollar amount for each finishing place — real payout
-- structures are usually top-heavy (1st gets more than an even split would
-- give), not an even division of the pot. A place with no amount set pays
-- nothing.
-- =============================================================================

create table if not exists competition_settings (
  id                  serial primary key,
  event_id            integer not null unique references events (id) on delete cascade,
  solo_buy_in         numeric(6,2) not null default 0,
  team_buy_in         numeric(6,2) not null default 0,
  carroll_cup_buy_in  numeric(6,2) not null default 0
);

create table if not exists competition_payout_places (
  id           serial primary key,
  event_id     integer not null references events (id) on delete cascade,
  competition  text not null check (competition in ('solo', 'team', 'carroll_cup')),
  place        integer not null check (place >= 1),
  amount       numeric(8,2) not null default 0,
  unique (event_id, competition, place)
);

alter table competition_settings enable row level security;
alter table competition_payout_places enable row level security;

create policy "read_authenticated" on competition_settings for select using (auth.role() = 'authenticated');
create policy "admin_write" on competition_settings for all using (is_admin_user()) with check (is_admin_user());

create policy "read_authenticated" on competition_payout_places for select using (auth.role() = 'authenticated');
create policy "admin_write" on competition_payout_places for all using (is_admin_user()) with check (is_admin_user());

-- -----------------------------------------------------------------------------
-- Solo: the place amount splits evenly across anyone tied for that exact
-- finishing rank (v_solo_year_rank already resolves the tiebreaker, so
-- ties here mean a genuine dead-heat even after that).
-- -----------------------------------------------------------------------------
create or replace view v_solo_competition_payout as
select
  vsr.player_id,
  vsr.event_id,
  round(cpp.amount / count(*) over (partition by vsr.event_id, vsr.year_rank), 2) as amount
from v_solo_year_rank vsr
join competition_payout_places cpp on cpp.event_id = vsr.event_id and cpp.competition = 'solo' and cpp.place = vsr.year_rank;

-- -----------------------------------------------------------------------------
-- Team: the place amount is per FINISH, split across both players on every
-- team tied at that finish (2 players x however many tied teams).
-- -----------------------------------------------------------------------------
create or replace view v_team_competition_payout as
select
  wp.player_id,
  vtr.event_id,
  round(cpp.amount / (2 * count(*) over (partition by vtr.event_id, vtr.year_rank)), 2) as amount
from v_team_year_rank vtr
join teams t on t.id = vtr.team_id
join competition_payout_places cpp on cpp.event_id = vtr.event_id and cpp.competition = 'team' and cpp.place = vtr.year_rank
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id);

-- -----------------------------------------------------------------------------
-- Carroll Cup: place 1 = winning side's pool, place 2 = losing side's pool,
-- each split evenly across everyone on that side. An exact tie (equal
-- points) splits BOTH places' amounts across everyone on both sides.
-- -----------------------------------------------------------------------------
create or replace view v_carroll_cup_competition_payout as
with standings as (
  select event_id, red_points, blue_points,
    case when red_points > blue_points then 'red'
         when blue_points > red_points then 'blue'
         else 'tie' end as outcome
  from v_carroll_cup_standings
),
side_counts as (
  select event_id, side, count(*) as n from carroll_cup_rosters group by event_id, side
)
select
  cr.player_id,
  cr.event_id,
  case
    when s.outcome = 'tie' then
      round((coalesce(p1.amount, 0) + coalesce(p2.amount, 0)) / nullif((select sum(n) from side_counts sc where sc.event_id = cr.event_id), 0), 2)
    when cr.side = s.outcome then
      round(coalesce(p1.amount, 0) / nullif((select n from side_counts sc where sc.event_id = cr.event_id and sc.side = cr.side), 0), 2)
    else
      round(coalesce(p2.amount, 0) / nullif((select n from side_counts sc where sc.event_id = cr.event_id and sc.side = cr.side), 0), 2)
  end as amount
from carroll_cup_rosters cr
join standings s on s.event_id = cr.event_id
left join competition_payout_places p1 on p1.event_id = cr.event_id and p1.competition = 'carroll_cup' and p1.place = 1
left join competition_payout_places p2 on p2.event_id = cr.event_id and p2.competition = 'carroll_cup' and p2.place = 2;

-- -----------------------------------------------------------------------------
-- Combined: winnings and buy-ins across all three competitions.
-- -----------------------------------------------------------------------------
create or replace view v_competition_winnings as
select player_id, event_id, sum(amount) as total_winnings
from (
  select player_id, event_id, amount from v_solo_competition_payout
  union all
  select player_id, event_id, amount from v_team_competition_payout
  union all
  select player_id, event_id, amount from v_carroll_cup_competition_payout
) x
group by player_id, event_id;

create or replace view v_competition_buyins as
select player_id, event_id, sum(amount) as total_buy_ins
from (
  select vsr.player_id, vsr.event_id, cs.solo_buy_in as amount
  from v_solo_year_rank vsr
  join competition_settings cs on cs.event_id = vsr.event_id

  union all

  select wp.player_id, vtr.event_id, cs.team_buy_in as amount
  from v_team_year_rank vtr
  join teams t on t.id = vtr.team_id
  join competition_settings cs on cs.event_id = vtr.event_id
  cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id)

  union all

  select cr.player_id, cr.event_id, cs.carroll_cup_buy_in as amount
  from carroll_cup_rosters cr
  join competition_settings cs on cs.event_id = cr.event_id
) x
group by player_id, event_id;

create or replace view v_competition_payouts as
select
  coalesce(w.player_id, b.player_id) as player_id,
  coalesce(w.event_id, b.event_id) as event_id,
  coalesce(w.total_winnings, 0) as total_winnings,
  coalesce(b.total_buy_ins, 0) as total_buy_ins,
  coalesce(w.total_winnings, 0) - coalesce(b.total_buy_ins, 0) as net
from v_competition_winnings w
full outer join v_competition_buyins b on b.player_id = w.player_id and b.event_id = w.event_id;

-- -----------------------------------------------------------------------------
-- Grand total: Game payouts (migration 29) + Competition payouts, combined.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_grand_total as
select
  coalesce(g.player_id, c.player_id) as player_id,
  coalesce(g.event_id, c.event_id) as event_id,
  coalesce(g.total_winnings, 0) + coalesce(c.total_winnings, 0) as total_winnings,
  coalesce(g.total_buy_ins, 0) + coalesce(c.total_buy_ins, 0) as total_buy_ins,
  (coalesce(g.total_winnings, 0) + coalesce(c.total_winnings, 0)) - (coalesce(g.total_buy_ins, 0) + coalesce(c.total_buy_ins, 0)) as net
from v_player_year_payouts g
full outer join v_competition_payouts c on c.player_id = g.player_id and c.event_id = g.event_id;
