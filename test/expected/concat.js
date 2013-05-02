var first;
(function (first) {
    function a() {
        console.log('a');
    }
    first.a = a;
})(first || (first = {}));
var second;
(function (second) {
    var f = first;
    function main() {
        f.a();
    }
    second.main = main;
})(second || (second = {}));
second.main();
