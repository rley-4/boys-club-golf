create table if not exists team_hole_results (
  id           serial primary key,
  round_id     integer not null references rounds (id) on delete cascade,
  team_id      integer not null references teams (id) on delete cascade,
  hole_number  integer not null check (hole_number between 1 and 18),
  net_score    integer,
  points       numeric(3,1) check (points in (0, 0.5, 1)),
  unique (round_id, team_id, hole_number)
);
