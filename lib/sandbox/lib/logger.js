var log4js = require('log4js')
	, path = require('path')
	, dateFormat = require('dateformat')
	
var Logger = function (settings)
{
    this.directory = settings.directory;
    this.fileDate = null;
    this.toFile = settings.toFile || false;
    this.init();
}
Logger.prototype = {

    init: function ()
    {

        if (!this.fileDate || this.fileDate.toDateString() != (new Date()).toDateString())
        {
            this.fileDate = new Date();
            var appenders = [];
            if (this.toFile)
            {
                log4js.loadAppender('file');
                appenders.push({ type: 'file',
                    filename: path.join(this.directory, 'shovel ' + dateFormat(new Date, 'dd-mm-yyyy') + '.log')
                });
            }
            log4js.configure({ appenders: appenders, replaceConsole: false });
        }
    },
    log: function (level, args)
    {
        this.init();
        log4js.getLogger()[level].apply(log4js.getLogger(), args);
    },
    info: function ()
    {
        var args = Array.prototype.slice.call(arguments);
        this.log('info', args);
    },
    error: function ()
    {
        var args = Array.prototype.slice.call(arguments);
        this.log('error', args);
    },
    warning: function ()
    {
        var args = Array.prototype.slice.call(arguments);
        this.log('warning', args);
    },
    debug: function ()
    {
        var args = Array.prototype.slice.call(arguments);
        this.log('debug', args);
    },
    fatal: function ()
    {
        var args = Array.prototype.slice.call(arguments);
        this.log('fatal', args);
    }

};

module.exports = Logger;