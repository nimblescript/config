// shovel.js - Do the heavy lifting in this sandbox
// Gianni Chiappetta - gf3.ca - 2010
// Modifications by Tim Shnaider @ xemware.com for nimblescript (www.nimblescript.com)
// License of sandbox project: http://gf3.github.com/sandbox/

/* ------------------------------ INIT ------------------------------ */
var util = require('util')
  , fs = require('fs')
  , path = require('path')
  , os = require('os')
  , spawn = require('child_process').spawn
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , Logger = require('./logger')
  , stackTrace = require('./stack-trace')
  , _ = require('lodash')

  var code
  , result
  , sandbox
  , Script
  , stdin;


if (!(Script = process.binding('evals').NodeScript))
    if (!(Script = process.binding('evals').Script))
        Script = require('vm');

/* ------------------------------ Sandbox ------------------------------ */


function getSafeRunner()
{
    var global = this;
    // Keep it outside of strict mode
    function UserScript(str)
    {
        // We want a global scoped function that has implicit returns.
        // return Function('try { return { outcome: "executed", "scriptoutput": eval(' + JSON.stringify(str + '', null, 4) + ') } } catch(e) { return { outcome: "scripterror", "error": e.stack} }');
        return function ()
        {
            try
            {
                return { outcome: "executed", scriptoutput: DFQUJFNVTTRQWJVLXOGVCCUQXAYQAFIH() };
            }
            catch (e)
            {
                
                return { outcome: "scripterror", "error": e.toString(), "stack": e.stack};
            }

        }

        function DFQUJFNVTTRQWJVLXOGVCCUQXAYQAFIH()
        {
            "use strict"
            //@@CODE
        }
    }
    // place with a closure that is not exposed thanks to strict mode
    return function run(comm, src)
    {
        // stop argument / caller attacks
        "use strict";
        var send = function send(event)
        {
            "use strict";
            //
            // All comm must be serialized properly to avoid attacks, JSON or XJSON
            //
            if (["setTimeout", "clearTimeout", "setInterval", "clearInterval","stdout"].indexOf(event) >= 0)
                return comm.send(event, arguments);
            else
                return comm.send(event, JSON.stringify([].slice.call(arguments, 1)));

        }
        global.print = send.bind(global, 'stdout');
        global.console = {};
        global.console.log = send.bind(global, 'stdout');
        global.require = send.bind(global, 'require');
        global.finished = send.bind(global, 'finished');
        global.setTimeout = send.bind(global, 'setTimeout');
        global.clearTimeout = send.bind(global, 'clearTimeout');
        global.setInterval = send.bind(global, 'setInterval');
        global.clearInterval = send.bind(global, 'clearInterval');
        var result = UserScript(src)();
        if (result.outcome == 'scripterror')
            send('end', result);
        else if (result.outcome == 'executed' && result.scriptoutput != undefined)
            send('end', result);
    }
}

var nimbleScript = { readDirectories: [], writeDirectories: [], logsDirectory: __dirname, modules: [], userModules: [],
    scriptExecution: { maxRunningTime: 30}
};

if (process.argv.length > 2) // arg to script is Settings object
{
    var settings = JSON.parse(process.argv[2]);
    nimbleScript.allowedFileAccessDirectories = settings.allowedFileAccessDirectories;
    nimbleScript.allowedFileAccessDirectories.forEach(function (v, k, a)
    {
        if (v.access == 'R' || v.access == 'RW')
            nimbleScript.readDirectories.push(v.path);
        if (v.access == 'W' || v.access == 'RW')
            nimbleScript.writeDirectories.push(v.path);
    });
    nimbleScript.modules = settings.modules;
    nimbleScript.userModules = settings.userModules;
    nimbleScript.logsDirectory = settings.logsDirectory;
    nimbleScript.scriptExecution = settings.scriptExecution;
}

var logger = new Logger({ directory: nimbleScript.logsDirectory, toFile: true });
var originalConsole = global.console;
var console = [];
var emitter = new EventEmitter();

