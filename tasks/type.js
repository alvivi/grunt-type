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
  var fs = require('fs');
  var vm = require('vm');

  // Workaround TypeScript distribution oddness.
  var ts = (function () {
    var filename = require.resolve('typescript');
    var module = {};
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), module);
    return module.TypeScript;
  }) ();

  // The path to lib.d.ts.
  var libdtsPath = (function () {
    return path.join(path.dirname(require.resolve('typescript')), 'lib.d.ts');
  }) ();

  // Grunt ITextWriter implementatio.
  var GruntWriter = function (wrapper) {
    this.buffer = '';
    this.wrapper = wrapper;
  };

  GruntWriter.prototype.Write = function (str) {
    this.buffer += str;
  };

  GruntWriter.prototype.WriteLine = function (str) {
    this.buffer = this.buffer + str + '\n';
  };

  GruntWriter.prototype.Close = function () {
    this.wrapper(this.buffer);
  };

  // Grunt IO host. Implements TypeScript.IIO interface.
  var GruntHost = function () {
    this.arguments = [];
    this.stderr = new GruntWriter(grunt.fail.fatal);
    this.stdout = new GruntWriter(grunt.verbose.write);
  };

  GruntHost.unexpected = function (method) {
    return function () {
      grunt.fail.fatal(_.sprintf('Unexpected use of GruntHost\'s %s method.\n' +
        'Please report this as a bug at: ' +
        'https://github.com/alvivi/grunt-type/issues'.cyan , method));
    };
  };

  GruntHost.prototype.createFile = function (path, useUTF8) {
    var options = useUTF8 ? {encoding: 'utf-8'} : {};
    return new GruntWriter(function (content) {
      grunt.file.write(path, content, options);
    });
  };

  GruntHost.prototype.directoryExists = grunt.file.exists;

  GruntHost.prototype.dirName = path.dirname;

  GruntHost.prototype.fileExists = grunt.file.exists;

  // Implementation taken from typescript sourcecode
  GruntHost.prototype.findFile = function(rootPath, partialFilePath) {
    var trg = path.join(rootPath, partialFilePath);
    while (true) {
      if (fs.existsSync(trg)) {
        try {
          var content = this.readFile(trg);
          return {content: content, path: trg};
        } catch (err) {}
      } else {
        var parentPath = path.resolve(rootPath, "..");
        if (rootPath === parentPath) {
            return null;
        }
        else {
            rootPath = parentPath;
            trg = path.resolve(rootPath, partialFilePath);
        }
      }
    }
  };

  GruntHost.prototype.readFile = grunt.file.read;

  GruntHost.prototype.resolvePath = path.resolve;

  // Unexpected methods
  GruntHost.prototype.createDirectory = GruntHost.unexpected('createDirectory');
  GruntHost.prototype.deleteFile = GruntHost.unexpected('deleteFile');
  GruntHost.prototype.dir = GruntHost.unexpected('dir');
  GruntHost.prototype.getExecutingFilePath = GruntHost.unexpected('getExecutingFilePath');
  GruntHost.prototype.print = GruntHost.unexpected('print');
  GruntHost.prototype.printLine = GruntHost.unexpected('printLine');
  GruntHost.prototype.quit = GruntHost.unexpected('quit');
  GruntHost.prototype.run = GruntHost.unexpected('run');
  GruntHost.prototype.watchFile = GruntHost.unexpected('watchFile');
  GruntHost.prototype.writeFile = GruntHost.unexpected('writeFile');

  // resolve resolves TypeScript source contents and dependencies.
  var resolve = function (env, ioHost) {
    var renv = new ts.CompilationEnvironment(env.compilationSettings, ioHost);
    var resolver = new ts.CodeResolver(env);
    var resolved = {};

    var dispatcher = {
      postResolutionError: function(file, ref, msg) {
        grunt.fail.fatal(_.sprintf("%s (%d,%d): %s", file, ref.line + 1,
                         ref.character + 1, msg));
      },
      postResolution: function(path, code) {
        if (!resolved[path]) {
          renv.code.push(code);
          resolved[path] = true;
        }
      }
    };

    _.each(env.code, function (code) {
      var path = ts.switchToForwardSlashes(ioHost.resolvePath(code.path));
      resolver.resolveCode(path, "", false, dispatcher);
    });

    return renv;
  };

  // compile do actual compilation.
  var compile = function (compiler, env) {
    var anyError = false;

    // Syntax check
    _.each(env.code, function (code) {
      if (code.content === null) {
        return;
      }
      var snapshot = ts.ScriptSnapshot.fromString(code.content);
      compiler.addSourceUnit(code.path, snapshot, 0, false, code.referencedFiles);
      var diag = compiler.getSyntacticDiagnostics(code.path);
      compiler.reportDiagnostics(diag, env.ioHost.stderr);
      anyError = anyError || (diag.length > 0);
    });
    if (anyError) {
      env.ioHost.stderr.Close();
      return;
    }

    // Type check
    compiler.pullTypeCheck();
    var files = compiler.fileNameToDocument.getAllKeys();
    _.each(files, function (file) {
      var diag = compiler.getSemanticDiagnostics(file);
      if (diag.length > 0) {
        compiler.reportDiagnostics(diag, env.ioHost.stderr);
        anyError = true;
      }
    });

    if (anyError) {
      env.ioHost.stderr.Close();
      return;
    }

    // Emit JavaScript
    var mapInputToOutput = function (inputFile, outputFile) {
      env.inputFileNameToOutputFileName.addOrUpdate(inputFile, outputFile);
    };
    compiler.emitAll(env.ioHost, mapInputToOutput);
    var diag = compiler.emitAllDeclarations();
    compiler.reportDiagnostics(diag, env.ioHost.stderr);

    if (diag.length > 0) {
      env.ioHost.stderr.Close();
      return;
    }
  };

  // The Task
  grunt.registerMultiTask('type', 'Compile TypeScipt sources.', function () {
    var options = this.options({
      nolib: false,
      sourcemap: false,
      declaration: false,
      comments: false
    });
    grunt.verbose.writeflags(options, 'Options');

    var gruntHost = new GruntHost();
    var compiler = new ts.TypeScriptCompiler();
    var env = new ts.CompilationEnvironment(compiler.settings, gruntHost);


    // nolib option.
    if (options.nolib) {
      compiler.settings.useDefaultLib = false;
    } else {
      compiler.settings.useDefaultLib = true;
      var lib = new ts.SourceUnit(libdtsPath, null);
      env.code.push(lib);
    }

    compiler.settings.mapSourceFiles = options.sourcemap;
    compiler.settings.generateDeclarationFiles = options.declaration;
    compiler.settings.emitComments = options.comments;

    // Sources and target.
    _.each(this.files, function (filePair) {
      compiler.settings.outputOption = filePair.dest;
      _.each(filePair.src, function (srcpath) {
        var src = new ts.SourceUnit(srcpath, null);
        env.code.push(src);
      });
    });

    env = resolve(env, gruntHost);
    compile(compiler, env);
  });
};
