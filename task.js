/*
* 任务执行脚本
* @任务
* 基于引擎运行的
* */
let gconf = require("./config");
let cluster = require('cluster');
let tasks = [];//当前线程分配的任务列表
/*
* wk事件中心，用于监听与触发
* */
let WKEventCenter = {
    allCB: { "def": [] },
    listen: function( name,cb ){
        if( typeof( this.allCB[ name ] ) === "undefined" ){
            this.allCB[ name ] = [];
        }
        this.allCB[ name ].push( cb );
    },
    trigger: function( event ){
        let name = event.name || "def";
        let cbs = this.allCB[ name ] || [];
        for(let i = 0,n = cbs.length; i < n; i++){
            cbs[i] && cbs[i]( event );
        }
    }
};
let WK_LISTEN = WKEventCenter.listen.bind( WKEventCenter );
let WK_TRIGGER = WKEventCenter.trigger.bind( WKEventCenter );

/*
* onTaskRun 开始运行，主线程调用，分配任务开始运行。
* 遍历每一个任务获取任务引擎，创建引擎开始运行
* */
WK_LISTEN("onTaskRun",function( event ){
    tasks = event.tasks;
    for(let i = 0,n = tasks.length; i < n; i++){
        let task = tasks[ i ];
        let engName = task.engine;
        let engConf = task;
        let engine = createEngine( engName,engConf );
        engine.start();//引擎启动
    }
});
/*
* 分发主线程事件
* 根据事件名称，调用事件处理
* */
process.on("message",function( e ){
    if( typeof( e ) === "object" ){
        WK_TRIGGER( e );
    }
});
/*
* 创建引擎
* */
function createEngine( engName,engConf ){
    let engine = require( "./engine/"+engName+".js" );
    return new engine.tpl( engConf );
}