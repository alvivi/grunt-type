var grunt = require('grunt');
var fs = require('fs');

module.exports.type = {
  compile: function (test) {
    'use strict';

    test.expect(3);

    var actual = grunt.file.read('tmp/simple.js');
    var expected = grunt.file.read('test/expected/simple.js');
    test.equal(expected, actual, 'should compile TypeScript to JavaScript');

    actual = grunt.file.read('tmp/concat.js');
    expected = grunt.file.read('test/expected/concat.js');
    test.equal(expected, actual, 'should compile and concat TypeScript to JavaScript');

    actual = fs.readdirSync('tmp/many/').sort();
    expected = fs.readdirSync('test/expected/many/').sort();
    test.deepEqual(expected, actual, 'should compile to directories');

    test.done();
  },

  flatten: function (test) {
    'use strict';

    test.expect(1);

    var actual = fs.readdirSync('tmp/flatten/').sort();
    var expected = fs.readdirSync('test/expected/flatten/').sort();
    test.deepEqual(expected, actual, 'should compile to flatten directories');

    test.done();
  }
};
