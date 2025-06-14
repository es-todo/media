create table photo (
  id uuid not null primary key,
  user_id text not null,
  filename text not null,
  uploaded_at timestamp without time zone not null default now(),
  exif jsonb null,
  data bytea not null
);

create table photo_rev (
  rev_t bigint not null primary key,
  photo_id uuid not null,
  foreign key (photo_id) references photo (id)
);
