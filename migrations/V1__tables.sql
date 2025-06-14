create table photo (
  photo_id text not null primary key,
  filename text not null,
  uploaded_at timestamp without time zone not null default now(),
  data bytea not null
);

create table photo_rev (
  rev_t bigint not null primary key,
  photo_id text not null,
  foreign key (photo_id) references photo (photo_id)
);


create function add_photo (photo_id text, filename text, data bytea)
returns void as $$
  declare next_t bigint;
  begin
    next_t := (select coalesce(max(rev_t), 0) from photo_rev) + 1;
    insert into photo (photo_id, filename, data)
      values (photo_id, filename, data);
    insert into photo_rev (rev_t, photo_id)
      values (next_t, photo_id);
    perform pg_notify('photo_rev', concat(next_t, ':inserted:', photo_id));
  end;
$$ language plpgsql;


