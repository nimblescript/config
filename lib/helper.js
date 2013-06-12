var _ = require('lodash')
    , fs = require('fs')
    , path = require('path')

module.exports.flatten = function flatten(object, max_depth) {
  if (typeof object !== 'object') return object;
  var copy = {}
  function flat (level, depth, path) {
    //console.log('flat', level, depth, path, max_depth, (depth < max_depth))
    if ((typeof level === 'object') && (max_depth ? (depth < max_depth) : true)) {
      level = _.clone(level);
      for (var key in level) {
        var value = level[key];
        flat (value, depth + 1, ((typeof path === 'string') ? path + '.' : '') + key);
      }
    } else {
      copy[path] = level;
    }
  }
  flat(object, 0);
  return copy
}

/* Courtesy Backbone.extend */
module.exports.extend = function (protoProps, staticProps)
{
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent's constructor.
    if (protoProps && _.has(protoProps, 'constructor'))
    {
        child = protoProps.constructor;
    } else
    {
        child = function () { return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    var Surrogate = function () { this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
};

module.exports.inherit = function(a,b)
{
    var Constr = function () { };
    Constr.prototype = a.prototype;
    b.prototype = new Constr();
    b.prototype.constructor = b;
}

module.exports.endsWith = function (str, suffix)
{
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

module.exports.toUnixPath = function (str)
{
    return str.replace(/\\/g, "/");
}

module.exports.isInFilesystemPath = function(thePath, allowedParentPaths)
{
    if (_.isEmpty(thePath))
        return false;
    thePath = path.resolve(thePath);
    var pathsArray = [];
    if (typeof allowedParentPaths == 'string')
        pathsArray.push(allowedParentPaths);
    else if (Array.isArray(allowedParentPaths))
        pathsArray = allowedParentPaths;
    else
        return false;

    for (i in pathsArray)
    {
        var allowedParentPath = path.normalize(pathsArray[i]);
        var relativeTo = path.relative(allowedParentPath, thePath);
        var notAllowedPath = /^(\\|\/|.\:|\.\.)/;
        if (!relativeTo.match(notAllowedPath))
            return true;
    }
    return false;
}

module.exports.mkdir = function(aPath)
{
    try
    {
        var parts = aPath.split(path.sep)
        parts.forEach(function (e, i)
        {
            if (e.length > 0 && parts.indexOf(':') == -1)
            {
                var cPath = path.normalize(parts.slice(0, i + 1).join(path.sep));
                if (!fs.existsSync(cPath))
                    fs.mkdirSync(cPath);
            }
        });

        return true;
    }
    catch (e)
    {
        return e.code == 'EEXIST';
    }
}


