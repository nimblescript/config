/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , config = require('nimblescript-config')
    , fs = require('fs')
    , path = require('path')
    , os = require('os')


function RunHistory(repositoryLibrary, options)
{
    logger.debug('New RunHistory instance');
    var opts = _.defaults({}, options, { id: 'runhistory', title: 'Run History', context: {},  });
    ObjectBase.constructor.call(this, null, opts);
}
ObjectBase.inherit(RunHistory);


_.extend(RunHistory.prototype, {
    loadHistory: function()
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var runHistoryFilePath = path.join(userSettings.userDataDirectory, 'runhistory.nsrh');
        if (fs.existsSync(runHistoryFilePath))
            return JSON.parse(fs.readFileSync(runHistoryFilePath, 'utf8'));
        else
            return [];

    },
    addToHistory: function (scriptPath, parameters)
    {
        var runHistory = this.loadHistory();
        var runInstance = { timestamp: new Date(), scriptpath: scriptPath, params: parameters };
        runHistory.unshift(runInstance);
        if (runHistory.length > 50) // TO-DO: Add Run History max items to Settings
            runHistory.pop();

        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var runHistoryFilePath = path.join(userSettings.userDataDirectory, 'runhistory.nsrh');
        fs.writeFileSync(runHistoryFilePath, JSON.stringify(runHistory, null, 4), 'utf8');
    }
});
 
module.exports = new RunHistory;


