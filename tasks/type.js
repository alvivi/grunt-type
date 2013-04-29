/*
 * grunt-type
 * https://github.com/alvivi/grunt-type
 *
 * Copyright (c) 2012 - 2013, Alvaro Vilanova
 * Licensed under the MIT license.
 */

var tscRemotePaths = {
  '0.9.0a': 'https://dl.dropboxusercontent.com/u/9970823/tsc-0.9.0a.js'
};

var fs = require('fs');
var http = require('https');
var path = require('path');
var EventEmitter = require('events').EventEmitter;

// http.get(repository['0.9.0a'], function (res) {
//   console.log(res.statusCode);
//   res.on('data', function (data) {
//     var decoder = new StringDecoder('utf8');
//     // console.log(decoder.write(data));
//   });
// }).on('error', function (e) {
//   console.log(e);
// });

var tscFilename = function (version) {
  return path.join(path.join(__dirname, '.tsc'), 'tsc-' + version + '.js');
};

var tsc = function (version, emitter) {
  var filename = tscFilename(version);
  emitter = emitter || new EventEmitter();

  fs.exists(filename, function (exists) {
    if (exists) {
      emitter.emit('ready', require(filename));
    } else {
      var remotePath = tscRemotePaths[version];
      if (!remotePath) {
        emitter.emit('error', 'TypeScript ' + version +
                     ' not found in the repository.');
      } else {
        http.get(remotePath, function (res) {
          var data = '';
          if (res.statusCode > 399) {
            emitter.emit('error', 'Error trying to get TypeScript compiler ' +
                         'from ' + remotePath + ' (' + res.statusCode + ')');
          } else {
            emitter.emit('downloading');
            res.on('data', function(chunk) {
              data += chunk;
            });

            res.on('end', function() {
              fs.writeFile(filename, data, function (err) {
                if (err) {
                  emitter.emit('error', err);
                } else {
                  tsc(version, emitter);
                }
              });
            });
          }
        }).on('error', function (e) {
          emitter.emit('error', e);
        });
      }
    }
  });
  return emitter;
};


module.exports = function(grunt) {
  'use strict';

  var path = require('path');

  grunt.registerMultiTask('type', 'Compile TypeScipt source code.', function() {
    var options = this.options({});
    grunt.verbose.writeflags(options, 'Options');
    tsc('0.9.0a').on('ready', function(ts) {
      console.log(ts);
    });
  });
};
