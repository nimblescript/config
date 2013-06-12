/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , config = require('nimblescript-config')
    , Sandbox = require('../sandbox/lib/sandbox')
    , fs = require('fs')
    , path = require('path')
    , os = require('os')
    , async = require('async')

var _executionInstanceId = 1;
function ExecutionInstance(options)
{
    options = options || {};
    this._executionInstanceId = _executionInstanceId++;
    this._executionPath = options.executionPath;
}

function Executor()
{
    this._executionInstances = {};
}
_.extend(Executor.prototype, 
    {
        executeCommand: function(businessLibrary,executionPath, callback, command, options)
        {
            if (command == 'run')
                return run(businessLibrary, executionPath, callback, options);
            else
                return executeCommand(businessLibrary, executionPath, callback, command, options);
        }
    })

var executionExecutor = new Executor()
{
}

function Runner(repositoryLibrary, options)
{
    logger.debug('New Runner instance');
    var opts = _.defaults({}, options, { id: 'runner', title: 'Runner', context: {}  });
    ObjectBase.constructor.call(this, null, opts);
}
ObjectBase.inherit(Runner);


_.extend(Runner.prototype, {
    getAll: function(executionPath, callback)
    {
        this.executeCommand(executionPath, callback, 'return { summary: typeof getSummary != "undefined" ? getSummary() : null' +
            ', parameters: typeof getParameters != "undefined" ? getParameters() : null' +
            ', runsettings: typeof getRunSettings != "undefined" ? getRunSettings() : null }');
    },
    getSummary: function(executionPath, callback)
    {
        this.executeCommand(executionPath, callback, 'return typeof getSummary != "undefined" ? getSummary() : null');
    },
    getParameters: function(executionPath, callback)
    {
        this.executeCommand(executionPath, callback, 'return typeof getParameters != "undefined" ? getParameters() : null');
    },
    getRunSettings: function (executionPath, callback)
    {
        this.executeCommand(executionPath, callback, 'return typeof getRunSettings != "undefined" ? getRunSettings() : null');
    },
    loadRunHistory: function()
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var runHistoryFilePath = path.join(userSettings.userDataDirectory, 'runhistory.nsrh');
        if (fs.existsSync(runHistoryFilePath))
            return JSON.parse(fs.readFileSync(runHistoryFilePath, 'utf8'));
        else
            return [];
    },
    saveRunHistory: function(runHistory)
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var runHistoryFilePath = path.join(userSettings.userDataDirectory, 'runhistory.nsrh');
        fs.writeFileSync(runHistoryFilePath, JSON.stringify(runHistory, null, 4), 'utf8');
    },
    addToRunHistory: function(scriptPath, settings)
    {
        var runHistory = this.loadRunHistory();
        var runInstance = { timestamp: new Date(), scriptpath: scriptPath, params: settings.parameters, runsettings: settings.runSettings };
        runHistory.unshift(runInstance);

        var userSettings = this.businessLibrary.newObject('user').loadSettings();

        if (runHistory.length > ( userSettings.scriptExecution.maxRecentItems || 50) ) // TO-DO: Add Run History max items to Settings
            runHistory.pop();
        this.saveRunHistory(runHistory);
    },
    run: function (executionPath, callback, options)
    {
        this.addToRunHistory(_.indexOf(executionPath, '*') >= 0 ? executionPath : 'local*' + executionPath,
            { parameters: options.parameters, runSettings: options.runSettings });
        this.executeCommand(executionPath, callback, 'run', options);
    },
    executeCommand: function(executionPath, callback, command, options)
    {
        return executionExecutor.executeCommand(this.businessLibrary, executionPath, callback, command, options)
    }
});
 
module.exports = new Runner;


function executeCommand(businessLibrary, scriptPath, callback, command, options, executionInstance)
{

    var self = this;
    async.series([
        function execute(cb)
        {

            var userSettings = businessLibrary.newObject('user').loadSettings();
            options = options || {};

            var scanDirectories = [path.join(process.cwd(), 'modules'), path.join(userSettings.userDataDirectory, 'modules')];
            var modules = businessLibrary.newObject('module').findModules(scanDirectories);

            var extendedAllowedFileAccessDirectories = userSettings.allowedFileAccessDirectories.slice(0);
            extendedAllowedFileAccessDirectories.push({ path: path.dirname(scriptPath), access: 'R' });
            var executionSettings = {
                allowedFileAccessDirectories: extendedAllowedFileAccessDirectories,
                userModules: userSettings.modules,
                logsDirectory: userSettings.logsDirectory,
                modules: modules,
                scriptPath: scriptPath,
                scriptExecution: { maxRunningTime: userSettings.scriptExecution.maxRunningTime }
            };
            var script = fs.readFileSync(scriptPath, 'utf8');
            var executeScript = script.concat(
                os.EOL, os.EOL, command);
            var s = new Sandbox({ timeout: userSettings.scriptExecution.maxRunningTime * 1000 }); // seconds -> milliseconds
            if (executionInstance)
                executionInstance.sandbox = s;

            s.run(executeScript, cb, executionSettings);

        }
    ], function complete()
    {
        callback.apply(callback, Array.prototype.slice.call(arguments, 0));
    });


}

function run(businessLibrary, scriptPath, callback, options, executionInstance)
{

    var self = this;
    async.series([
        function execute(cb)
        {
            var userSettings = businessLibrary.newObject('user').loadSettings();
            options = options || {};
            var args = {};
            args.parameters = options.parameters;
            args.modules = userSettings.modules;
            args.scriptMaxRunningTime = userSettings.scriptExecution.maxRunningTime;
            args.scriptPath = scriptPath;

            var scriptArguments;
            var argArray = [];
            argArray.push(JSON.stringify(args));
            scriptArguments = argArray.join(',');

            var scanDirectories = [path.join(process.cwd(), 'modules'), path.join(userSettings.userDataDirectory, 'modules')];
            var modules = businessLibrary.newObject('module').findModules(scanDirectories);

            var extendedAllowedFileAccessDirectories = userSettings.allowedFileAccessDirectories.slice(0);
            extendedAllowedFileAccessDirectories.push({ path: path.dirname(scriptPath), access: 'R' });
            var executionSettings = {
                allowedFileAccessDirectories: extendedAllowedFileAccessDirectories,
                userModules: userSettings.modules,
                logsDirectory: userSettings.logsDirectory,
                modules: modules,
                scriptPath: scriptPath,
                scriptExecution: { maxRunningTime: userSettings.scriptExecution.maxRunningTime }
            };
            var script = fs.readFileSync(scriptPath, 'utf8');
            var executeScript = script.concat(
                os.EOL, os.EOL, 'return run(',
                scriptArguments.toString(), ');');
            var s = new Sandbox({ timeout: userSettings.scriptExecution.maxRunningTime * 1000}); // seconds -> milliseconds
            if (executionInstance)
                executionInstance.sandbox = s;

            s.run(executeScript, cb, executionSettings);

        }
    ], function complete()
    {
        callback.apply(callback, arguments);
    });


}

function allowedScriptPath(businessLibrary,scriptPath)
{
    var repositoryBO = businessLibrary.newObject('repository');
    return repositoryBO.canDoItemAction(scriptPath,'run');
}

function isEmpty(value)
{
    return (value == undefined || value == null || value.length === 0);
}

