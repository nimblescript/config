/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , util = require('util')
    , async = require('async')
    , config = require('nimblescript-config')
    , fs = require('fs')
    , path = require('path')
    , open = require('open')
    , helper = require('../helper')

function Filesystem(repositoryLibrary, options)
{
    logger.debug('New Filesystem instance');
    var opts = _.defaults({}, options, { id: 'filesystem', title: 'Filesystem', context: {} });
    ObjectBase.constructor.call(this, repositoryLibrary, opts);
}
ObjectBase.inherit(Filesystem);

module.exports = new Filesystem;

_.extend(Filesystem.prototype, {
    getMounts: function ()
    {
        if (process.platform == 'win32')
            return getWindowsDrives();
        else
            return ['/'];

    },
    fileInfo: function(filePath, encoding)
    {
        return this.readFile(filePath, encoding, { content: false });
    },
    readFile: function(filePath,encoding, options)
    {
        options = options || {};
        encoding = encoding || 'utf8';
        var normalizedPath = path.normalize(filePath);
        if (!options.force && !this.hasAccessToPath(normalizedPath, 'R'))
            return { actioned: false, message: 'system.access_denied' };

        try
        {
            if (!fs.existsSync(normalizedPath))
                return { actioned: false, message: 'system.not_exist' };

            var s = fs.statSync(normalizedPath);
            var o = {
                actioned: true, path: filePath, 
                type: 'file',
                size: s.size, lastmodified: s.mtime > s.ctime ? s.mtime : s.ctime
            };
            if (options.content)
                o.content = fs.readFileSync(normalizedPath, encoding);

            return o;

        }
        catch (e)
        {
            return { actioned: false, message: 'system.fs.' + e.code, error: e };
        }
    },
    writeFile: function(filePath,content, encoding, options)
    {
        options = options || {};
        encoding = encoding || 'utf8';
        var normalizedPath = path.normalize(filePath);
        if (!options.force && !this.hasAccessToPath(normalizedPath, 'W'))
            return { actioned: false, message: 'system.access_denied' };

        try
        {
            
            fs.writeFileSync(normalizedPath, content, encoding);
            var s = fs.statSync(normalizedPath);
            return {
                actioned: true, path: filePath,
                type: 'file',
                size: s.size, lastmodified: s.mtime > s.ctime ? s.mtime : s.ctime
            };
        }
        catch (e)
        {
            return { actioned: false, message: 'system.fs.' + e.code, error: e };
        }

    },
    getRootFolders: function(options)
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var rootDirectories = [];
        if (options.restrictToAllowed)
        {
            userSettings.allowedFileAccessDirectories.forEach(function (accessPath)
            {
                if (accessPath.access.indexOf('R') >= 0)
                    rootDirectories.push(accessPath.path);
            });
        }
        else
        {
            rootDirectories = this.getMounts();
            rootDirectories = rootDirectories || [];
        }

        var data = [];
        rootDirectories.forEach(function (rootDir)
        {

            var dirData = {};
            dirData['title'] = rootDir;
            dirData['isFolder'] = true;
            dirData['key'] = toUnixPath(rootDir);
            if (!options.checkboxes)
                dirData['hideCheckbox'] = true;
            dirData['isLazy'] = true;
            dirData['lastModified'] = null;
            dirData['size'] = 0;
            data.push(dirData);

        });
        data.sort(function (a, b)
        {
            return a.title > b.title;
        });

        return data;

    },
    getDirectoryContents: function (directory, options)
    {
        return getDirectoryContents(directory, options);
    },
    newDirectory: function(parentDirectory, options)
    {
        var normalizedPath = path.normalize(parentDirectory);
        if (!this.hasAccessToPath(normalizedPath, 'W'))
            return { actioned: false, message: 'system.access_denied' };
        if (!fs.existsSync(normalizedPath))
            return { actioned: false, message: 'system.not_exist' };

        try
        {
            var s = fs.statSync(parentDirectory);
            if (!s.isDirectory())
                return { actioned: false, message: 'system.not_directory' };

            var newFolderName = findNextAvailableName(path.join(parentDirectory, 'New folder'));
            fs.mkdirSync(path.join(parentDirectory,newFolderName));
            return {
                actioned: true, path: parentDirectory, name: newFolderName,
                type: s.isDirectory() ? 'dir' : 'file',
                size: s.isDirectory() ? 0 : s.size, lastmodified: s.mtime > s.ctime ? s.mtime : s.ctime
            };
        }
        catch (e)
        {
            return { actioned: false, message: 'system.fs.' + e.code, error: e };
        }
    },
    getDirectoryContentsTree: function (directory, options)
    {
        _.defaults({}, options, { dirOnly: false, checkboxes: false });

        var folders = [];
        var files = [];
        var dirContents = this.getDirectoryContents(directory, options);
        _.each(dirContents, function (dirItem)
        {
            if (dirItem.isDirectory)
            {
                var dirData = {};
                dirData['title'] = dirItem.name;
                dirData['key'] = toUnixPath(dirItem.fullPath);
                dirData['isFolder'] = true;
                dirData['isLazy'] = true;
                dirData['lastModified'] = dirItem.lastModified;
                if (!options.checkboxes)
                    dirData['hideCheckbox'] = true;
                dirData['size'] = 0;
                folders.push(dirData);
            }
            else if (dirItem.isFile && !options.dirOnly)
            {
                var fileData = {};
                fileData['title'] = dirItem.name;
                fileData['filename'] = dirItem.name;
                fileData['size'] = dirItem.size;
                fileData['key'] = toUnixPath(dirItem.fullPath);
                fileData['directory'] = toUnixPath(path.dirname(dirItem.fullPath));
                fileData['lastModified'] = dirItem.lastModified;
                if (!options.checkboxes)
                    fileData['hideCheckbox'] = true;
                files.push(fileData);
            }
        })

        return folders.concat(files);
    },
    launch: function (itemPath)
    {
        var canLaunch = fs.existsSync(path.normalize(itemPath)) && this.hasAccessToPath(itemPath, 'R');
        if (canLaunch)
            open(itemPath);
        return canLaunch;
    },
    rename: function(itemPath, newName, options)
    {
        var options = options || {};
        var normalizedPath = path.normalize(itemPath);
        if (!options.force && !this.hasAccessToPath(normalizedPath, 'W'))
            return { actioned: false, message: 'system.access_denied' };
        if (!fs.existsSync(normalizedPath))
            return { actioned: false, message: 'system.not_exist' };


        var newPath = path.join(path.dirname(normalizedPath), newName);
        if (fs.existsSync(newPath))
            return { actioned: false, message: 'system.already_exists', suggestion: findNextAvailableName(newPath) }

        try
        {
            fs.renameSync(itemPath, newPath);
            return { actioned: true, newpath: newPath, newname: newName};
        }
        catch (e)
        {
            return { actioned: false, message: 'system.fs.' + e.code, error: e };
        }
    },
    del: function (itemPath, options)
    {
        var options = options || {};
        var normalizedPath = path.normalize(itemPath);
        if (!options.force && !this.hasAccessToPath(normalizedPath, 'W'))
            return { actioned: false, message: 'system.access_denied' };
        if (!fs.existsSync(normalizedPath))
            return { actioned: false, message: 'system.not_exist' };

        try
        {
            var s = fs.statSync(itemPath);
            if (s.isDirectory())
                rmdir(itemPath);
            else
                fs.unlinkSync(itemPath);
            return { actioned: true };
        }
        catch (e)
        {
            console.log(e);
            return { actioned: false, message: 'system.fs.' + e.code, error: e };
        }
    },
    hasAccessToPath: function (itemPath, access)
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var pathsWithAccess = _.filter(userSettings.allowedFileAccessDirectories, function (item)
        {
            return _.contains(item.access, access);
        });
        pathsWithAccess.push({ path: userSettings.repositoryDirectory, access: 'RW' });
        pathsWithAccess.push({ path: userSettings.fileListsDirectory, access: 'RW' });
        pathsWithAccess.push({ path: userSettings.savedParametersDirectory, access: 'RW' });
        var hasAccess = false;
        _.each(pathsWithAccess, function(item)
        {
            if (helper.isInFilesystemPath(itemPath, item.path))
            {
                hasAccess = true;
                return true;
            }
        })
        return hasAccess;
    },
    exists: function (itemPath)
    {
        return fs.existsSync(itemPath);
    },
    mkdir: function (itemPath)
    {
        return helper.mkdir(itemPath);
    }

});
 


