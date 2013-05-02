var Simple;
(function (Simple) {
    function main() {
        console.log("hello world!");
    }
    Simple.main = main;
})(Simple || (Simple = {}));
Simple.main();
