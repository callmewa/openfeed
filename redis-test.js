/**
 * Created by zwang on 7/29/14.
 */
var redis = require("redis"),
  client = redis.createClient();

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
  console.log("Error " + err);
});
client.incr("unique id", redis.print);
client.set("string key", "string val", redis.print);
client.hset("hash key", "hashtest 1", "some value", redis.print);
client.hset(["hash key", "hashtest 2", "some other value"], redis.print);

client.hset("feed:post", "123131", "Xiaoming Li added 3 photos from July 28 to the album 该说再见了朋友们 — with Zhi Wang and 6 others at Bozeman Yellowstone International Airport At Gallatin Field.", redis.print);


client.hkeys("hash key", function (err, replies) {
  console.log(replies.length + " replies:");
  replies.forEach(function (reply, i) {
    console.log("    " + i + ": " + reply);
  });
});

client.hgetall("feed:post", function (err, posts) {
  console.log(posts);
  client.quit();
});