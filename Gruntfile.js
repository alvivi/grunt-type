/*
 * grunt-type
 * https://github.com/alvivi/grunt-type
 *
 * Copyright (c) 2012 - 2013, Alvaro Vilanova
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  'use strict';

  // Project configuration.
  grunt.initConfig({
    // Before generating any new files, remove any previously-created files.
    clean: {
      test: ['tmp']
    },

    // Validate source code.
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/type.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    },

    // Configuration to be run (and then tested).
    type: {
      simple: {
        files: [
          {src: ['test/fixtures/simple.ts'], dest: 'tmp/simple.js'}
        ]
      },

      concat: {
        files: [
          {src: ['test/fixtures/multiple/second.ts',
                 'test/fixtures/multiple/first.ts'],
           dest: 'tmp/concat.js'}
        ]
      },

      many: {
        files: [
          {src: ['test/fixtures/multiple/second.ts',
                 'test/fixtures/multiple/first.ts'],
           dest: 'tmp/many'}
        ]
      },
    }
  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'type', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);
};