process.on('uncaughtException', function (err)
{
    emitter.emit('finished', { outcome: 'scripterror', error: err.toString(), stack: err.stack,scriptoutput: undefined }, true);
});


// For external modules
global.nimbleScript = { fileSystem: loadModule('fs') };  

// Get code

code = '';
stdin = process.openStdin();
stdin.on('data', function (data)
{
    code += data;
})
stdin.on('end', run);


// Run code
function run()
{

    var finishedCalled = false;
    var context = Script.createContext();
    var safeRunnerCode = getSafeRunner.toString();
    safeRunnerCode = safeRunnerCode.replace("//@@CODE", function () { return code; });
    var safeRunner = Script.runInContext('(' + safeRunnerCode + ')()', context);
    
    emitter.on('finished', function (result, exitProcess)
    {
        if (!finishedCalled)
        {
            finishedCalled = true;

            // Reformat the error message to include only the stack from the script with correct line numbers.
            if (result.error)
            {
                logger.debug(result.error, result.stack);
                var callSites = stackTrace.parse(result.stack);
                var newError = result.error;
                var LINE_NUMBER_OFFSET = 25; // update if changing getSafeRunner() block - line number of //@@CODE
                var addCallsite = true;
                
                _.each(callSites,function (v)
                {
                    if (v.functionName == 'DFQUJFNVTTRQWJVLXOGVCCUQXAYQAFIH')
                        return false;

                    var lineNumber = v.lineNumber - ( v.fileName == 'evalmachine.<anonymous>' ? LINE_NUMBER_OFFSET : 0);
                    newError = newError.concat(os.EOL,'\tat ',v.functionName || '<anonymous>',' (line: ',lineNumber,', column: ',v.columnNumber,')');
                });
                result.error = newError;
                
            }
            var out = JSON.stringify({ outcome: result.outcome, error: result.error, scriptoutput: JSON.stringify(result.scriptoutput), console: console });
            process.stdout.write(out);
            // TO-DO: replace with tidier solution.
            if (exitProcess) // We have to allow logger time to flush contents of streams
            {
                setTimeout(function ()
                {
                    process.exit(0);
                }, 10);
            }
        }


    });

    process.on('exit', function ()
    {
        if (!finishedCalled)
        {
            logger.debug('Process exiting without any result');
            var out = JSON.stringify({ outcome: 'scripterror', error: 'No result from script', console: console });
            process.stdout.write(out);
        }
    });

    var result;
    try
    {
        var finished = false;
        safeRunner({
            send: function (event, value)
            {
                "use strict";
                switch (event)
                {
                    case 'stdout':
                        console.push.call(console,util.format.apply(util,Array.prototype.slice.call(value,1)));
                        break;
                    case 'end':
                        if (!finished)
                        {
                            emitter.emit('finished', JSON.parse(value)[0], false);
                            finished = true;
                        }
                        break;
                    case 'require':
                        if (!finished)
                        {
                            return customRequire(JSON.parse(value)[0]);
                        }
                        break;
                    case 'setTimeout':
                        if (!finished)
                        {
                            logger.debug('setTimeout', typeof value[1], value[1])
                            return setTimeout(value[1], value[2]);
                        }
                        break;
                    case 'clearTimeout':
                        if (!finished)
                        {
                            return clearTimeout(value[1]);
                        }
                        break;
                    case 'setInterval':
                        if (!finished)
                        {
                            return setInterval(value[1], value[2]);
                        }
                        break;
                    case 'clearInterval':
                        if (!finished)
                        {
                            return clearInterval(value[1]);
                        }
                        break;
                    case 'finished':
                        if (!finished)
                        {
                            try
                            {
                                emitter.emit('finished', { outcome: 'executed', scriptoutput: JSON.parse(value)[0] }, true);
                            }
                            catch (e)
                            {
                            }
                            finished = true;
                        }
                        break;
                }
            }
        }, code);
    }
    catch (e)
    {
        result = e.name + ': ' + e.message;
    }
   
     
}

