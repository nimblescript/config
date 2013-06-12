/* {NIMBLESCRIPT_BUSINESS_LIBRARY_COPYRIGHT} */

function ObjectBase(repositoryLibrary, options)
{
    var opts = options || {};
    this.repositoryLibrary = repositoryLibrary;
    this.businessLibrary = opts.business_library;
    this.id = opts.id;
    this.title = opts.title;
    this.context = opts.context
}
ObjectBase.prototype = {
    newDataObject: function (id, options)
    {
        return this.repositoryLibrary.newObject(id, options);
    }
}

var Constr = function () { };
Constr.prototype = ObjectBase.prototype;

function inherit(o)
{
    o.prototype = new Constr();
    o.prototype.constructor = o;
}

module.exports = new ObjectBase(null, { id: 'objectbase', title: 'ObjectBase' });
module.exports.constructor = ObjectBase
module.exports.inherit = inherit;
