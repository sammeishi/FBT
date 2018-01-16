/*
* 引擎监控
* 负责收集运行信息
* 通过进程间通信传递给主进程
* */
const _ = require('underscore');
const cluster = require('cluster');
const extend = require('extend');
const nodeChangeEvent = "monitor_node_change";
const addGlobalEvent = "monitor_global_add";
const setGlobalEvent = "monitor_global_set";
/*
* 监控指标
* */
let targetsTpl = {
    //全局的
    saveCount: 0,//当前任务总共保存的数量
    crawledPage: 0, //当前任务已经采集过的页数
    status: 1, //当前状态 0关闭 1运行 2休眠
    //当前页有关
    currPage: 0, //当前采集页数
    currPage_url: 0, //当前采集页URL
    currPage_infoUrlCount: 0,//查询到的infoUrl数量
    currPage_BTCount: 0,//当前页存在的BT数量
    currPage_crawlIndex: 0,//在当前页抓取第几个BT
    currPage_crawlErrCount: 0,//抓取失败数量
    currPage_crawlSuccessCount: 0,//抓取失败数量
    currPage_saveCount: 0,//当前页抓取并成功存储的数量
};
/*
* 全局指标
* */
let globalTargets = exports.globalTargets = {
    startTime: null,
    workerSize: 0, //woker数量
    workerTaskSize: 0, //每个worker的任务数量
    saveCount: 0,//总共存储数量
    crawledPage: 0,//总共抓取的页数
    crawlErrCount: 0,//总共抓取BT失败的次数
    crawlSuccessCount: 0,//总共抓取BT失败的次数
};

/*
* 线程监控器,用于设置指标并发送给主监视器
* */
exports.node = class{
    constructor( name ){
        this.name = name;
        this.targets = extend({},targetsTpl);
        this.push();
    }
    /*
    * 指标步进增加
    * */
    add( targetName,val ){
        let targets =  this.targets;
        if( typeof( targets[ targetName ] ) === "undefined" ){
            targets[ targetName ] = 0;
        }
        targets[ targetName ] = this.targets[ targetName ] + val;
        return this.push();
    }
    /*
    * 重新设置一个指标
    * */
    set( targetName,newVal ){
        let targets =  this.targets;
        if( typeof( targets[ targetName ] ) === "undefined" ){
            targets[ targetName ] = null;
        }
        targets[ targetName ] = newVal;
        return this.push();
    }
    /*
    * 设置全局
    * */
    addGlobal( t,v ){
        process.send({
            eventName: addGlobalEvent,
            targetName: t,
            val: v,
        })
    }
    setGlobal( t,v ){
        process.send({
            eventName: setGlobalEvent,
            targetName: t,
            val: v,
        })
    }
    /*
    * 将当前的监控信息推送给主线程
    * */
    push(){
        process.send({
            eventName: nodeChangeEvent,
            node: {
                name: this.name,
                targets: this.targets
            }
        });
    }
};
/*
* 主线程内显示监视指标
* */
exports.master = class{
    constructor( workers ){
        if( !cluster.isMaster ){
            console.error("Monitor must run master!");
        }
        else{
            this.workers = workers;
            this.nodeList = [];
            this.listen();
        }
    }
    /*
    * 获取所有监视内宽
    * */
    get(){
        return {
            global: globalTargets,
            nodeList: this.nodeList
        };
    }
    /*
    * 开启监听worker发送过来的变更事件
    * */
    listen(){
        _.each(this.workers,( worker )=>{
            worker.on('message', ( event ) => {
                if( event.eventName === nodeChangeEvent ){
                    let name = event.node.name;
                    let isExist = false;
                    for(let i in this.nodeList){
                        if( this.nodeList[i].name === name ){
                            this.nodeList[i] = event.node;
                            isExist = true;
                            break;
                        }
                    }
                    if( !isExist ){
                        this.nodeList.push( event.node );
                    }
                }
                else if( event.eventName === addGlobalEvent || event.eventName === setGlobalEvent ){
                    let isSet = event.eventName === setGlobalEvent;
                    let targets =  globalTargets;
                    let targetName = event.targetName;
                    let val = event.val;
                    if( typeof( targets[ targetName ] ) === "undefined" ){
                        targets[ targetName ] = null;
                    }
                    targets[ targetName ] = isSet ? val :  targets[ targetName ] + val;
                }
            });
        })
    }
};


