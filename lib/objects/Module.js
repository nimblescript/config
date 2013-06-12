/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , util = require('util')
    , async = require('async')
    , config = require('nimblescript-config')
    , fs = require('fs')
    , path = require('path')


function Module(repositoryLibrary, options)
{
    
    logger.debug('New Module instance');
    var opts = _.defaults({}, options, { id: 'module', title: 'Module', context: {} });
    ObjectBase.constructor.call(this, repositoryLibrary, opts);
    if (this.repositoryLibrary)
    {
        this.moduleRepositoryObject = this.repositoryLibrary.newObject('module');
    }
}
ObjectBase.inherit(Module);


_.extend(Module.prototype, {
    findModules: function (dirs)
    {
        var discoveredModules = {};
        dirs.forEach(function (dir)
        {
            if (fs.existsSync(dir))
            {
                var files = fs.readdirSync(dir);
                files.forEach(function (file)
                {
                    if (endsWith(file,'.nsmod'))
                    {
                        var module = loadModuleFile(path.join(dir, file));
                        discoveredModules[module.id] = module;
                        if (module.main)
                        {
                            module.mainPath = path.resolve(path.join(dir, module.main));
                        }
                    }
                });
            }
        });
        var result = [];
        for (var k in discoveredModules)
        {
            var module = discoveredModules[k];
            result.push(module);
        }

        return result;

    }
});
 
function loadModuleFile(filePath)
{
    var mod = null;
    try
    {
        if (fs.existsSync(filePath))
        {
            var t = fs.readFileSync(filePath);
            // TO-DO: Checking
            mod = JSON.parse(t);

        }
    }
    catch (e)
    {
    }

    return mod;
}

function endsWith(str, suffix)
{
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};


module.exports = new Module;
