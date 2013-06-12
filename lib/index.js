/* MIT */

var nconf = require('nconf')
    , Provider = nconf.Provider
    , pkginfo = require('pkginfo')
    , _ = require('lodash')
    , logger = require('./logger.js');

function nimbleScriptConfig(options)
{
    this.options = _.defaults({}, options, { config_file_path: 'config/config.json' });
    this._nconf = new Provider();
}

nimbleScriptConfig.prototype = {
    load: function (options)
    {
        logger.debug('Loading configuration');
        logger.debug('Config file path: ' + this.options.config_file_path);
        this._nconf.file(this.options.config_file_path);
        this._nconf.defaults(this._defaults());

    },
    save: function()
    {
        this._nconf.save();
    },
    get: function(settingPath, defaultValue)
    {
        return this._nconf.get(settingPath) || defaultValue;
    },
    set: function(settingPath, value)
    {
        this._nconf.set(settingPath, value);
    },
    _defaults: function ()
    {
        return {
            "webServer": {
                "port": 3000,
                "session_store": {
                    "enabled": false
                }
            }
        };
    }

};

// Default instance
module.exports = new nimbleScriptConfig({});

/**
 * Framework version.
 */
require('pkginfo')(module, 'version');

/**
 * Expose constructors.
 */
