///<reference path="first.ts" />

module second {
    import f = first;
    export function main() {
        f.a();
    }
}

second.main();
