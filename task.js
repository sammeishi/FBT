/*
* 任务执行脚本
* 运行在独立线程内，加载任务引擎并运行，可能在一个线程内会运行多个任务
* */
/*
* 分发主线程事件
* 根据事件名称，调用事件处理
* */
process.on("message",function( event ){
    if( typeof( event ) === "object" ){
        if( event.eventName === "onTaskRun" ){
            let tasks = event.tasks;
            for(let i = 0,n = tasks.length; i < n; i++){
                let task = tasks[ i ];
                let engName = task.engine;
                let engConf = task;
                let engine = createEngine( engName,engConf );
                engine.start();//引擎启动
            }
        }
    }
});
/*
* 创建引擎
* */
function createEngine( engName,engConf ){
    let e = require( "./engine/"+engName );
    return new e( engConf );
}