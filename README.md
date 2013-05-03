# grunt-type [![Build Status](https://secure.travis-ci.org/alvivi/grunt-type.png)](http://travis-ci.org/alvivi/grunt-type)

> Compile TypeScipt source code.


## Getting Started
This plugin requires Grunt `~0.4.0` and TypeScript `0.9.0`.

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out
the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains
how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as
install and use Grunt plugins. Once you're familiar with that process, you may
install this plugin with this command:

```shell
npm install grunt-type --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with
this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-contrib-copy');
```

*This plugin was designed to work with Grunt 0.4.x and TypeScript 0.9.x
(currently in alpha). If you're still using grunt v0.3.x it's strongly
recommended that [you upgrade](http://gruntjs.com/upgrading-from-0.3-to-0.4).

## Type task
_Run this task with the `grunt type` command._

Task targets, files and options may be specified according to the grunt
[Configuring tasks](http://gruntjs.com/configuring-tasks) guide.

### Options

##### nolib ```boolean```

Do not include a default lib.d.ts with global declarations.

##### sourcemap ```boolean```

Generates corresponding .map files.

##### declaration ```boolean```

Generates corresponding .d.ts file

##### comments ```boolean```

Emit comments to output.

##### target ```string```

Specify ECMAScript target version: ```'ES3'``` (default), or ```'ES3'```.

##### module ```string```

Specify module code generation. Valid values are `commonjs` (default) or `amd`.

##### disallowbool ```boolean```

Throw error for use of deprecated `bool` type.

### Usage Examples

```js
type: {
  release: {
    files: [
      {src: ['src/**/*.ts'], dest: 'dist/app.js'}
    ],
    options: {
      sourcemap: true,
      target: 'es5'
    }
  }
}
```
