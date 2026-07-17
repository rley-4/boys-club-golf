alter table rounds
  add column if not exists play_format text not null default 'stroke'
  check (play_format in ('stroke', 'scramble', 'alternate_shot'));
