/*
 * grunt-type
 * https://github.com/alvivi/grunt-type
 *
 * Copyright (c) 2012 - 2013, Alvaro Vilanova
 * Licensed under the MIT license.
 */


var fs = require('fs');
var grunt = require('grunt');
var path = require('path');
var _ = grunt.util._;
var hooker = grunt.util.hooker;

// Type task hook
var type = (function () {
  'use strict';

  var task;
  hooker.hook(grunt, 'registerMultiTask', function (name, desc, htask) {
    task = htask;
  });
  require(path.join(__dirname, '../tasks/type.js'))(grunt);
  hooker.unhook(grunt);

  return function (dst, srcs, options) {
    var failed = false;
    var orig = grunt.fail;
    grunt.fail = {
      fatal: function (str) {
        failed = true;
      }
    };
    task.call({
      files: [
        {dest: dst, src: srcs}
      ],
      options: function (defaults) {
        return _.extend(defaults, options);
      }
    });
    grunt.fail = orig;
    return failed;
  };
}) ();

// The tests
exports.type = {

  // Compiler features
  compiler: function (test) {
    'use strict';

    test.expect(3);

    test.equal(false, type('tmp/cmplrSimple.js', ['test/fixtures/simple.ts']),
               'should compile without errors');

    test.equal(true, type('tmp/nosense', ['test/fixtures/syntax_error.ts']),
               'should throw a syntax error');

    test.equal(true, type('tmp/nosense', ['test/fixtures/type_error.ts']),
               'should throw a type error');

    test.done();
  },

  // files and directories
  filesAndFolders: function (test) {
    'use strict';

    test.expect(3);

    var actual = grunt.file.read('tmp/simple.js');
    var expected = grunt.file.read('test/expected/simple.js');
    test.equal(expected, actual, 'should compile one to one sources');

    actual = grunt.file.read('tmp/concat.js');
    expected = grunt.file.read('test/expected/concat.js');
    test.equal(expected, actual, 'should compile many to one sources');

    actual = fs.readdirSync('tmp/many').sort();
    expected = fs.readdirSync('test/expected/many').sort();
    test.deepEqual(expected, actual, 'should compile many to many sources');

    test.done();
  },

  options: function (test) {
    'use strict';

    test.expect(8);

    test.equal(true, type('tmp/nosense', ['test/fixtures/simple.ts'], {
      nolib: true
    }), 'should not include lib.d.ts');

    var actual = fs.readdirSync('tmp/sourcemaps').sort();
    var expected = fs.readdirSync('test/expected/sourcemaps').sort();
    test.deepEqual(expected, actual, 'should emit sourcemaps files');

    actual = fs.readdirSync('tmp/declarations').sort();
    expected = fs.readdirSync('test/expected/declarations').sort();
    test.deepEqual(expected, actual, 'should emit declarations files');

    actual = grunt.file.read('tmp/comments.js');
    expected = grunt.file.read('test/expected/comments.js');
    test.equal(expected, actual, 'should compile one to one sources');

    actual = grunt.file.read('tmp/es5.js');
    expected = grunt.file.read('test/expected/es5.js');
    test.equal(expected, actual, 'should emit ECMAScript 5');

    actual = grunt.file.read('tmp/amd.js');
    expected = grunt.file.read('test/expected/amd.js');
    test.equal(expected, actual, 'should emit AMD module declaration');

    test.equal(true, type('tmp/nosense.js', ['test/fixtures/amd.ts'], {
      module: 'amd'
    }), 'should not compile dynamic modules emitting a single file');

    test.equal(true, type('tmp/nosense.js', ['test/fixtures/bool.ts'], {
      disallowbool: true
    }), 'should disallow bool');

    test.done();
  }
};
