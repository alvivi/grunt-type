var test;
(function (test) {
    var Foo = (function () {
        function Foo() {
        }
        Object.defineProperty(Foo.prototype, "Name", {
            get: function () {
                return 0;
            },
            enumerable: true,
            configurable: true
        });
        return Foo;
    })();
})(test || (test = {}));
