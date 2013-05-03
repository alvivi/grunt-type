
import mod = module('mod.js');

export module foo {
    class Bar {
        foobar (): boolean {
            return true === false;
        }
    }
}
