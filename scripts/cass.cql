/* For production, we will use higher replication_factor. */
/* 
./cqlsh
CREATE KEYSPACE myks WITH replication = {'class': 'SimpleStrategy', 'replication_factor' : 3};
use myks;
source '~/openfeed/scripts/cass.cql'
*/

/* user table. User choose user name instead of using real name, like Instragram. May need to create an index table on facebook_id. */
CREATE TABLE user (
    user_id ascii, // unique user name. QUESTION: should we allow user to change user name?
    bio varchar, // optional, user bio
    web_site varchar, // optional, user website
    email_address varchar, // email address
    gender ascii, // optional (default M), M or F
    phone ascii, // optional, phone number
    profile_image_url varchar, // optional, url to user profile image. We may allow multiple profile images?
    zipcode ascii, // optional, zip code users fills during sign up. optional.
    is_system boolean, // optional (default false), is system user?
    is_test boolean, // optional (default false), is test user?
    facebook_id varchar, // optional, facebook id
    facebook_token varchar, // optional, facebook auth token (need to do some research on facebook login)
    password_salt varchar, // password salt
    password_hash varchar, // password hash
    time_updated timestamp, // last update
    PRIMARY KEY (user_id)
);

/* user's kid. One user can have one or many kids. */
CREATE TABLE kid(
    user_id ascii, // user id in user table
    name varchar, // name of kid
    birthday ascii, // 19800209
    school_year_start ascii, // optional, school year start at year x.
    gender ascii, // M/F
    PRIMARY KEY (user_id, name)
);

/* user activity log (I wonder whether we need this table) */
/* user activity log (I wonder whether we need this table) */
CREATE TABLE activity (
    user_id ascii, // user id
    time_activity timeUUID, //
    activity varchar, // user activity log
    PRIMARY KEY(user_id, time_activity)
) WITH CLUSTERING ORDER BY (time_activity DESC);

/* user settings -- privacy settings and notification settings. */
CREATE TABLE setting (
    user_id ascii, // user id
    notif_vibrate boolean, // optional (default true), vibrate on notification
    notif_sound boolean, //  optional (default true), sound on notification
    notif_led boolean,  // optional (default true), light led on notification
    notif_on_comment boolean, // optional (default true)
    notif_on_like boolean, // optional (default true), 
    follow_setting ascii, // optional(default need_approve), need_approve/public/not_allowed
    notif_follow_request_received  boolean, // optional(default true) notification on follow request
    notif_follow_request_accepted boolean, // optional(default true), notification on follow request
    PRIMARY KEY (user_id)
);

/* keep track of the user’s latest geo location. */
CREATE TABLE user_geo (
    user_id ascii, // user id in user table
    time_recorded timestamp,
    geo_location ascii, // latest user location
    zipcode ascii, // zip code
    PRIMARY KEY (user_id, time_recorded)
) WITH CLUSTERING ORDER BY (time_recorded DESC);

/* users followed by users */
CREATE TABLE followed_by (
    user_id ascii,  // user id of the user being followed
    follower_id ascii, // user id of the user following the other
    is_facebook_friends boolean, // are they facebook friends
    PRIMARY KEY (user_id, follower_id)
);

/* users follow other users */
CREATE TABLE follow (
    user_id ascii, // user id of the user who follow others
    following_id ascii, // user id of the user is following
    PRIMARY KEY(user_id, following_id)
);

