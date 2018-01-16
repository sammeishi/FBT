const _ = require("underscore");
/*
* 进程事件管理
* 用于进程间通信，包装message
* */
module.exports = class{
    constructor() {
        this.workers = [];
    }
    /*
    * 主线程身份
    * 添加自己的worker
    * */
    setWorkers( wks ){
        this.workers = wks;
    }
    /*
    * 主线程
    * 向子线程发送事件
    * */
    send2AllWorker(){
        let args = Array.prototype.slice.call(arguments);
        args.splice(0, 0, this.workers);
        return this.send2Worker.call( this,args );
    }
    send2Worker(){
        let args = Array.prototype.slice.call(arguments);
        //let workers = args.shift();
        //let eventName = args.shift();
        console.log( Array.prototype.slice.call(arguments) );
    }
};