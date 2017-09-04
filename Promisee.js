const PENDING = Symbol();
const FULFILLED = Symbol();
const REJECTED = Symbol();

function Promisee(fn) {
    if (typeof fn !== "function") {
        throw new Error("resolver should be a function!");
    }

    let state = PENDING;
    let value = null;
    let handler = [];

    function fulfill(result) {
        state = FULFILLED;
        value = result;
        handler.forEach(next);
        handler = null;
    }

    function reject(err) {
        state = REJECTED;
        value = err;
        handler.forEach(next);
        handler = null;
    }

    function resolve(result) {
        try {
            let then = typeof result.then == "function" ? result.then : null;
            if (then) {
                then.bind(result)(resolve, reject);
                return;
            }
            fulfill(result);
        } catch (e) {
            reject(e);
        }
    }

    function next({ onFulfill, onReject }) {
        switch (state) {
            case FULFILLED:
                onFulfill && onFulfill(value);
                break;
            case REJECTED:
                onReject && onReject(value);
                break;
            default:
                handler.push({ onFulfill, onReject });
                break;
        }

    }

    this.then = function(onFulfill, onReject) {
        return new Promisee((resolve, reject) => {
            next({
                onFulfill: (val) => {
                    try {
                        resolve(onFulfill(val));
                    } catch (e) {
                        reject(onReject(e));
                    }
                },
                onReject: (err) => {
                    reject(onReject(err));
                }
            });
        })
    }

    this.catch = function(onReject) {
        return new Promisee((resolve, reject) => {
            next({
                onFulfill: null,
                onReject: (e) => {
                    try {
                        reject(onReject(e));
                    } catch (e) {
                        reject(onReject(e));
                    }
                }
            });
        });
    }

    fn(resolve, reject);
}


function sleep(sec) {
    return new Promisee((resolve, reject) => {
        setTimeout(() => resolve(sec), sec * 1000)
    })
}

let p = new Promisee((resolve, reject) => {
    resolve("hello - " + Math.random());
});

p.then((val) => {
    console.log(val)
    return sleep(3)
})
// .then((val) => {
// 	return "world";
// })
// .then((val) => {
// 	console.log(val)
// 	return sleep(1)
// })
// .then(() => console.log("over"))