/* This table stores all the posts. The primary key is (date, post_id). So the data in this table are partitioned by day, and for each data, the data are clustered and sorted by the time the posts are created. So when necessary, we can load history data day by day into Redis. */
CREATE TABLE post (
    date varchar, // 20140528, the date part of post_id, which is the date post is created
    post_id timeUUID, // post id. It is timeUUID, so the timestamp is the time the post is created
    user_id ascii, // id of user that writes the post
    post_type ascii, // text, picture, product, article, question
    post_category ascii, // 3m, 1 year, school year 2, etc, the category of the post
    for_gender ascii, // optional, F/M
    message text, // optional, the message of the post
    picture_url varchar, // optional, url of the picture, we can save the picture in S3 server
    external_link_url varchar, // optional, url of a product, article, or any external url
    external_link_image_url varchar, // optional, url to the image in external link. Can be image url for a product url
    external_link_summary varchar, // optional, short summary of the external link. It can be the preview summary of the content of external link
    product_bar_code varchar, // optional, bar code of product
    publicity ascii, // optional (default P), P for public, F for follower only, V for private
    is_question boolean, // optional (default false), is it a question?
    is_answered boolean, // optional (default false), is the question answered. Only valid for question post
    question_points int, // optional, points for the question. Only valid for question post.
    question_reach_percentage int, // optional, reach percentage for this question. Only valid for question post.
    is_product boolean, // optional (default false), whether it is a product post.
    likes int, // how many likes the post received
    comments int, // the number of comments on the post
    is_anonymous boolean, // optional (default false), whether the comment is anonymous
    status ascii, // optional, spam, inappropriate, irrelevant
    time_created timestamp, // timestamp of the post created
    time_edited timestamp, // timestamp the post being edited
    time_commented timestamp, // timestamp of the post being commented.
    time_lastupdated timestamp, // timestamp of last edited or last commented.
    PRIMARY KEY (date, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);

/* user's comments on a post. The primary key is (post_id, comment_id). So comments are partitioned by post_id, and the comments are clustered and sort by timestamp (comment_id) in each post. */
CREATE TABLE comment (
    post_id timeUUID, // post id
    comment_id timeUUID, // comment id
    commenter_user_id varchar, // user id of the commenter
    message text, // comment message
    picture_url varchar, // url to picture in the comment
    likes int, // number of likes for this comment
    is_anonymous boolean, // whether the comment is anonymous
    is_answer boolean, // optional (default false), Is it an answer to a question? Only valid for answer comments on question post
    is_accepted_answer boolean, // optional (default false), Is it an answer accepted? Only valid for answer comments on question post
    answer_points_earned int, // optional, points earned. Only valid for answer comments on question post.
    status ascii, // optional, 'spam', 'inappropriate', 'irrelevant'
    time_created timestamp, // timestamp of the comment being created
    time_edited timestamp, // timestamp the comment being edited
    PRIMARY KEY (post_id, comment_id)
) WITH CLUSTERING ORDER BY (comment_id DESC);

/* likes on a post. The primary key is (post_id, liker_user_id). So E post_like are partitioned by post_id. */
CREATE TABLE post_like (
    post_id timeUUID, // post id
    like_user_id varchar, // user id of the user likes this post
    like_time timestamp, // timestamp of the like
    PRIMARY KEY (post_id, like_user_id)
);

/* feed generated for each user. The feed for each user is generated from 4 sources:
First, feed_candidate, which is pushed from posts of the user you followed
Second, pull of system articles
Third, pull of post of users that have kids with similar age.
Fourth, user questions.
The primary key is (user_id, feed_id). So comments are partitioned by user_id, and the comments are clustered and sort by timestamp (feed_id) in each post.
 */
CREATE TABLE feed (
    user_id varchar,  // id of user, feed for this user
    feed_id timeUUID, // unique feed id, which includes timestamp of this record inserted into this table
    post_id timeUUID, // post id
    time_inserted timestamp, // The time the feed is inserted into this table.
    score int, // score of the post to the user based on user relationship, how refresh the post is (now - timestamp), number of likes and number of comments.
    PRIMARY KEY (user_id, feed_id)
) WITH CLUSTERING ORDER BY (feed_id DESC);

/* This table stores pre-generated post to be selected into users' feed. They are real-time posts pushed from other users that is followed by this user. The items in the table will be selectively moved to feed table at feed generation time. */
CREATE TABLE feed_buffer (
    user_id varchar, // id of user to prepare feed candidate for
    feed_buffer_id timeUUID, // unique id, which contains the timestamp the row is inserted
    post_id timeUUID, // post id
    score int, // score of the post based on relationship, like count and comment count
    time_inserted timestamp, // the timestamp of the row is inserted.
    PRIMARY KEY (user_id, feed_buffer_id)
) WITH CLUSTERING ORDER BY (feed_buffer_id DESC);

/* system users. Use this table and post table can get system posts to suggest to all uses. */
CREATE TABLE system_user (
    user_id ascii PRIMARY KEY, // user id
);

/* Posts by categories. It will be used when user explore posts by category. */
CREATE TABLE category_posts (
   post_category ascii, // post category
   post_id timeUUID, // post id
   PRIMARY KEY (post_category, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);

/* Divide system posts into different buckets based on post category (3m, 1y, 1-2y, etc). */
CREATE TABLE system_post_bucket (
    post_category ascii, // post category
    post_id timeUUID, // post id
    PRIMARY KEY (post_category, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);

/* This table stores popular posts by kid age bucket. So, the popular posts can be pulled to users’ feed based on kid age. The table divides popular post into different buckets based on post category (3m, 1y, 1-2y, etc)
*/
CREATE TABLE popular_post_bucket (
    post_category_date ascii, // post category:YYMM, YYMM is date (year and month) of timestamp part from post_id. It is needed to make sure the tables is evenly partitioned.
    post_id timeUUID, // post id
    likes int, // count of likes
    comments int, // count of comments
    score int, // score of the post, currently let’s set it to comments * 2 + likes.
    PRIMARY KEY (post_category_date, post_id)
) WITH CLUSTERING ORDER BY (post_id DESC);

/* Divide question posts into different buckets based on post category (3m, 1y, 1-2y, etc). */
CREATE TABLE question_post_bucket (
    post_category ascii, // post category
    uid timeUUID, // unique id, which contains the timestamp of the row being inserted into the table.
    post_id timeUUID, // post id
    PRIMARY KEY (post_category, uid)
) WITH CLUSTERING ORDER BY (uid DESC);

/* keep track of which system posts have been suggested to each user to avoid double suggestion on the same system posts. For each user and each system post category, there will be two timestamp indexes, lowerTimestamp and upperTimestamp. The posts between lowerTimestamp and upperTimestamp are posts that have been suggested and considered to suggested to the user, and they will not be suggested to the user again. */
CREATE TABLE system_post_suggestion_track (
    user_id ascii, // id of user, to who to suggest system articles
    post_category ascii, // the category of the post
    lowerTimestamp timestamp, // optional, lower timestamp
    upperTimestamp timestamp, // optional, upper timestamp
    PRIMARY KEY(user_id, post_category)
);

/* keep track of which popular posts have been suggested to each user to avoid double suggestion on the same system posts. For each user and each system post category, there will be two timestamp indexes, lowerTimestamp and upperTimestamp. The posts between lowerTimestamp and upperTimestamp are posts that have been suggested and considered to suggested to the user, and they will not be suggested to the user again. */
CREATE TABLE popular_post_suggestion_track (
    user_id ascii, // id of user, to who to suggest system articles
    post_category ascii, // the category of the post
    lowerTimestamp timestamp, // optional, lower timestamp
    upperTimestamp timestamp, // optional, upper timestamp
    PRIMARY KEY(user_id, post_category)
);

/* keep track of which question posts have been suggested to each user to avoid double suggestion on the same system posts. For each user and each system post category, there will be two timestamp indexes, lowerTimestamp and upperTimestamp. The posts between lowerTimestamp and upperTimestamp are posts that have been suggested and considered to suggested to the user, and they will not be suggested to the user again. */
CREATE TABLE question_post_suggestion_track (
    user_id ascii, // id of user, to who to suggest system articles
    post_category ascii, // the category of the post
    lowerTimestamp timestamp, // optional, lower timestamp
    upperTimestamp timestamp, // optional, upper timestamp
    PRIMARY KEY(user_id, post_category)
);

/* user points. */
CREATE TABLE user_points (
    user_id ascii PRIMARY KEY, // user id in user table
    points counter // points remained
);

/* user levels, etc. */
CREATE TABLE user_stats (
    user_id ascii PRIMARY KEY, // user id in user table
    level int, // user level
    expert_level int, // expert level
    prefessional_level int, // professional level
    time_updated timeUuid
);

/* points statement, the statement of user points. */
CREATE TABLE points_statement (
    user_id ascii, // user id
    statement_id timeUUID, //unique statement id, which contains timestamp.
    points_change bigint, // points change, can be negative. Negative means points spent, and positive means points earn.
    time_updated timestamp, // timestamp of points change.
    note varchar, // cause of points change
    PRIMARY KEY (user_id, statement_id)
)  WITH CLUSTERING ORDER BY (statement_id DESC);

CREATE TABLE category_mapping (
    category_name ascii PRIMARY KEY, // post category e.g. 3m - 5m
    mapped_ids set<int>, // mapped age ids, e.g. [103,104,105], 0month is 100, 2m is 102, 1year is 113, 2 year is 114, 3 year is 115. 1week is 1, 2 week is 2, etc.
);

CREATE TABLE system_settings (
    name ascii PRIMARY KEY,
    value ascii
);
// Number of days’ posts that are saved in Redis
INSERT INTO system_settings (name, value) VALUES ('posts_days_in_memory', '90');
// Points assigned to a new user
INSERT INTO system_settings (name, value) VALUES ('new_user_points', '1000');
// Points earned per post
INSERT INTO system_settings (name, value) VALUES ('new_post_points', '20');
// Points earned per comment by the user
INSERT INTO system_settings (name, value) VALUES ('my_comment_points', '5');
// Points earned per comment by other users
INSERT INTO system_settings (name, value) VALUES ('their_comment_points', '10');
// Points earned per like by other users
INSERT INTO system_settings (name, value) VALUES ('their_like_points', '5');
// Valid post character count threshold. A post that contains more than 30 character will receive points.
INSERT INTO system_settings (name, value) VALUES ('min_valid_post_char_count', '30');
// Cost of a question.
INSERT INTO system_settings (name, value) VALUES ('question_cost', '100');

/* Product list of a user */
CREATE TABLE user_products (
    user_id ascii, // user id in user table
    post_id timeUUID, // product post id
    post_category ascii, // post catetory; duplicate form post table
    for_gender ascii, // optional, F/M; duplicate form post table
    message text, // optional, the message of the post; duplicate form post table
    picture_url varchar, // optional, url of the picture, we can save the picture in S3 server; duplicate form post table
    external_link_url varchar, // optional, url of a product, article, or any external url; duplicate form post table
    external_link_image_url varchar, // optional, url to the image in external link. Can be image url for a product url; duplicate form post table
    external_link_summary varchar, // optional, short summary of the external link. It can be the preview summary of the content of external link; duplicate form post table
    product_bar_code varchar, // optional, bar code of product; duplicate form post table
    publicity ascii, // optional (default P), P for public, F for follower only, V for private
    time_inserted timestamp, // timestamp of inserted of this record
    PRIMARY KEY (user_id, post_id)
);
CREATE INDEX user_products_category ON user_products (post_category);

/* User saved posts */
CREATE TABLE saved_posts (
    user_id ascii, // user id in user table
    post_id timeUUID, // product post id
    time_saved timestamp, // timestamp of save
    PRIMARY KEY (user_id, post_id)
);

//CREATE TABLE user_post (
//  user_id timeuuid,
//  post_id timeuuid,
//  message text,
//  PRIMARY KEY (user_id, post_id)
//);

//insert into user_post (user_id, post_id, message) values (a09e1a00-1dcb-11e4-8aff-eff726afad06, now(), 'this is my first post');
//insert into user_post (user_id, post_id, message) values (a09e1a00-1dcb-11e4-8aff-eff726afad06, now(), 'this is my second post');
//insert into user_post (user_id, post_id, message) values (a58b3d90-1dcb-11e4-8aff-eff726afad06, now(), 'this is my post');
