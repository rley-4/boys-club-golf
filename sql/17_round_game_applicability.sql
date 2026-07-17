alter table rounds
  add column if not exists applies_skins boolean not null default true,
  add column if not exists applies_poker boolean not null default true,
  add column if not exists applies_low_net boolean not null default true,
  add column if not exists applies_ctp boolean not null default true;