function findNextAvailableName(itemPath)
{
    var dir = path.dirname(itemPath), filename = path.basename(itemPath);
    var index = 2;
    var newFilename = filename;
    while (fs.existsSync(path.join(dir, newFilename)))
        newFilename = filename + ' (' + (index++) + ')';

    return newFilename;
}
function getWindowsDrives()
{
    var drives = [];
    for (var i = 'A'.charCodeAt() ; i <= 'Z'.charCodeAt() ; i++)
    {
        var path = String.fromCharCode(i) + ':\\';
        if (fs.existsSync(path))
            drives.push(path);
    }
    return drives;
}

function getDirectoryContents(directory, options)
{
    options = options || {};
    var items = [];
    // Catch permission exceptions
    try
    {
        var directoryContents = fs.readdirSync(directory);
    }
    catch (e)
    {
        return items;
    }
    for (i in directoryContents)
    {
        var fullPath = path.join(directory, directoryContents[i]);
        var filename = path.basename(fullPath);
        // statSync can thrown an exception if it has access issues with fullPath
        try
        {
            var s = fs.statSync(fullPath);
            var lastModified = s.mtime > s.ctime ? s.mtime : s.ctime;
            if (s.isFile() && options.fileFilter)
                if (!matchesFilter(filename, options.fileFilter))
                    continue;

            items.push({ fullPath: fullPath, isDirectory: s.isDirectory(), isFile: s.isFile(), name: directoryContents[i], size: s.size, 'lastModified': lastModified });
        }
        catch (e)
        {
        }
    }
    return items;
}

function matchesFilter(filename, fileFilter)
{
    var matches = false;
    _.each(fileFilter, function (filter)
    {
        if (new RegExp(filter).test(filename))
        {
            matches = true;
            return true;
        }
    });
    return matches;
}
function toUnixPath(s)
{
    return s.replace(/\\/g, "/");
}

var rmdir = function (dir)
{
    var list = fs.readdirSync(dir);
    for (var i = 0; i < list.length; i++)
    {
        var filename = path.join(dir, list[i]);
        var stat = fs.statSync(filename);

        if (filename == "." || filename == "..")
        {
            // pass these files
        } else if (stat.isDirectory())
        {
            // rmdir recursively
            rmdir(filename);
        } else
        {
            // rm fiilename
            fs.unlinkSync(filename);
        }
    }
    fs.rmdirSync(dir);
};
