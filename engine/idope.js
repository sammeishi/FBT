/*
* idope会被误认为是手机版，输出的是手机版的HTML
* 如果user agent模拟chrome会报错
* */
const extend = require('extend');
const _ = require("underscore");
const monitor = require("../util/monitor.js");
const createTaskId = require('../util/createTaskId');
const dateFormat = require('dateformat');
const list_loop_tpl = require('./tpl/list.loop.tpl');
const userAgent = " 'User-Agent': 'Mozilla/5.0 Chrome 1899'";
/*
* 配置
* */
let conf = {
    LPUrl: "https://idope.se/torrent-list/%key%/?p=%page%&o=-3",
    socketProxy: "local",
    encodeURI: true
};

/*
* 提取磁力地址
* 传入种子所在的DIV
* */
function getMagnet( infoUrl ) {
    let as = infoUrl.split('/');
    if( as[as.length - 1] === "" ){
        as.pop();
    }
    return "magnet:?xt=urn:btih:"+as.pop();
}
/*
* 转换时间
* */
function convertTime( strTime ){
    let minute = 60 * 1 * 1000; //1分钟等于多少毫秒，所有时间都基于毫秒（时间戳）
    let hour = minute * 60;
    let day = hour * 24;
    let month = day * 30;
    let year = month * 12;
    let text2Timestamp = {
        'hours': hour,
        'hour': hour,
        'minutes': minute,
        'minute': minute,
        'months': month,
        'month': month,
        'days': day,
        'day': day,
        'years': year,
        'year': year,
    };
    let time = (new Date()).valueOf();
    let isGet = false;
    strTime = strTime.toLowerCase();
    strTime = strTime.replace(/' '/gi,'');
    for(let key in text2Timestamp){
        if( strTime.toLowerCase().indexOf( key ) !== -1 ){
            let a = strTime.split( text2Timestamp[ key ] );
            if( a.length ){
                let num = parseInt( a[0] );
                time -= text2Timestamp[ key ] * num;
                isGet = true;
                break;
            }
        }
    }
    return dateFormat(isGet ? time : 1,"yyyy-mm-dd HH:MM:ss");
}
/*
* 导出引擎类,基于list.loop模板
* */
module.exports = class extends list_loop_tpl{
    /*
    * 初始化
    * 初始化基类模板
    * 生成任务ID
    * 生成LPUrl
    * */
    constructor( ec ){
        super( extend({},conf,ec) );
        //更改agent
        this.spHttp.options.headers = userAgent;
        //生成任务ID
        this.conf.id = this.task = createTaskId( this.conf );
        //生成LPUrl，根据关键词
        this.conf.LPUrl = this.conf.LPUrl.replace("%key%",this.conf.key);
        //创建logger
        this.initLogger();
        this.logger.level = "error";
        //创建监视器
        this.monitorNode = new monitor.node( this.task );
    }
    /*
    * 改写抓取
    * 所有信息等都在一个页面内
    * */
    crawl( url ){
        return new Promise(( resolve, reject )=>{
            //准备页,生成html以及DOM
            this.prepare( url )
                .then(( $ )=>{
                    let BTs = [];
                    let that = this;
                    //查询所有BT
                    let $BTEle = $('#div2 a');
                    //通知监视器
                    this.monitorNode.set('currPage_BTCount',$BTEle.length);
                    that.monitorNode.set('currPage_infoUrlCount',$BTEle.length);
                    //挨个抓取
                    $BTEle.each(function(){
                        let $item = $(this); //A标签，整个BT内容被包裹其中
                        let infoUrl = that.toAbsoluteUrl( that.currCrawlUrl, $item.attr('href') );
                        BTs.push( that.createBT({
                            task: that.task,
                            magnet: getMagnet( infoUrl ),
                            title: that.formatStr($item.find('.resultdivtopname').text()),
                            size: that.formatStr($item.find('.resultlength').text()),
                            date: convertTime(that.formatStr($item.find('.resulttime').text())),
                            infoUrl: infoUrl
                        }) );
                        //通知监视器
                        that.monitorNode.add('currPage_crawlIndex',1);
                        that.monitorNode.add('currPage_crawlSuccessCount',1);
                        that.monitorNode.addGlobal('crawlSuccessCount',1);
                    });
                    return BTs;
                })
                //存储至库
                .then(( BTs )=>{
                    return this.save( BTs );
                })
                //完成抓取
                .then(( BTs )=>{
                    resolve( BTs );
                })
                //出错了呢~
                .catch(function( err ){
                    reject( err );
                });
        });
    }
    /*
    * 引擎启动
    * */
    start(){
        this.next();
    }
};