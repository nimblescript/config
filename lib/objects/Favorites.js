/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , helper = require('../helper')
    , _ = require('lodash')
    , util = require('util')
    , config = require('nimblescript-config')
    , fs = require('fs')
    , path = require('path')

function Favorites(repositoryLibrary, options)
{
    logger.debug('New Favorites instance');
    var opts = _.defaults({}, options, { id: 'favorites', title: 'Favorites', context: {} });
    ObjectBase.constructor.call(this, null, opts);
}
ObjectBase.inherit(Favorites);


_.extend(Favorites.prototype, {
    pre: function()
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        if (!fs.existsSync(userSettings.favoritesDirectory))
            helper.mkdir(userSettings.favoritesDirectory);
        return userSettings;

    },
    search: function (options, callback)
    {
        var userSettings = this.pre();
        console.log(options);
        var dirContents = fs.readdirSync(userSettings.favoritesDirectory);
        var data = [];
        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        dirContents.forEach(function (fileName)
        {
            if (helper.endsWith(fileName,'.nsfav'))
            {
                var name = fileName.substring(0, fileName.length - '.nsfav'.length);
                var response = fileSystemBO.readFile(path.join(userSettings.favoritesDirectory, fileName), 'utf8', { content: true, force: true });
                var content = JSON.parse(response.content);
                var add = true;
                if (options.filter)
                    add = !_.isEmpty(_.filter([content], options.filter ));
                if (add)
                    data.push({ name: name, content: content  });
            }
        });
        callback && callback(null, data);

    },
    get: function (itemName, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.favoritesDirectory, itemName + '.nsfav');
        if (!fs.existsSync(itemPath))
            return callback('system.not_exist');

        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        var response = fileSystemBO.readFile(itemPath, 'utf8', { content: true, force: true });
        callback && callback(null, JSON.parse(response.content));
    },
    save: function (itemName, data, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.favoritesDirectory, itemName + '.nsfav');
        console.log(itemPath, data);
        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        var response = fileSystemBO.writeFile(itemPath, JSON.stringify(data, null, 4), 'utf8', { force: true });
        callback && callback(null,response);

    },
    del: function (itemName, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.favoritesDirectory, itemName + '.nsfav');

        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        var response = fileSystemBO.del(itemPath, { force: true });
        callback && callback(null,response);
    },
    rename: function (itemName, newName, callback)
    {
        var userSettings = this.pre();
        var itemPath = path.join(userSettings.favoritesDirectory, itemName + '.nsfav');
        var fileSystemBO = this.businessLibrary.newObject('filesystem');
        var response = fileSystemBO.rename(itemPath,newName + '.nsfav',  { force: true });
        callback && callback(null,response);

    }
});
 
module.exports = new Favorites;
