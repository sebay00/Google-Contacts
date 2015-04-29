/**
 * @todo: recursively send requests until all contacts are fetched
 *
 * @see https://developers.google.com/google-apps/contacts/v3/reference#ContactsFeed
 *
 * To API test requests:
 *
 * @see https://developers.google.com/oauthplayground/
 *
 * To format JSON nicely:
 *
 * @see http://jsonviewer.stack.hu/
 *
 * Note: The Contacts API has a hard limit to the number of results it can return at a
 * time even if you explicitly request all possible results. If the requested feed has
 * more fields than can be returned in a single response, the API truncates the feed and adds
 * a "Next" link that allows you to request the rest of the response.
 */
var EventEmitter = require("events").EventEmitter;
var _            = require("underscore");
var qs           = require("querystring");
var util         = require("util");
var url          = require("url");
var https        = require("https");
var querystring  = require("querystring");

var GoogleContacts = function (opts) {
  if (typeof opts === "string") {
    opts = { token: opts }
  }

  if (!opts) {
    opts = {};
  }

  this.contacts       = [];
  this.consumerKey    = opts.consumerKey;
  this.consumerSecret = opts.consumerSecret;
  this.token          = opts.token;
  this.refreshToken   = opts.refreshToken;
};

GoogleContacts.prototype = {};

util.inherits(GoogleContacts, EventEmitter);


GoogleContacts.prototype._get = function (params, cb) {
  var self = this;

  if (typeof params === "function") {
    cb = params;
    params = {};
  }

  var req = {
    host: "https://www.google.com",
    port: 443,
    path: this._buildPath(params),
    method: "GET",
    headers: {
      "Authorization": "OAuth " + this.token
    }
  };


  https.request(req, function (res) {
    var data = "";

    res.on("end", function () {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        var error = new Error("Bad client request status: " + res.statusCode);
        return cb(error);
      }

      try {
        data = JSON.parse(data);
        cb(null, data);
      }
      catch (err) {
        cb(err);
      }
    });

    res.on("data", function (chunk) {
      //console.log(chunk.toString());
      data += chunk;
    });

    res.on("error", function (err) {
      cb(err);
    });

    //res.on("close", onFinish);
  }).on("error", function (err) {
    cb(err);
  }).end();
};

GoogleContacts.prototype.getContacts = function (cb) {
  var self = this;

  this._get({ type: "contacts" }, receivedContacts);
  function receivedContacts(err, data) {
    if (err) return cb(err);

    self._saveContactsFromFeed(data.feed);

    var next = false;
    data.feed.link.forEach(function (link) {
      if (link.rel === "next") {
        next = true;
        var path = url.parse(link.href).path;
        self._get({ path: path }, receivedContacts);
      }
    });
    if (!next) {
      cb(null, self.contacts);
    }
  }
};

GoogleContacts.prototype._saveContactsFromFeed = function (feed) {
  var self = this;
  //console.log(feed);
  feed.entry.forEach(function (entry) {
    try {
      var name = entry.title["$t"];
      var email = entry["gd$email"][0].address; // only save first email
      self.contacts.push({ name: name, email: email });
    }
    catch (e) {
      // property not available...
    }
  });
  console.log(self.contacts);
  console.log(self.contacts.length);
};

GoogleContacts.prototype._buildPath = function (params) {
  if (params.path) return params.path;

  params                = params                || {};
  params.type           = params.type           || "contacts";
  params.alt            = params.alt            || "json";
  params.projection     = params.projection     || "full";
  params.email          = params.email          || "default";
  params["max-results"] = params["max-results"] || 2000;

  var query = {
    "alt":          params.alt,
    "max-results":  params["max-results"]
  };

  var params  = ["type", "email", "projection"];
  var path    = "/m8/feeds";

  params.forEach(function(i) { path+= "/" + params[i]; });
  path += "?" + qs.stringify(query);

  return path;
};

GoogleContacts.prototype.refreshAccessToken = function (refreshToken, cb) {
  if (typeof params === "function") {
    cb = params;
    params = {};
  }

  var data           = {};
  data.refresh_token = refreshToken;
  data.client_id     = this.consumerKey;
  data.client_secret = this.consumerSecret;
  data.grant_type    = "refresh_token";
  var body           = qs.stringify(data);

  var opts = {
    host: "https://accounts.google.com",
    port: 443,
    path: "/o/oauth2/token",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": body.length
    }
  };

  var req = https.request(opts, function (res) {
    var data = "";
    res.on("end", function () {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        var error = new Error("Bad client request status: " + res.statusCode);
        return cb(error);
      }
      try {
        data = JSON.parse(data);
        //console.log(data);
        cb(null, data.access_token);
      }
      catch (err) {
        cb(err);
      }
    });

    res.on("data", function (chunk) {
      //console.log(chunk.toString());
      data += chunk;
    });

    res.on("error", function (err) {
      cb(err);
    });

    //res.on("close", onFinish);
  }).on("error", function (err) {
    cb(err);
  });

  req.write(body);
  req.end();
};

exports.GoogleContacts = GoogleContacts;
