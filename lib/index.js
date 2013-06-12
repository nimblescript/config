/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var pkginfo = require('pkginfo')
  , _ = require('lodash')
  , path = require('path')
  , fs = require('fs')
  , async = require('async')
  , existsSync = fs.existsSync || path.existsSync // 0.6 compat
  , logger = require('./logger.js')



function NimbleScriptBusinessLibrary(options)
{
    this.options = _.defaults({}, options);
    this.repositoryLibrary = this.options.repositoryLibrary;
}

NimbleScriptBusinessLibrary.prototype = {
    staticObject: function(id)
    {
        return objects[id]
    },
    newObject: function (id, context)
    {
        context = _.defaults({}, context, { initiator_id: '', initiator_type: '', endpoint: 'web', locale: 'en' })
        var objInstance;
        var object = objects[id];
        if (object)
        {
            objInstance = new object.constructor(this._repositoryLibrary, { business_library: this, context: context} );
        }
        return objInstance;
    },
    express: function (app)
    {
        var self = this;
        return function (req, res, next)
        {
            res.locals.logger.debug('Injecting NimbleScript Business Library');
            res.locals.nimblescript = _.extend({}, res.locals.nimblescript, { business_library: self });
            next();
        }
    }

}

Object.defineProperties(NimbleScriptBusinessLibrary.prototype,
    {
        "objects": 
            {
                get: function ()
                {
                    return objects;
                }
            },
        "repositoryLibrary":
            {
                get: function ()
                {
                    return this._repositoryLibrary;
                },
                set: function (value)
                {
                    this._repositoryLibrary = value;
                }
            }
    }
    );

var objects = {};
function loadObjects()
{
    var dir = __dirname + '/objects';
    if (!existsSync(dir)) return;
    var exts = ['js'];
    var files = fs.readdirSync(dir).sort();
    files.forEach(function (file)
{
        var regex = new RegExp('\\.(' + exts.join('|') + ')$');
        if (regex.test(file))
        {
            var mod = require(path.join(dir, file));
            objects[mod.id] = mod;
            logger.debug('Loaded object ' + mod.id);
        }
    });

}

loadObjects();


/**
 * Framework version.
 */
require('pkginfo')(module, 'version');

/**
 * Constructors.
 */

module.exports = new NimbleScriptBusinessLibrary();
module.exports.NimbleScriptBusinessLibrary = NimbleScriptBusinessLibrary;
