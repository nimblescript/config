/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , helper = require('../helper')
    , _ = require('lodash')
    , util = require('util')
    , config = require('nimblescript-config')
    , fs = require('fs')
    , path = require('path')

function SavedParam(repositoryLibrary, options)
{
    logger.debug('New SavedParam instance');
    var opts = _.defaults({}, options, { id: 'savedparam', title: 'Saved Script Parameters', context: {} });
    ObjectBase.constructor.call(this, null, opts);
}
ObjectBase.inherit(SavedParam);


_.extend(SavedParam.prototype, {
    pre: function()
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        if (!fs.existsSync(userSettings.savedParametersDirectory))
            helper.mkdir(userSettings.savedParametersDirectory);
        return userSettings;

    },
    search: function (options, callback)
    {
        var userSettings = this.pre();

        var dirContents = fs.readdirSync(userSettings.savedParametersDirectory);
        var data = [];
        dirContents.forEach(function (fileName)
        {
            if (helper.endsWith(fileName,'.nsp'))
            {
                var name = fileName.substring(0, fileName.length - '.nsp'.length);
                data.push(name);
            }
        });
        callback && callback(null, data);

    },
    get: function (itemName, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.savedParametersDirectory, itemName + '.nsp');
        if (!fs.existsSync(itemPath))
            return callback('system.not_exist');

        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        var content = fileSystemBO.readFile(itemPath, 'utf8');
        callback && callback(null, content);
    },
    save: function (itemName, data, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.savedParametersDirectory, itemName + '.nsp');

        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        fileSystemBO.writeFile(itemPath, JSON.stringify(data,null,4),'utf8');
        callback && callback();

    },
    del: function (itemName, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.savedParametersDirectory, itemName + '.nsp');

        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        fileSystemBO.del(itemPath);
        callback && callback();

    }
});
 
module.exports = new SavedParam;
