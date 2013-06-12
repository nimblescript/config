/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , util = require('util')
    , async = require('async')
    // , fs = require('fs-extra')
    , fs = require('fs')
    , nconf = require('nconf')
    , path = require('path')
    , extend = require('whet.extend')
    , crypto = require('crypto')
    , helper = require('../helper')


function User(repositoryLibrary, options)
{
    
    logger.debug('New User instance');
    var opts = _.defaults({}, options, { id: 'user', title: 'User', context: {} });
    ObjectBase.constructor.call(this, repositoryLibrary, opts);
    if (this.repositoryLibrary)
    {
        this.userRepositoryObject = this.repositoryLibrary.newObject('user');
    }
}
ObjectBase.inherit(User);

_.extend(User.prototype, {
    loadSettings: function ()
    {
        return loadSettings();
    },
    saveSettings: function (newSettings)
    {
        saveSettings(newSettings);
    },
    setPassword: function(newPassword)
    {
        var settings = this.loadSettings();
        settings.security.password = crypto.createHash('sha256').update(newPassword).digest('hex')
        saveSettings(settings, true);
    },
    initUser: function ()
    {
        var settings = this.loadSettings();
        var errors = [];
        if (!helper.mkdir(settings.userDataDirectory))
            errors.push('Unable to create/access user data directory: ' + settings.userDataDirectory);
        if (!helper.mkdir(settings.repositoryDirectory))
            errors.push('Unable to create/access repository directory: ' + settings.repositoryDirectory);
        helper.mkdir(path.join(settings.repositoryDirectory, 'templates'));
        if (!helper.mkdir(settings.fileListsDirectory))
            errors.push('Unable to create/access file lists directory: ' + settings.fileListsDirectory);
        if (!helper.mkdir(settings.savedParametersDirectory))
            errors.push('Unable to create/access script parameters directory: ' + settings.savedParametersDirectory);
        if (!helper.mkdir(settings.logsDirectory))
            errors.push('Unable to create/access logs directory: ' + settings.logsDirectory);
        if (!helper.mkdir(settings.favoritesDirectory))
            errors.push('Unable to create/access favorites directory: ' + settings.favoritesDirectory);
        return !_.isEmpty(errors) && errors;
    },
    verifyPassword: function (password)
    {
        
        var settings = this.loadSettings();
        hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        console.log(settings.security.password);
        console.log(hashedPassword);
        return settings.security.password == hashedPassword;
    }
});

function loadSettings()
{
    var settings = baseSettings();
    var loadedSettings = loadSettingsFromFile([settings.userDataDirectory, __dirname]);
    extend(true, settings, loadedSettings);
    return settings;
}

function loadSettingsFromFile(searchDirectories)
{
    var settings = {};
    for (i in searchDirectories)
    {
        var dir = searchDirectories[i];
        var settingsPath = path.join(dir, 'settings.json');
        if (fs.existsSync(settingsPath))
        {
            settings = JSON.parse(fs.readFileSync(settingsPath, 'UTF8'));
            if (settings)
            {
                tidyUpSettings(settings);
                return settings;
            }
        }

    }
    return settings;

}
 
function saveSettings(newSettings, allowAll)
{
    saveSettingsToFile(newSettings,allowAll);
}

function saveSettingsToFile(settings,allowAll)
{
    var base = baseSettings();
    var currentSettings = loadSettingsFromFile([base.userDataDirectory]);
    mergeSettings(currentSettings, settings,allowAll);
    tidyUpSettings(currentSettings, allowAll);
    fs.writeFileSync(path.join(settings.userDataDirectory, 'settings.json'), JSON.stringify(currentSettings, null, 4), 'utf8');
}

function mergeSettings(currentSettings, newSettings,allowAll)
{
    _.extend(currentSettings, _.pick(newSettings, 'startup', 'ui', 'repositories', 'allowedFileAccessDirectories', 'webServer', 'widgetData', 'scriptExecution', 'modules', 'marketplace'));
    if (allowAll)
        _.extend(currentSettings, _.pick(newSettings, 'security'));
}
function tidyUpSettings(settings)
{
    deleteNullSettings(settings);

    // Remove duplicates
    if (settings.allowedFileAccessDirectories && (typeof settings.allowedFileAccessDirectories == 'array'))
    {
        var newAllowedFileAccessDirectories = [];
        settings.allowedFileAccessDirectories.forEach(function (e, i)
        {
            var hasParent = false;
            settings.allowedFileAccessDirectories.forEach(function (e2, i2)
            {
                if (i != i2)
                {

                }
            });
            !hasParent && newAllowedFileAccessDirectories.push(e);
        });

    }
}
function deleteNullSettings(settings)
{
    for (s in settings)
    {
        if (!settings[s])
            delete settings[s];
    }
}

function userDataDirectoryPath()
{
    var userDataDirectoryBase;
    if (process.platform.indexOf('win') == 0)
    {
        userDataDirectoryBase = process.env.APPDATA;
    }
    else if (process.platform.indexOf('darwin') == 0)
    {
        userDataDirectoryBase = path.join(process.env.HOME, 'Library', 'Preferences');
    }
    else
    {
        userDataDirectoryBase = path.join(process.env.HOME, '.appdata');
    }
    return userDataDirectoryBase;
}

function baseSettings()
{
    var settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../basesettings.json'),'utf8'));
    var userDataDirectoryBase = userDataDirectoryPath();
    settings.userDataDirectory = helper.toUnixPath(path.join(userDataDirectoryBase, 'xemware', 'nimbleScript'))
    Object.defineProperties(settings,
            {
                "modulesDirectory": {
                    get: function ()
                    {
                        return path.join(this.userDataDirectory, 'modules');
                    }
                },
                "repositoryDirectory": {
                    get: function ()
                    {
                        return path.join(this.userDataDirectory, 'repository');
                    }
                },
                "fileListsDirectory": {
                    get: function ()
                    {
                        return path.join(this.userDataDirectory, 'filelists');
                    }
                },
                "savedParametersDirectory": {
                    get: function ()
                    {
                        return path.join(this.userDataDirectory, 'savedparameters');
                    }
                },
                "logsDirectory": {
                    get: function ()
                    {
                        return path.join(this.userDataDirectory, 'logs');
                    }
                },
                "favoritesDirectory": {
                    get: function ()
                    {
                        return path.join(this.userDataDirectory, 'favorites');
                    }
                }

            }
        );
    return settings;
}

module.exports = new User;
