/* {NIMBLEFileList_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , util = require('util')
    , config = require('nimblescript-config')
    , fs = require('fs')
    , helper = require('../helper')
    , path = require('path')


function FileList(repositoryLibrary, options)
{

    logger.debug('New FileList instance');
    var opts = _.defaults({}, options, { id: 'filelist', title: 'File List', context: {} });
    ObjectBase.constructor.call(this, repositoryLibrary, opts);
}
ObjectBase.inherit(FileList);


_.extend(FileList.prototype, {
    loadLists: function (options)
    {
        options = options || {};
        var parts = options.path.split('*');
        var repository = parts[0], name = parts[1];
        var fileLists = [], fileList;
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        switch (repository)
        {
            case 'local':
                fileList = this.loadFileSystemList(path.join(userSettings.fileListsDirectory, name + '.nsfl'));
                break;
        }
        if (fileList)
            fileLists.push(fileList);

        options.callback && options.callback(null, fileLists);
        return fileLists;
    },
    findLists: function (options)
    {
        options = options || {};
        var fileLists = [];
        if (options.repository == 'local' || _.isEmpty(options.repository))
        {
            fileLists = this.localLists();
        }
        return fileLists;
    },
    saveList: function (listPath, fileList, options)
    {
        options = options || {};
        var parts = listPath.split('*');
        var repository = parts[0], name = parts[1];
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        switch (repository)
        {
            case 'local':
                this.saveFileSystemList(path.join(userSettings.fileListsDirectory, name + '.nsfl'), fileList);
                break;
        }
    },
    deleteList: function (listPath, options)
    {
        options = options || {};
        var parts = listPath.split('*');
        var repository = parts[0], name = parts[1];
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        switch (repository)
        {
            case 'local':
                this.deleteFileSystemList(path.join(userSettings.fileListsDirectory, name + '.nsfl'));
                break;
        }

    },
    localLists: function ()
    {
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var dirContents = fs.readdirSync(userSettings.fileListsDirectory);
        var fileLists = [];
        for (var index = 0; index < dirContents.length; index++)
        {
            var fileName = dirContents[index];
            if (!helper.endsWith(fileName, '.nsfl'))
                continue;

            var name = fileName.substring(0, fileName.length - 5);
            fileLists.push(name);
        }
        return fileLists;
    },
    loadFileSystemList: function (listPath)
    {
        var fileData = fs.readFileSync(listPath, 'utf8');
        var returnFileList = [];
        var fileList = JSON.parse(fileData);
            
        for (i in fileList)
        {
            var file = fileList[i];
            file.exists = fs.existsSync(file.fullpath);
            if (file.exists)
            {
                try
                {
                    var s = fs.statSync(file.fullpath);
                    console.log('isFile', file.fullpath, s.isFile());
                    if (s.isFile() )
                    {
                        file.filename = path.basename(file.fullpath);
                        file.directory = path.dirname(file.fullpath);
                        file.size = s.size;
                        file.lastModified = s.mtime > s.ctime ? s.mtime : s.ctime;
                        returnFileList.push(file);
                    }
                }
                catch (e)
                {

                }
            }
        }
        return returnFileList;
    },
    saveFileSystemList: function (listPath, fileList)
    {
        fs.writeFileSync(listPath, JSON.stringify(fileList, null, 4), 'utf8');
    },
    deleteFileSystemList: function (listPath)
    {
        fs.unlinkSync(listPath);
    }
});

module.exports = new FileList;
