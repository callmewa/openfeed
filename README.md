openfeed
========
test
instructions:

    npm install
    mocha


dev instructions:
    DEBUG=* node app.js



examples

    POST : localhost:3000/api/v1/post
    Content-Type : application/json


    { "post":
      {
        "postId": "post1",
        "userId": "user1",
        "postType": "text",
        "message": "this is a post"
      }
    }


    For authenticate request

    Authorization: Basic d2E6d2E=