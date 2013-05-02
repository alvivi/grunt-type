var first;
(function (first) {
    function a() {
        console.log('a');
    }
    first.a = a;
})(first || (first = {}));
//@ sourceMappingURL=first.js.map
