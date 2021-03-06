'use strict';

const cheerio = require('cheerio');
const co = require('co');
const R = require('ramda');
const thunkify = require('thunkify-wrap');
const request = thunkify(require('request'));
const req = require('request');
const constants = require('./constants');
const HttpError = require('./httpError');

const loginFormPath = '/?no_sso=1';
const emojiUploadFormPath = '/admin/emoji';
const emojiUploadImagePath = '/customize/emoji';

/**
 * Initialize a new `Slack`.
 */
function Slack(data) {
  if (!(this instanceof Slack)) return new Slack(data);
  this.opts = data;

  /**
   * Import our emojis to Slack.
   */
  this.import = function *(emojis) {
    if(!this.opts.uploadCrumb) {
      yield this.init();
    }

    this.opts.emojis = emojis;
    console.log('Getting emoji page');

    for (var i = 0; i < Object.keys(this.opts.emojis).length; i++) {
      let e = this.opts.emojis[i];

      const uploadRes = yield this.upload(e.name, e.src, e.alias);
      var $ = cheerio.load(uploadRes);
      const error = $('.alert.alert_error', '#page_contents').text();

      if(error) {
        throw new HttpError(200, constants.SLACK_ERROR_MESSAGE_FN(error.trim()));
      }
    }
    console.log('Uploaded emojis');
    return 'Success';
  };

  this.init = function *() {
      console.log('Starting import');
      yield this.tokens();
      console.log('Got tokens');
      yield this.login();
      console.log('Logged in');
      yield this.emoji();
  }

  /**
   * Get login page (aka credentials).
   */
  this.tokens = function *() {
    var opts = this.opts;
    opts.jar = opts.jar || { _jar: { store: { idx: {} } } };
    var load = {
      url: opts.url + loginFormPath,
      jar: opts.jar,
      method: 'GET'
    };
    var res = yield request(load);
    var $ = cheerio.load(res[0].body);
    opts.formData = {
      signin: $('#signin_form input[name="signin"]').attr('value'),
      redir: $('#signin_form input[name="redir"]').attr('value'),
      crumb: $('#signin_form input[name="crumb"]').attr('value'),
      remember: 'on',
      email: opts.email,
      password: opts.password
    };
    if (!opts.formData.signin && !opts.formData.redir && !opts.formData.crumb) throw new Error('Login error: could not get login form for ' + opts.url);
    return this.opts = opts;
  };

  /**
   * Log in to Slack and populate cookies.
   */
  this.login = function *() {
    var opts = this.opts;
    var load = {
      url: opts.url + loginFormPath,
      jar: opts.jar,
      method: 'POST',
      followAllRedirects: true,
      formData: opts.formData
    };
    var res = yield request(load);
    return this.opts = opts;
  };

  /**
   * Get the emoji upload page.
   */
  this.emoji = function *() {
    var opts = this.opts;
    var load = {
      url: opts.url + emojiUploadFormPath,
      jar: opts.jar,
      method: 'GET'
    };
    var res = yield request(load);
    var $ = cheerio.load(res[0].body);
    opts.uploadCrumb = $('#addemoji > input[name="crumb"]').attr('value');
    console.log('Upload crumb is %s', opts.uploadCrumb);
    if (!opts.uploadCrumb) throw new Error('Login error: could not get emoji upload crumb for ' + opts.url);
    return this.opts = opts;
  };

  /**
   * Upload the emoji.
   */
  this.upload = function *(name, emoji, alias) {
    console.log('Attempting to upload %s with alias[%s] or url[%s]', name, alias, emoji);
    var opts = this.opts;
    var load = {
      url: opts.url + emojiUploadFormPath,
      jar: opts.jar,
      method: 'GET'
    };
    var res = yield request(load);

    return new Promise(function(resolve, reject, notify) {
      var opts = this.opts;
      var r = req({
        url: opts.url + emojiUploadImagePath,
        method: 'POST',
        jar: opts.jar,
        followAllRedirects: true
      }, function(err, res, body) {
        if (err || !body) return reject(err);
        resolve(body);
      });
      var form = r.form();
      form.append('add', '1');
      form.append('crumb', opts.uploadCrumb);
      form.append('name', name);

      if(emoji) {

        // var dir = 'test.png';
        //
        // var imageRequest = req({
        //   url: emoji,
        //   method: 'GET',
        //   jar: opts.jar
        // });
        //
        // console.log("image directory: ", process.cwd() + '/' + dir);
        // console.log("process.cwd():", process.cwd());
        // console.log("__filename:", __filename);
        // console.log("__dirname:", __dirname);
        //
        // var writeStream = fs.createWriteStream(dir);
        // var graphics = gm(imageRequest)
        // .resize('128', '128')
        // .stream()
        // .pipe(writeStream);

        form.append('mode', 'data');
        form.append('img', req(emoji));
      }
      else {
        form.append('mode', 'alias');
        form.append('alias', alias);
      }
    }.bind(this));
  };

}

module.exports = Slack;
