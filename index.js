/*
* 程序入口
* 根据配置文件判断任务数量，结合CPU数量，开始多个线程执行task.js
* 线程负责加载任务并运行任务
* */
const gconf = require("./config.js");
const cluster = require('cluster');
const log4js = require('log4js');
const web = require('./web');
const storage = require("./util/storage.js");
const monitor = require("./util/monitor.js");
const dateformat = require('dateformat');
const CPU_NUM = require('os').cpus().length;
let workers = [];
let monitorMaster = null;
let logger = log4js.getLogger("MAIN");
logger.level = 'all';
/*
* 主线程
* 解析出配置文件，确定任务配置正确
* 根据CPU数量创建线程
* 将任务分配个各个线程
* 开启监控
* */
function masterEntry(){
    //初始化存储器
    storage.init(function ( s ,error) {
        return !s ? logger.error('storage init error!',error)  :  masterStart();
    });
}
/*
* 启动线程，将任务分配给每个线程
* */
function masterStart(){
    //创建线程
    let allTask = masterGetAllTask();
    let workerSize = allTask.length <= CPU_NUM ? allTask.length : CPU_NUM; //worker数量,最大不能超过CPU线程数
    let workerTaskSize = Math.round( allTask.length / workerSize ); //每个worker分配任务数量
    //矫正一次wokerSize
    workerSize = Math.ceil( allTask.length / workerTaskSize );
    //输出显示
    logger.debug("worker size:",workerSize);
    logger.debug("worker task:",workerTaskSize);
    for(let n = workerSize; n ; n--){
        let worker = cluster.fork();
        workers.push( worker );
    }
    //启动监视器
    monitorMaster = new monitor.master( workers );
    monitor.globalTargets.allTask = allTask.length;
    monitor.globalTargets.workerSize = workerSize;
    monitor.globalTargets.workerTaskSize = workerTaskSize;
    monitor.globalTargets.startTime = dateformat(new Date(),"yyyy-mm-d HH:MM");
    //启动web服务
    if( gconf.web.open ){
        web.setMonitor( monitorMaster );
        web.run();
    }
    //分配任务并运行
    let curr = 0;
    for(let wi = 0,wn = workers.length; wi < wn; wi++){
        let worker = workers[ wi ];
        let wkTasks = [];
        let size = workerTaskSize;
        if( (wi + 1) >= wn ){
            size = allTask.length - curr;
        }
        for(let i = 0,n = size ; i < n && curr < allTask.length; i++){
            wkTasks.push( allTask[ curr++ ] )
        }
        //输出debug
        logger.debug(`Send Task To Worker${worker.id}, SIZE:${wkTasks.length}`);
        //向指定子进程发送任务
        worker.send( {
            eventName: "onTaskRun",
            tasks: wkTasks
        } );
    }
}
/*
* 获取所有任务
* 如果一个引擎支持复式创建，则调用静态函数获取最终任务配置数组
* */
function masterGetAllTask(){
    let allTask = [];
    let engineList = {};
    let gconfTask = gconf.tasks || [];
    for(let i = 0,n = gconfTask.length; i < n; i++){
        let task = gconfTask[i];
        let name = task.engine;
        if( !engineList[ name ] ){
            engineList[ name ] = require( "./engine/"+name );
        }
        //是否支持复式创建,如果支持交由处理
        if( engineList[ name ].mulitCreate ){
            let newTasks = engineList[ name ].mulitCreate( gconfTask[i] );
            for(let nt in newTasks){
                allTask.push( newTasks[nt] );
            }
        }
        else{
            allTask.push( task );
        }
    }
    return allTask;
}
/*
* 初始化多线程
* */
cluster.isMaster ? masterEntry() : require("./task.js");