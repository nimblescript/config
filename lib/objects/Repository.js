/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , util = require('util')
    , async = require('async')
    , config = require('nimblescript-config')
    , path = require('path')
    , fs = require('fs')
    , helper = require('../helper')

function Repository(repositoryLibrary, options)
{

    logger.debug('New Repository instance');
    var opts = _.defaults({}, options, { id: 'repository', title: 'Repository', context: {} });
    ObjectBase.constructor.call(this, repositoryLibrary, opts);
    if (this.repositoryLibrary)
    {
        this.scriptRepositoryObject = this.repositoryLibrary.newObject('script');
    }
}
ObjectBase.inherit(Repository);

var STORE_TYPE = {
    filesystem: 'filesystem'
}
_.extend(Repository.prototype, {
    findTemplates: function (options, callback)
    {
        var self = this;
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var repositories = this.repositoriesForUser();
        var templates = [];
        _.each(repositories, function (repository)
        {
            var templateFiles = [];
            switch (repository.storeType)
            {
                case STORE_TYPE.filesystem:
                    templateFiles = self.loadFileSystemTemplates(path.join(repository.path, 'templates'));
                    break;
            }
            _.each(templateFiles, function (templateFile)
            {
                templates.push({
                    type: 'text',
                    repository: repository.id, filename: templateFile.name,
                    path: templateFile.fullPath, id: repository.id + '*' + templateFile.fullPath
                });
            });
        })
        callback && callback(null, templates);

    },
    getTemplate: function(itemPath, callback)
    {
        return this.getItem(itemPath, callback);
    },
    loadFileSystemTemplates: function (dir)
    {
        var templates = [];
        var filesystemBO = this.businessLibrary.newObject(STORE_TYPE.filesystem);
        return filesystemBO.getDirectoryContents(dir);

    },
    repositoriesForUser: function (context)
    {
        var userBO = this.businessLibrary.newObject('user');
        var userSettings = userBO.loadSettings();
        var repositories = [];
        repositories.push({ storeType: STORE_TYPE.filesystem, path: toUnixPath(userSettings.repositoryDirectory), title: 'Local', id: 'local' });

        // Server side registered repositories

        // Custom repositories
        if (userSettings.repositories)
        {
            _.each(userSettings.repositories.custom, function (customRepository)
            {
                repositories.push({ storeType: STORE_TYPE.filesystem, path: toUnixPath(customRepository.path), title: customRepository.path, id: encodeURIComponent(customRepository.path) });
            })
        }
        return repositories;
    },
    itemAllData: function (itemPath, callback, options)
    {
        var self = this;
        async.parallel([
            function scriptData(cb)
            {
                self.runnerAction(itemPath, 'getAll', function (err,result)
                {
                    cb(err, result);
                }, options);
            },
            function itemInfo(cb)
            {
                self.itemCommand(itemPath, 'read', 'info', cb, options);
            }
        ], function complete(err, results)
        {
            callback(err,_.extend(results[0], { info: results[1] }));
        });
        
    },
    itemSummary: function (itemPath, callback, options)
    {
        this.runnerAction(itemPath, 'getSummary', callback, options);
    },
    itemParameters: function (itemPath, callback, options)
    {
        this.runnerAction(itemPath, 'getParameters', callback, options);
    },
    itemRun: function (itemPath, callback, options)
    {
        this.runnerAction(itemPath, 'run', callback, options);
    },
    runnerAction: function (itemPath, action, callback, options)
    {

        var self = this;
        this.canDoItemAction(itemPath, 'run', null, function (err, canAction, repository)
        {
            if (err)
                return callback(err);

            if (!canAction)
                return callback('repository.access_denied');

            var parts = itemPath.split('*');
            var repositoryId = parts[0], relPath = parts[1];

            switch (repository.storeType)
            {
                case STORE_TYPE.filesystem:
                    var filesystemBO = self.businessLibrary.newObject(STORE_TYPE.filesystem);
                    if (!filesystemBO.exists(relPath))
                        return callback('system.not_exist');

                    var runnerBO = self.businessLibrary.newObject('runner');
                    runnerBO[action](relPath, function (result)
                    {
                        callback(null,result);
                    },options);

                    break;
            }
        })

    },
    itemCommand: function(itemPath, access, command, callback, options)
    {
        var self = this;
        this.canDoItemAction(itemPath, access, null, function (err, canAction, repository)
        {

            if (err)
                return callback(err);

            if (!canAction)
                return callback('repository.access_denied');

            var parts = itemPath.split('*');
            var repositoryId = parts[0], relPath = parts[1];

            var response;
            var fileSystemBO = self.businessLibrary.newObject(STORE_TYPE.filesystem);
            switch (command)
            {
                case 'newfolder':
                    switch (repository.storeType)
                    {
                        case STORE_TYPE.filesystem:
                            response = fileSystemBO.newDirectory(relPath, options);
                            break;
                    }
                    break;
                case 'rename':
                    switch (repository.storeType)
                    {
                        case STORE_TYPE.filesystem:
                            response = fileSystemBO.rename(relPath, options.newname, options);
                            if (response.newpath)
                                response.newpath = repositoryId + '*' + toUnixPath(response.newpath);
                            break;
                    }
                    break;
                case 'save':
                    switch (repository.storeType)
                    {
                        case STORE_TYPE.filesystem:
                            response = fileSystemBO.writeFile(relPath, options.content, 'utf8');
                            if (response.path)
                                response.path = repositoryId + '*' + toUnixPath(response.path);
                            break;
                    }
                    break;
                case 'delete':
                    switch (repository.storeType)
                    {
                        case STORE_TYPE.filesystem:
                            response = fileSystemBO.del(relPath);
                            break;
                    }
                    break;
                case 'get':
                    switch (repository.storeType)
                    {
                        case STORE_TYPE.filesystem:
                            response = fileSystemBO.readFile(relPath, 'utf8', { content: true });
                            if (response.path)
                                response.path = itemPath;
                    }
                    break;
                case 'info':
                    switch (repository.storeType)
                    {
                        case STORE_TYPE.filesystem:
                            response = fileSystemBO.fileInfo(relPath, 'utf8');
                            if (response.path)
                                response.path = itemPath;
                    }
                    break;


            }
            callback(null, response);
        })

    },
    getItem: function (itemPath, callback, options)
    {
        this.itemCommand(itemPath, 'read', 'get', callback, options);
    },
    itemInfo: function(itemPath, callback, options)
    {
        this.itemCommand(itemPath, 'read', 'info', callback, options);
    },
    saveItem: function (itemPath, content, callback, options)
    {
        this.itemCommand(itemPath, 'write', 'save', callback, _.extend({}, options, { content: content }));
    },
    renameItem: function (itemPath, newName, callback, options)
    {
        this.itemCommand(itemPath, 'write', 'rename', callback, _.extend({}, options, { newname: newName}));
    },
    deleteItem: function (itemPath, callback, options)
    {
        this.itemCommand(itemPath, 'write', 'delete', callback, options);
    },
    newFolder: function (itemPath, callback, options)
    {
        this.itemCommand(itemPath, 'write', 'newfolder', callback, options);
    },
    getChildrenTree: function (itemPath, callback, options)
    {
        // Hard coded filesystem
        var filesystemBO = this.businessLibrary.newObject(STORE_TYPE.filesystem);
        var parts = itemPath.split('*');
        var repositoryId = parts[0], relPath = parts[1];
        var opts = _.extend({}, options, { dirOnly: false });
        var items = filesystemBO.getDirectoryContentsTree(relPath, _.extend({ dirOnly: opts.dirOnly }, options));
        _.each(items, function(item)
        {
            item.key = repositoryId + '*' + item.key;
        });
        callback(null, items);
    },
    canDoItemAction: function (itemPath, action, context, callback)
    {
        var parts = itemPath.split('*');
        var repositoryId = parts[0], relPath = parts[1];

        var repository = this.findRepository(itemPath, context);
        if (!repository)
            return doResult('repository.no_match');

        switch (repository.storeType)
        {
            case STORE_TYPE.filesystem:
                if (helper.isInFilesystemPath(path.normalize(relPath), path.normalize(repository.path)))
                    return doResult(null, true, repository);
        }
        return doResult(null, false, repository);

        function doResult(err, canAction, repository)
        {
            if (callback)
                callback(err, canAction, repository)
            return { err: err, canAction: canAction, repository: repository };
        }
    },
    findRepository: function (itemPath, context)
    {
        var parts = itemPath.split('*');
        var repositoryId = parts[0], relPath = parts[1];

        var matchingRepository;
        _.each(this.repositoriesForUser(context), function (repository)
        {
            if (repository.id == repository.id)
            {
                matchingRepository = repository;
                return false;
            }
        })
        return matchingRepository;
    }

});

function toUnixPath(s)
{
    return s.replace(/\\/g, "/");
}

function isEmpty(value)
{
    return (value == undefined || value == null || value.length === 0);
}


module.exports = new Repository;
