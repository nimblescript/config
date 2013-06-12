/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

var ObjectBase = require('./0ObjectBase.js')
    , logger = require('../logger')
    , _ = require('lodash')
    , config = require('nimblescript-config')
    , request = require('request')
    , qs = require('querystring')
    , fs = require('fs')
    , temp = require('temp')
    , zip = require('../zip')
    , path = require('path')
    , util = require('util')
    , async = require('async')


function Marketplace(repositoryLibrary, options)
{
    logger.debug('New Marketplace instance');
    var opts = _.defaults({}, options, { id: 'marketplace', title: 'Marketplace', context: {} });
    ObjectBase.constructor.call(this, repositoryLibrary, opts);
}
ObjectBase.inherit(Marketplace);


_.extend(Marketplace.prototype, {
    authorize: function (code, callback)
    {
        var userBO = this.businessLibrary.newObject('user');
        var userSettings = userBO.loadSettings();
        this.doRequest('post', '/oauth/accesstoken',
            {
                requestOptions:
                    {
                        form:
                            {
                                client_id: userSettings.marketplace.client_id,
                                client_secret: userSettings.marketplace.secret,
                                code: code
                            }
                    }
            },
            function (err, response)
            {
                var retError;
                if (response)
                {
                    if (response.access_token)
                    {

                        userSettings.marketplace.access_token = response.access_token;
                        userBO.saveSettings(userSettings);
                    }
                    else
                        retError = response.error;
                }
                callback(err || retError, response && response.access_token);
            }
        );
    },
    checkAuthorization: function (callback)
    {
        this.doRequest('get', '/oauth/tokenstatus', callback);
    },
    publishItem: function (data, options, callback)
    {
        logger.debug('Marketplace.publishItem', data);
        _.isFunction(options) && (callback = options, options = {});
        options = options || {};

        if (!_.isObject(data))
        {
            callback && callback('system.invalid_data');
            return;
        }

        var self = this;
        var repositoryBO = this.businessLibrary.newObject('repository');
        repositoryBO.getItem(data.item_path, function (err,response)
        {
            if (response && response.content)
            {
                self.doRequest('post', '/api/item/publishrelease', { requestOptions: { 
                    form: _.extend(_.omit(data, 'item_path'), { script: response.content })}
                } , callback);
            }
        });
        
    },
    getPublisherItems: function (id, options, callback)
    {
        _.isFunction(options) && (callback = options, options = {});
        this.doRequest('get', '/api/publisher/items', { queryStringOptions: { pid: id } }, callback);
    },
    getPublishers: function (options, callback)
    {
        this.doRequest('get', '/api/account/publishers', callback);
    },
    getCategories: function (options, callback)
    {
        this.doRequest('get', '/api/system/categories', callback);
    },
    getLicenses: function (options, callback)
    {
        this.doRequest('get', '/api/system/licenses', callback);
    },
    getItemInfo: function (id, options, callback)
    {
        _.isFunction(options) && (callback = options, options = {});
        !options && (options = {});

        var queryStringOptions = { c: options.complete ? '1' : '' };
        _.extend(queryStringOptions, id);
        this.doRequest('get', '/api/item/info', { queryStringOptions: queryStringOptions }, callback);
    },
    doRequest: function (type, urlPart, options, callback)
    {
        _.isFunction(options) && (callback = options, options = {});
        var userSettings = this.businessLibrary.newObject('user').loadSettings();
        var url = userSettings.marketplace.url + urlPart + '?' +
            qs.stringify(_.extend({}, { access_token: userSettings.marketplace.access_token }, options.queryStringOptions));
        logger.debug('Marketplace.doRequest', 'url', url, { requestOptions: options.requestOptions });
        var requestData = _.extend({ url: url }, options.requestOptions);
        request[type](requestData,
            function (err, response, body)
            {
                var retData, retError;
                if (!_.isEmpty(body))
                {
                    retData = JSON.parse(body);
                    retError = retData.error;
                }
                callback(err && err.message || retError, retData);
            });

    },
    installItem: function (installCode, options, callback)
    {
        var self = this;
        options = options || {};
        var userSettings = this.businessLibrary.newObject('user').loadSettings();

        var info = temp.openSync('nsmp');
        fs.close(info.fd);
        var writeStream = fs.createWriteStream(info.path);

        request.get({
            url: userSettings.marketplace.url + '/api/item/download?' +
                qs.stringify({ access_token: userSettings.marketplace.access_token, install_code: installCode, platform: options.platform })
        },
            function (err, response, body)
            {
                if (err)
                {
                    return callback && callback(err);
                }

                writeStream.end();
                error = response.headers['x-ns-marketplace-error'];
                if (error)
                {
                    callback && callback(error);
                    return;
                }

                itemType = response.headers['x-ns-marketplace-item-type'];

                if (itemType == 'script' && !options.destfilepath)
                {
                    callback && callback('marketplace.no_dest_path');
                    return;
                }
                writeStream.on('close', function ()
                {
                    switch (itemType)
                    {

                        case "script":
                            var repositoryBO = self.businessLibrary.newObject('repository');
                            repositoryBO.saveItem(options.destfilepath, fs.readFileSync(info.path, 'utf8'), function (err, response)
                            {
                                callback && callback(err, !err && { item_type: 'script', install_path: options.destfilepath });
                            });

                            break;
                        case "module":
                            moduleTempPath = info.path;
                            self.installModule(moduleTempPath, userSettings.modulesDirectory, function (err, nsmod, installedDirectory)
                            {
                                callback && callback(err, !err && { item_type: 'module', module: nsmod });
                            });
                            break;
                        default:
                            callback && callback('marketplace.unknown_item_type');
                    }

                });
            }).pipe(writeStream);
    },
    installModule: function (moduleTempPath, installDir, callback)
    {
        var self = this;
        fs.readFile(moduleTempPath, function (err, data)
        {
            if (err)
                return callback('marketplace.invalid_module_file');

            var nsmodFileEntry;
            var reader;
            try
            {
                reader = zip.Reader(data);
                reader.forEach(function (v)
                {
                    if (/\.nsmod/.test(v.getName()))
                        nsmodFileEntry = v;
                });
            }
            catch (e)
            {
                return callback('marketplace.invalid_module_file');
            }

            if (!nsmodFileEntry)
                return callback('marketplace.missing_nsmod');

            var nsmod = JSON.parse(nsmodFileEntry.getData());

            var fileSystemBO = self.businessLibrary.newObject('filesystem');
            // extract
            var moduleDirectory = path.join(installDir, nsmod.id);
            if (!fileSystemBO.mkdir(moduleDirectory))
                return callback('Unable to create module directory: ' + moduleDirectory);

            reader.forEach(function (v)
            {
                var filePath = path.join(moduleDirectory, v.getName());
                if (v.getName() == nsmodFileEntry.getName())
                    filePath = path.join(installDir, v.getName());

                if (v.isDirectory())
                    fileSystemBO.mkdir(filePath);
                else
                    fs.writeFileSync(filePath, v.getData());
            });
            callback(null, nsmod, moduleDirectory);

        });

    }

});


module.exports = new Marketplace;
