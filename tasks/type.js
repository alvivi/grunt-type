/*
 * grunt-type
 * https://github.com/alvivi/grunt-type
 *
 * Copyright (c) 2012 - 2013, Alvaro Vilanova
 * Licensed under the MIT license.
 */


module.exports = function (grunt) {
  'use strict';

  var _ = grunt.util._;
  var events = require('events');
  var path = require('path');
  var url = require('url');


  // Misc

  // asyncly executes a taks asynchronously with a new event emitter.
  var asyncly = function (task) {
    var emitter = new events.EventEmitter();
    setTimeout(function () {
      task(emitter);
    });
    return emitter;
  };

  // http returns http or https module based on an URI.
  var http = function (uri) {
    var protocol = _.trim(url.parse(uri).protocol, ':');
    if (_.isBoolean(http.mods[protocol]) && http.mods[protocol]) {
      http.mods[protocol] = require(protocol);
    }
    return http.mods[protocol];
  };
  http.mods = {'http': true, 'https': true};

  // wget download the contents of file over HTTP / HTTPS.
  var wget = function (uri) {
    return asyncly(function (e) {
      var client = http(uri);
      if (!client) {
        e.emit('error', _.sprintf('Invalid protocol (%s)', uri));
        return;
      }
      client.get(uri, function (r) {
        if (r.statusCode >= 400) {
          e.emit('error', _.sprintf('Error retriving %s (%d code)', uri,
                 r.statusCode));
          return;
        }
        var data = '';
        r.on('data', function (chunk) { data += chunk; });
        r.on('end', function () { e.emit('done', data); });
      }).on('error', function (err) {
        e.emit('error', err);
      });
    });
  };

  // wgets is a parallel version of wget.
  var wgets = function (uris) {
    return asyncly(function (e) {
      var cs = {};
      var done = _.after(uris.length, function () {
        e.emit('done', cs);
      });
      _.each(uris, function (uri) {
        wget(uri).on('done', function (data) {
          cs[path.basename(uri)] = data;
          done();
        }).on('error', function (e) {
          e.emit('error', e);
        });
      });
    });
  };


  // Environment

  var tsDir = path.join(__dirname, '.tsc');
  var tsDist = function (version) { return path.join(tsDir, version); };
  var tsTscPath = function (version) {
    return path.join(tsDist(version), 'tsc.js');
  };


  // index gets the ts distribution index and keep it updated.
  var index = function () {
    return asyncly(function (e) {
      if (grunt.file.exists(index.filepath)) {
        var idx = grunt.file.readJSON(index.filepath);
        e.emit('done', idx);
        wget(index.url).on('done', function (data) {
          var newIdx = JSON.parse(data);
          if (new Date(idx.updated) < new Date(newIdx.updated)) {
            grunt.log.verbose.writeln('TypeScript indexes updated');
            grunt.file.write(index.filepath, data);
          }
        });
      } else {
        wget(index.url).on('done', function (data) {
          e.emit('done', JSON.parse(data));
          grunt.file.write(index.filepath, data);
        }).on('error', function (err) {
          e.emit('error', err);
        });
      }
    });
  };
  index.url = 'https://dl.dropboxusercontent.com/u/9970823/versions.json';
  index.filepath = path.join(tsDir, 'index.json');

  // dist ensures that the ts distribution environment (compiler, definitions,
  // etc.) is available in the system.
  var dist = function (version) {
    return asyncly(function (e) {
      index().on('done', function (idx) {
        version = version || idx.default;
        var files = idx.sources[version];
        if (!_.isArray(files)) {
          e.emit('error', _.sprintf('TypeScript version "%s" not found',
                 version));
          return;
        }
        if (grunt.file.exists(tsDist(version))) {
          e.emit('done', version);
          return;
        }
        var done = _.after(_.keys(files).length, function () {
          e.emit('done', version);
        });
        _.each(files, function (uri) {
          wget(uri).on('done', function (content) {
            var name = path.basename(uri);
            var filepath = path.join(tsDist(version), name);
            grunt.file.write(filepath, content);
            done();
          }).on('error', function (err) {
            e.emit('error', err);
          });
        });
      }).on('error', function (err) {
        e.emit('error', err);
      });
    });
  };

  // typescript provides the typescript compiler service.
  var typescript = function (version) {
    return asyncly(function (e) {
      dist(version).on('done', function (version) {
        e.emit('done', require(tsTscPath(version)), version);
      }).on('error', function (err) {
        e.emit('error', err);
      });
    });
  };


  // Compiler interaction

  var FakeIO = function (version) {
    this.arguments = [];
    this.__path = tsTscPath(version);
  };

  FakeIO.mimic = _.once(function (io) {
    _.extend(FakeIO.prototype, io);
    _.extend(FakeIO.prototype, {
      getExecutingFilePath: function () {
        return this.__path;
      }
    });
  });


  // The Task

  grunt.registerMultiTask('type', 'Compile TypeScipt sources.', function () {
    var task = this;
    var done = this.async();

    var options = this.options({
    });
    grunt.verbose.writeflags(options, 'Options');

    typescript(options.version).on('done', function (ts, version) {
      FakeIO.mimic(ts.IO);
      var io = new FakeIO(version);
      var compiler = new ts.BatchCompiler(io);

      task.files.forEach(function (filePair) {
        if (filePair.src.length <= 0) {
          grunt.fail.warn(_.sprintf('No sources for %s.', filePair.dest));
          return;
        }
        filePair.src.forEach(function (src) {
          io.arguments.push(src);
        });

        io.arguments.push('--out', filePair.dest);
        compiler.batchCompile();
      });
    }).on('error', function (err) {
      grunt.fail.fatal(err);
    });
  });
};
