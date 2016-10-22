'use strict';

const HttpError = require('../util/httpError');

function parseSlackMessage(body) {
  // sample body.text: 'emojify {IMAGE_SRC} as {EMOJI_NAME}'
  // also supports leaving off the 'as'
  let messageParts = body.text.split(' ');

  if(messageParts[0] === body.trigger_word) {
    messageParts.shift();
  }

  if(messageParts.length < 2) {
    throw new HttpError(400, "I'm afraid I don't understand your request, sorry. :shrug_bot:");
  }

  const src = messageParts[0];
  const emojiName = messageParts[1] === 'as' ? messageParts[2] : messageParts[1];

  return [{
    name: emojiName,
    src: src
  }];
}

module.exports = {
  parseSlackMessage
};
