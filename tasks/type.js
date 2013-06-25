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

  // ByteOrderMark Enum used by FileInformation.
  var ByteOrderMark;
  (function (ByteOrderMark) {
      ByteOrderMark[ByteOrderMark['None'] = 0] = 'None';
      ByteOrderMark[ByteOrderMark['Utf8'] = 1] = 'Utf8';
      ByteOrderMark[ByteOrderMark['Utf16BigEndian'] = 2] = 'Utf16BigEndian';
      ByteOrderMark[ByteOrderMark['Utf16LittleEndian'] = 3] = 'Utf16LittleEndian';
  })(ByteOrderMark || (ByteOrderMark = {}));

  // FileInformation class used by GruntHost.
  var FileInformation = (function () {
    function FileInformation(contents, byteOrderMark) {
        this._contents = contents;
        this._byteOrderMark = byteOrderMark;
    }
    FileInformation.prototype.contents = function () {
        return this._contents;
    };

    FileInformation.prototype.byteOrderMark = function () {
        return this._byteOrderMark;
    };
    return FileInformation;
  })();

  // Grunt TypeScript.ITextWriter implementation.
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

  GruntHost.prototype.directoryExists = function (path) {
    return fs.existsSync(path) && fs.statSync(path).isDirectory();
  };

  GruntHost.prototype.dirName = path.dirname;

  GruntHost.prototype.fileExists = grunt.file.exists;

  // Implementation taken from typescript sourcecode.
  GruntHost.prototype.findFile = function(rootPath, partialFilePath) {
    var trg = path.join(rootPath, partialFilePath);
    while (true) {
      if (fs.existsSync(trg)) {
        return { fileInformation: this.readFile(path), path: path };
      } else {
        var parentPath = path.resolve(rootPath, '..');
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

  // Code extracted from TypeScript source (/compiler/core/environment.ts)
  GruntHost.prototype.readFile = function (file) {
    var buffer = fs.readFileSync(file);
    switch (buffer[0]) {
      case 0xFE:
        if (buffer[1] === 0xFF) {
          // utf16-be. Reading the buffer as big endian is not supported, so convert it to
          // Little Endian first
          var i = 0;
          while ((i + 1) < buffer.length) {
            var temp = buffer[i];
            buffer[i] = buffer[i + 1];
            buffer[i + 1] = temp;
            i += 2;
          }
          return new FileInformation(buffer.toString('ucs2', 2), ByteOrderMark.Utf16BigEndian);
        }
        break;

      case 0xFF:
        if (buffer[1] === 0xFE) {
          // utf16-le
          return new FileInformation(buffer.toString('ucs2', 2), ByteOrderMark.Utf16LittleEndian);
        }
        break;

      case 0xEF:
        if (buffer[1] === 0xBB) {
          // utf-8
          return new FileInformation(buffer.toString('utf8', 3), ByteOrderMark.Utf8);
        }
      }

      // Default behaviour
      return new FileInformation(buffer.toString('utf8', 0), ByteOrderMark.None);
  };

  GruntHost.prototype.resolvePath = path.resolve;

  GruntHost.prototype.writeFile = function (path, contents, writeByteOrderMark) {
    grunt.file.write(path, contents, 'utf8');
  };

  // Unexpected methods.
  GruntHost.prototype.createDirectory = GruntHost.unexpected('createDirectory');
  GruntHost.prototype.deleteFile = GruntHost.unexpected('deleteFile');
  GruntHost.prototype.dir = GruntHost.unexpected('dir');
  GruntHost.prototype.getExecutingFilePath = GruntHost.unexpected('getExecutingFilePath');
  GruntHost.prototype.print = GruntHost.unexpected('print');
  GruntHost.prototype.printLine = GruntHost.unexpected('printLine');
  GruntHost.prototype.quit = GruntHost.unexpected('quit');
  GruntHost.prototype.run = GruntHost.unexpected('run');
  GruntHost.prototype.watchFile = GruntHost.unexpected('watchFile');

  // resolve resolves TypeScript source contents and dependencies.
  var resolve = function (env, ioHost) {
    var renv = new ts.CompilationEnvironment(env.compilationSettings, ioHost);
    var resolver = new ts.CodeResolver(env);
    var resolved = {};

    var errorReporter = {
      addDiagnostic: function (diagnostic) {
        env.ioHost.stderr.WriteLine(diagnostic.message());
      }
    };

    var dispatcher = {
      errorReporter: errorReporter,
      postResolution: function(path, code) {
        if (!resolved[path]) {
          renv.code.push(code);
          resolved[path] = true;
        }
      }
    };

    _.each(env.code, function (code) {
      var path = ts.switchToForwardSlashes(ioHost.resolvePath(code.path));
      resolver.resolveCode(path, '', false, dispatcher);
    });

    return renv;
  };

  // compile do actual compilation.
  var compile = function (compiler, env) {
    var anyError = false;

    var errorReporter = {
      addDiagnostic: function (diagnostic) {
        env.ioHost.stderr.WriteLine(diagnostic.message());
      }
    };

    // Syntax check
    _.each(env.code, function (code) {
      if (code.content === null) {
        return;
      }
      var snapshot = ts.ScriptSnapshot.fromString(code.fileInformation.contents());
      compiler.addSourceUnit(code.path, snapshot, 0, false, code.referencedFiles);
      var diag = compiler.getSyntacticDiagnostics(code.path);
      compiler.reportDiagnostics(diag, errorReporter);
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
        compiler.reportDiagnostics(diag, errorReporter);
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
    var diag = compiler.emitAll(env.ioHost, mapInputToOutput);
    compiler.reportDiagnostics(diag, errorReporter);
    if (diag.length > 0) {
      env.ioHost.stderr.Close();
      return;
    }

    // Emit declarations
    diag = compiler.emitAllDeclarations();
    compiler.reportDiagnostics(diag, errorReporter);

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
      comments: false,
      target: 'es3',
      module: 'commonjs',
      disallowbool: false
    });
    grunt.verbose.writeflags(options, 'Options');

    var gruntHost = new GruntHost();
    var compiler = new ts.TypeScriptCompiler();
    var env = new ts.CompilationEnvironment(compiler.settings, gruntHost);

    compiler.settings.mapSourceFiles = options.sourcemap;
    compiler.settings.generateDeclarationFiles = options.declaration;
    compiler.settings.emitComments = options.comments;
    compiler.settings.disallowBool = options.disallowbool;

    // nolib option.
    if (options.nolib) {
      compiler.settings.useDefaultLib = false;
    } else {
      compiler.settings.useDefaultLib = true;
      var lib = new ts.SourceUnit(libdtsPath, null);
      env.code.push(lib);
    }

    // target option.
    if (options.target === 'es3') {
      compiler.settings.codeGenTarget  = ts.LanguageVersion.EcmaScript3;
    } else if (options.target === 'es5') {
      compiler.settings.codeGenTarget  = ts.LanguageVersion.EcmaScript5;
    } else {
      grunt.fail.warn(_.sprintf('ECMAScript target version %s not supported. ' +
                      'Using default "ES3" code generation', options.target));
    }

    // module option.
    options.module = options.module.toLowerCase();
    if (options.module === 'commonjs' || options.module === 'node') {
      compiler.settings.moduleGenTarget = ts.ModuleGenTarget.Synchronous;
    } else if (options.module === 'amd') {
      compiler.settings.moduleGenTarget = ts.ModuleGenTarget.Asynchronous;
    } else {
      grunt.fail.warn(_.sprintf('Module code generation %s is not supported. ' +
                   'Using default "commonjs" code generation', options.module));
    }

    // Sources and target.
    _.each(this.files, function (filePair) {
      // Asynchronous modules are incompatible to emitting one single file.
      if (options.module === 'amd' && path.extname(filePair.dest) !== '') {
        grunt.fail.fatal('Cannot compile dynamic modules when emitting into ' +
                         'single file');
      }
      compiler.settings.outputOption = filePair.dest;
      _.each(filePair.src, function (srcpath) {
        var code = new ts.SourceUnit(srcpath, null);
        env.code.push(code);
      });
    });

    env = resolve(env, gruntHost);
    compile(compiler, env);
  });
};
