"use strict";
let express = require('express');
let router = express.Router();

let requestExt = require('request-extensible');
let RequestHttpCache = require('request-http-cache');

let marked = require('marked');
let timeAgo = require('node-time-ago');

let httpRequestCache = new RequestHttpCache({
  max: 10*1024*1024, // Maximum cache size (1mb) defaults to 512Kb 
  ttl: 7200
});

let request = requestExt({
  extensions: [
    httpRequestCache.extension
  ]
});

let clientID = process.env.GITHUB_CLIENTID;
let clientSecret = process.env.GITHUB_SECRET;

let host = 'https://api.github.com/';
let auth = 'client_id=' + clientID + '&client_secret=' + clientSecret
let options = {
  headers: {
    'User-Agent': 'altany'
  }
};

let apiVersion = 'v3';

marked.setOptions({
  renderer: new marked.Renderer(),
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: false
});

function formatErrorResponse(response, message, repo) {
  return response.status(500).header( 'Content-Type', 'text/plain' ).end('Something went wrong when ' + message + (repo?' for ' + repo:''));
}

router.get('/repos', function(req, res) {
  options.url = host + 'users/altany/repos?sort=created&' + auth;
  request(options, function (error, response, body) {
    if (error) {
      console.error(error);
      return formatErrorResponse(res, 'getting the repos');
    }
    res.setHeader( 'Content-Type', 'application/json' );
    res.end(body);
  });
});

router.get('/readme/:repo', function(req, res) {
  options.url = host + 'repos/altany/' + req.params.repo + '/contents/README.md?' + auth;
  options.headers['Accept'] = 'application/vnd.github.' + apiVersion + '.raw';
  request(options, function (error, response, body) {
    if (error) {
      console.error(error);
      return formatErrorResponse(res, 'requesting the README.md', req.params.repo);
    }
    
    res.setHeader( 'Content-Type', 'text/html' );

    if (response.statusCode===404) {
      res.end('No description available  .');
    }
    else if (response.statusCode!==200) {
      console.warn('Error getting README content for ', req.params.repo);
      res.end('There was an error while getting this repo\'s README file');
    }
    else {
      res.end(marked(body).toString());
    }
  });
});

router.get('/last-commit/:repo', function(req, res) {
  options.url = host + 'repos/altany/' + req.params.repo + '/commits?' + auth;
  request(options, function (error, response, body) {
    if (error) {
      console.error(error);
      return formatErrorResponse(res, 'requesting the commits history', req.params.repo);
    }
    res.setHeader( 'Content-Type', 'application/json' );
    let commit = JSON.parse(body)[0];
    let result = {};
    if (response.statusCode!==200) {
      console.warn('Error getting the commits list for', req.params.repo);
      result.message = 'There was an error while getting this repo\'s README file';
    }
    else {
      result = {
          link: commit.html_url,
          date: timeAgo(commit.commit.author.date),
          message: commit.commit.message
        }
    }
    res.end(JSON.stringify(result));
  });
});


module.exports = router;