var ALWAYS_ALLOWED_MODULES = ['path', 'os', 'parameterHelper', 'events', 'util', 'dns', 'url', 'querystring', 'buffer', 'zlib',
    'crypto'];

function customRequire(moduleName,options)
{
    for (var k in ALWAYS_ALLOWED_MODULES)
    {
        if (ALWAYS_ALLOWED_MODULES[k].toLowerCase() == moduleName.toLowerCase())
            return getBuiltInModule(moduleName);
    }

    for (var k in nimbleScript.userModules)
    {
        if (k.toLowerCase() == moduleName.toLowerCase() && nimbleScript.userModules[k].enabled)
            return loadModule(moduleName);
    }

    return undefined;


}

function getBuiltInModule(moduleName)
{
    var retValue;
    switch (moduleName.toLowerCase())
    {
        case 'util':
            retValue = new Util();
            break;
        case 'events':
            retValue = require('events');
            break;
        case "parameterhelper":
            retValue = ParameterHelper;
            break;
        case "path":
            retValue = path;
            break;
        case "os":
            retValue = os;
            break;
        case "dns":
            retValue = require('dns');
            break;
        case "url":
            retValue = require('url');
            break;
        case "querystring":
            retValue = require('querystring');
            break;
        case "buffer":
            retValue = require('buffer');
            break;
        case "zlib":
            retValue = require('zlib');
            break;
        case "crypto":
            retValue = require('crypto');
            break;

        //        case "mockupsnode":    
        //            if (!nimbleScript.mockupsNode) 
        //            { 
        //                retValue = nimbleScript.mockupsNode = require('mockupsNode'); 
        //                nimbleScript.mockupsNode.setDirectoryRestrictions(nimbleScript.allowedFileAccessDirectories, path); 
        //            } 
        //            else 
        //                retValue = nimbleScript.mockupsNode; 
        //            break; 

    }
    return retValue;
}

function loadModule(moduleName)
{
    logger.debug('Requested load of module: "' + moduleName + '"');
    var retObject;
    var moduleDef = getArrayItem(nimbleScript.modules, function (a)
    {
        return a.id.toLowerCase() == moduleName.toLowerCase();
    });

    if (moduleDef)
    {
        logger.debug('Module found: "' + moduleName + '"');
        if (moduleDef.mainPath)
        {
            logger.debug('Module has mainPath: "' + moduleName + '" - ' + moduleDef.mainPath);

            var module = require(moduleDef.mainPath);
            if (module)
            {
                logger.debug('Object returned from require: "' + moduleName + '"');
                if (moduleDef.init)
                {
                    logger.debug('Initializing module object: "' + moduleName + '"');
                    retObject = new module({
                        safeRequire: customRequire, maxRunTime: nimbleScript.scriptExecution.maxRunningTime, logger: logger,
                        readDirectories: nimbleScript.readDirectories, writeDirectories: nimbleScript.writeDirectories
                    });
                }
                else
                    retObject = module;
                    
            }
            else
                logger.debug('No object returned from require: "' + moduleName + '"');
        }
    }
    else
    {
        logger.debug('Module not found: "' + moduleName + '"');
    }
    return retObject;
}



function isEmpty(value)
{
    return (value == undefined || value == null );
}

// util

function Util()
{
}

Util.prototype = {
    format: function ()
    {
        return util.format.apply(util, arguments);
    }
};
// ParameterHelper
function ParameterHelper(parameters)
{
    this.parameters = parameters;
}

ParameterHelper.prototype = {
    param: function (id)
    {
        var param = null;
        this.parameters.forEach(function (p)
        {
            if (p.id == id)
                param = p;
        });
        return param;
    },
    value: function (id)
    {
        var param = this.param(id);
        if (param)
            return param.value;
        else
            return undefined;
    }
    
}


function getArrayItem(a, compareFunction)
{
    var matchingItem;
    a.forEach(function (i)
    {
        if (typeof matchingItem == 'undefined' && compareFunction(i))
            matchingItem = i;
    });
    return matchingItem;
}