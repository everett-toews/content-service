'use strict';
// Manage the SHA of the latest control repository commit.

const restify = require('restify');
const request = require('request');
const urljoin = require('urljoin');

const config = require('../config');
const storage = require('../storage');
const logger = require('../logging').getLogger();

exports.store = function (req, res, next) {
  if (req.params.sha === undefined) {
    return next(new restify.InvalidContentError('Missing required "sha" attribute'));
  }

  if (!/[0-9a-fA-F]{40}/.test(req.params.sha)) {
    return next(new restify.InvalidContentError('Not a valid "sha"'));
  }

  storage.storeSHA(req.params.sha, (err) => {
    next.ifError(err);

    res.send(204);

    logger.info('Stored control repository SHA', {
      sha: req.params.sha
    });
    next();
  });
};

exports.retrieve = function (req, res, next) {
  if (config.proxyUpstream()) {
    request(urljoin(config.proxyUpstream(), 'control')).pipe(res);
    return next();
  }

  storage.getSHA((err, sha) => {
    next.ifError(err);

    res.json(200, {sha: sha});
    next();
  });
};
