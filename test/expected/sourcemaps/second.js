var second;
(function (second) {
    var f = first;
    function main() {
        f.a();
    }
    second.main = main;
})(second || (second = {}));
second.main();
//@ sourceMappingURL=second.js.map
