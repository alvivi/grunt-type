/*
 * grunt-contrib-coffee
 * http://gruntjs.com/
 *
 * Copyright (c) 2012 Álvaro Vilanova Vidal
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  'use strict';

  var path = require('path');
  var os = require('os');
  var helpers = require('grunt-lib-contrib').init(grunt);

  // TODO: ditch this when grunt v0.4 is released
  grunt.util = grunt.util || grunt.utils;

  var withTscCommand = function (cmdpath, cb) {
    var cmd = cmdpath || 'tsc';
    grunt.util.spawn({'cmd': cmd}, function (error) {
      if (error) {
        grunt.fatal(cmd + ' cannot be run. Try ' + 'npm install -g typescript'.cyan);
      }
      else {
        cb(cmd);
      }
    });
  };

  var cmdToString = function (cmd) {
    var args = grunt.util._.reduce(cmd.args, function (m, s) { return m + ' ' + s; }, '');
    return cmd.cmd + args;
  };

  var isAmbientFile = function (filepath) {
    var ends = grunt.util._.endsWith;
    return ends(filepath, '.d.ts') || ends(filepath, '.d.js');
  };

  var isDirTarget = function (trgpath) {
    return grunt.util._.last(trgpath) === path.sep;
  };

  var isMultiTarget = function (trgpath) {
    var paths = grunt.file.expand(trgpath);
    if (paths.length > 1) {
      return true;
    }
    else {
      var p = (paths.length === 1) ? paths[0] : trgpath;
      return grunt.util._.str.include(p, '*') || isDirTarget(p);
    }
  };

  var compile = function (tscpath, srcs, trg, cb) {
    var cmd = {
      cmd : tscpath,
      args : ['--out', trg]
    };
    cmd.args.push.apply(cmd.args, srcs);
    grunt.verbose.writeln(cmdToString(cmd));
    grunt.util.spawn(cmd, function (error, result) {
      if (error) {
        grunt.warn(result.stderr);
        grunt.warn(result.stdout);
      }
      else {
        grunt.log.write(trg + "...");
        grunt.log.ok();
      }
      cb();
    });
  };

  grunt.registerMultiTask('type', 'Compile TypeScript files to JavaScript', function() {
    var done = this.async();

    var options = helpers.options(this, {
      style : false,
      sourcemap : false,
      declarations : false,
      reference : false,
      minw : false,
      const : false,
      comments : false,
      noerroronwith : false,
      noresolve : false,
      nooptimizemodules : false,
      nolib : false,
      target : 'ES3',
      module : 'commonjs'
    });
    grunt.verbose.writeflags(options, 'Options');

    // TODO: ditch this when grunt v0.4 is released
    this.files = this.files || helpers.normalizeMultiTaskFiles(this.data, this.target);

    // Compute compiler pases
    var files = grunt.util._.map(this.files, function (file) {
      var dest = path.normalize(file.dest);
      var srcs = grunt.file.expandFiles(file.src);
      if (isMultiTarget(dest)) {
        var basePath = helpers.findBasePath(srcs, options.basePath);
        return grunt.util._.map(srcs, function (src) {
          var trg = helpers.buildIndividualDest(dest, src, basePath, options.flatten);
          if (isDirTarget(dest)) {
            trg = path.join(dest, trg);
          }
          grunt.file.mkdir(path.dirname(trg));
          return {dest: trg, src: [src]};
        });
      }
      else {
        return {dest: dest, src: srcs};
      }
    });

    // Normalize pases
    files = grunt.util._.compact(grunt.util._.flatten(files));

    // Ignore ambient compilation pases
    files = grunt.util._.reject(files, function (file) {
      return isAmbientFile(file.dest);
    });

    // Execute pases in parallel
    var almostDone = grunt.util._.after(files.length, done);
    withTscCommand(options.tsc, function (tsc) {
      grunt.util.async.forEachLimit(files, os.cpus().length, function (file, finish) {
        grunt.file.mkdir(path.dirname(file.dest));
        compile(tsc, file.src, file.dest, function () {
          finish();
          almostDone();
        });
      });
    });
  });
};

