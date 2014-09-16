/**
 * utils
 */
var shortId = require('shortid');

function genId(){
  return shortId.generate();
}

exports.genId = genId;