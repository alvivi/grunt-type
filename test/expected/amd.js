define(["require", "exports"], function(require, exports) {
    
    (function (foo) {
        var Bar = (function () {
            function Bar() { }
            Bar.prototype.foobar = function () {
                return true === false;
            };
            return Bar;
        })();        
    })(exports.foo || (exports.foo = {}));
    var foo = exports.foo;
})
