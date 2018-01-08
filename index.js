/*
* 程序入口
* 根据配置文件判断任务数量，结合CPU数量，开始多个线程执行task.js
* */
let gconf = require("./config.js");
let cluster = require('cluster');
let web = require('./web');
let storage = require("./util/storage.js");
let CPU_NUM = require('os').cpus().length;
let workers = [];


/*
* 主线程
* 解析出配置文件，确定任务配置正确
* 根据CPU数量创建线程
* 将任务分配个各个线程
* 开启监控
* */
function master(){
    //初始化存储器
    storage.init(function ( s ,error) {
        return !s ? console.log('storage init error!',error)  :  start();
    });
}
/*
* 启动线程，将任务分配给每个线程
* */
function start(){
    //启动web服务
    web.run();
    //创建线程
    let allTask = gconf.tasks || [];
    let workerSize = allTask.length <= CPU_NUM ? allTask.length : CPU_NUM;
    let workerTaskSize = Math.floor( allTask.length / workerSize );
    console.log("worker size:",workerSize);
    console.log("worker task:",workerTaskSize);
    for(let n = workerSize; n ; n--){
        workers.push(cluster.fork());
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
        worker.send({
            "name": "onTaskRun",
            "tasks":wkTasks
        });
    }
}
/*
* 初始化多线程
* */
cluster.isMaster ? master() : require("./task.js");