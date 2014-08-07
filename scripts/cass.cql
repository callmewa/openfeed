CREATE TABLE user_post (
  user_id timeuuid,
  post_id timeuuid,
  message text,
  PRIMARY KEY (user_id, post_id)
);

insert into user_post (user_id, post_id, message) values (a09e1a00-1dcb-11e4-8aff-eff726afad06, now(), 'this is my first post');
insert into user_post (user_id, post_id, message) values (a09e1a00-1dcb-11e4-8aff-eff726afad06, now(), 'this is my second post');
insert into user_post (user_id, post_id, message) values (a58b3d90-1dcb-11e4-8aff-eff726afad06, now(), 'this is my post');
