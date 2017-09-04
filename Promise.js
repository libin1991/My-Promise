const PENDING = "PENDING",
    FULFILLED = "FULFILLED",
    REJECTED = "REJECTED";

function Promise(resolver) {
    if (!isFunction(resolver)) {
        throw new TypeError("TypeError: resolver must be a function");
    }

    //	实例的值
    this.value = null;

    //	实例的状态
    this.status = PENDING;

    //	成功回调和失败回调
    this._doneCallbacks = [];
    this._failCallbacks = [];

    //	在执行resolver内部抛出异常, try ... catch 包裹
    try {
        resolver(resolve.bind(this), reject.bind(this));
    } catch (ex) {
        reject.bind(this)(ex);
    }
}


Promise.prototype = {

	constructor: Promise,

	/**
	 * then方法, 可接收onFulfilled, onRejected两个函数类型的参数, 传入的参数将被存储到_doneCallbacks和_failCallbacks中
	 * 返回一个新的Promise实例
	 * @return   {Promise}
	 */
	then: function(onFulfilled, onRejected) {
	    let ins = new Promise(() => {});
	    if (isFunction(onFulfilled)) {
	    	this._doneCallbacks.push(makeCallback(ins, onFulfilled, "resolve"));
	    }
	    if (isFunction(onRejected)) {
	    	this._failCallbacks.push(makeCallback(ins, onFulfilled, "reject"));
	    }
	    return ins;
	},

	catch: function(onRejected) {
		return this.then(null, onRejected);
	}

};

Promise.resolve = function(result) {
    this.status = FULFILLED;
    this.value = result;
};

Promise.reject = function(ex) {
    this.status = REJECTED;
    this.value = ex;
};

function makeCallback(promise, callback, action) {
    return function promiseCallback(value) {
    	//	callback是个函数
        if (isFunction(callback)) {

        	//	定义个变量去接受返回值
        	//	防止抛出异常, try ... catch 包裹
            let x;
            try {
                x = callback(value);
            } catch (ex) {
                reject.bind(promise)(ex);
            }

            //	callback中返回的是this, 会引发死循环
            //	抛出类型异常到reject
            /**
             * const ins = new Promise((resolve, reject) => {});
             *
             * ins.then(() => {
             * 		return ins;
             * });
             */
            if (x === promise) {
                let reason = new TypeError("TypeError: The return value could not be same with the promise");
                reject.bind(promise)(reason);
            } else if (x instanceof Promise) {

            	//	callback中返回一个新的Promise
            	//	执行该Promise的then和catch
            	/**
            	 * const ins = new Promise((resolve, reject) => {});
            	 *
            	 * ins.then(() => {
            	 * 		return new Promise((resolve, reject) => {});
            	 * });
            	 */
                x.then((data) => {
                    resolve.bind(promise)(data);
                }, (ex) => {
                    reject.bind(promise)(ex);
                });
            } else {
                let then;
                (function resolveThenable(x) {
                    // 如果返回的是一个Thenable对象(Promise)
                    if (x && (typeof x === "object" || typeof x === "function")) {
                        try {
                            then = x.then;
                        } catch (ex) {
                            reject.bind(promise)(ex);
                            return;
                        }

                        if (typeof then === "function") {
                            // 调用Thenable对象的then方法时,传递进去的resolvePromise和rejectPromise方法（及下面的两个匿名方法）
                            // 可能会被重复调用。 但Promise+规范规定这两个方法有且只能有其中的一个被调用一次,多次调用将被忽略
                            // 此处通过invoked来处理重复调用
                            let invoked = false;
                            try {
                                then.call( x, (y) => {
                                		//	避免死循环
                                        if (invoked) {
                                            return;
                                        }
                                        invoked = true;

                                        // 避免死循环
                                        if (y === x) {
                                            throw new TypeError("TypeError: The return value could not be same with the previous thenable object");
                                        }

                                        // y仍有可能是thenable对象，递归调用
                                        resolveThenable(y);
                                    }, (e) => {
                                        if (invoked) {
                                            return;
                                        }
                                        invoked = true;
                                        reject.bind(promise)(e);
                                    }
                                );
                            } catch (e) {
                                // 如果resolvePromise和rejectPromise方法被调用后,再抛出异常,则忽略异常
                                // 否则用异常对象reject此Promise对象
                                if (!invoked) {
                                    reject.bind(promise)(e);
                                }
                            }
                        } else {
                            resolve.bind(promise)(x);
                        }
                    } else {
                        resolve.bind(promise)(x);
                    }
                }(x));
            }
        } else {
        	//	根据action判断执行resolve或者reject
        	action === "resolve" ? resolve.bind(promise)(value) : reject.bind(promise)(value);
        }
    };
}

/**
 * new Promise((resolve, reject) => {}) 中的 resolve方法
 */
function resolve(data) {
	//	判断当前resolve是否已经被调用过一次
    if (this.status !== PENDING) {
        return;
    }
    this.value = data;
    this.status = FULFILLED;
    run.call(this);
}

/**
 * new Promise((resolve, reject) => {}) 中的 reject方法
 */
function reject(ex) {
	//	判断当前reject是否已经被调用过一次
    if (this.status !== PENDING) {
        return;
    }
    this.value = ex;
    this.status = REJECTED;
    run.call(this);
}

function run() {
	//	还没有执行resolve或者reject
    if (this.status === PENDING) {
        return;
    }
    const value = this.value,
        callbacks = this.status === FULFILLED ? this._doneCallbacks : this._failCallbacks;

    //	依次执行缓存的函数列表
    let timeout = setTimeout(() => {
        for (let fn of callbacks) {
            fn(value);
        }
        clearTimeout(timeout);
    });

    //	实例外部不能直接访问_doneCallbacks或者_failCallbacks
    this._doneCallbacks = [];
    this._failCallbacks = [];
}

//	判断函数类型
function isFunction(obj) {
    return typeof obj === "function";
}

//	判断数组类型
function isArray(obj) {
    return typeOf(obj) === "array";
}

function typeOf(obj) {
    return {}.toString.call(obj).slice(8, -1).toLowerCase();
}

module.exports = Promise;
