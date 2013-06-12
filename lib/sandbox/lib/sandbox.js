// sandbox.js - Rudimentary JS sandbox
// Gianni Chiappetta - gf3.ca - 2010
// Modifications by Tim Shnaider @ xemware.com for nimbleScript (www.nimblescript.com)
// Maintains license of sandbox project: http://gf3.github.com/sandbox/

/*------------------------- INIT -------------------------*/
var fs = require( 'fs' )
  , path = require( 'path' )
  , spawn = require( 'child_process' ).spawn
  , EE = require('events').EventEmitter
  , inherits = require('util').inherits;

/*------------------------- Sandbox -------------------------*/
function Sandbox( options ) {
  ( this.options = options || {} ).__proto__ = Sandbox.options
  this.run = function (code, hollaback, extraArgs)
  {
      // Any vars in da house?
      var args = [];
      if (options.debug)
          args.push('--debug-brk=5555')
      args = args.concat([this.options.shovel]);
      if (extraArgs)
      {
          args.push(JSON.stringify(extraArgs));
      }
      var timer
      , stdout = ''
      , stderr = ''
      , child = spawn(this.options.node, args)
      , output = function (data)
      {
          if (!!data)
              stdout += data
      }
      , errorOutput = function (data)
      {
          if (!!data)
              stderr += data
      }

      // Listen
      child.stderr.on('data', errorOutput)
      child.stdout.on('data', output)
      child.on('exit', function (code)
      {
          clearTimeout(timer);
          var retValue = {};
          try
          {
              retValue = JSON.parse(stdout);
          }
          catch (e)
          {
              retValue = { outcome: 'scripterror', error: 'Unable to parse return value from script, the script may have errors or the sandbox may have died.' };
          }
          if (!!stderr)
              retValue.stderr = stderr;
          hollaback.call(this, retValue);
      })

      // Go
      child.stdin.write(code)
      child.stdin.end();
      var self = this;
      timer = setTimeout(function ()
      {
          child.stdout.removeListener('output', output)
          stdout = JSON.stringify({ outcome: 'timeout', console: [] })
          child.kill('SIGKILL')
          if (!!stderr)
              process.stdout.write(stderr);
      }, this.options.timeout)
  };
}

inherits(Sandbox, EE)
// Options
Sandbox.options =
  { timeout: 500
  , node: 'node'
  , shovel: path.join( __dirname, 'shovel.js' )
  }

// Info
fs.readFile( path.join( __dirname, '..', 'package.json' ), function( err, data ) {
  if ( err )
    throw err
  else
    Sandbox.info = JSON.parse( data )
})

/*------------------------- Export -------------------------*/
module.exports = Sandbox

