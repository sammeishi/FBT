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
    LPUrl: "http://www.juzisousuo.com/word/%key%_%page%.html",
    socketProxy: null,
    encodeURI: true
};
/*
* 提取磁力地址
* 传入种子所在的DIV
* */
function getMagnet( infoUrl ) {
    let as = infoUrl.split('/');
    let a = as.pop();
    let res = a.split('.html');
    return "magnet:?xt=urn:btih:"+res[0];
}
function convertTime( str ){
    let day = 1 * 60 * 60 * 24;
    let passTime = null; //已过去时间
    if( str.indexOf( "今天" ) !== -1 ){
        passTime = 0; //今天，让passTime有值，不然会当成无效时间return 1970
    }
    if( str.indexOf( "昨天" ) !== -1 ){
        passTime = day; //24小时前的秒数
    }
    if( str.indexOf( "前天" ) !== -1 ){
        passTime = day * 2; //2天前的秒数
    }
    if( str.indexOf("天前") !== -1 ){
        let num = parseInt( str.split("天前").join("") );
        passTime = day * num;
    }
    return dateFormat( new Date(passTime !== null ? ( (new Date()).getTime() ) - (passTime * 1000 )  : 1),"yyyy-mm-dd HH:MM");
}
function getInfo( infoTxt ){
    let res = infoTxt.split(" ");
    let date = null,size = null;
    for(let i in res){
        if( res[i].indexOf("大小") !== -1 ){
            let t = res[i].split("大小");
            size = t.join("");
        }
        if( res[i].indexOf("创建日期") !== -1 ){
            let t = res[i].split("创建日期");
            date = t.join("");
        }
    }
    return {
        date: convertTime(date),
        size: size
    };
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
                    let $BTEle = $('#container li');
                    //通知监视器
                    this.monitorNode.set('currPage_BTCount',$BTEle.length);
                    that.monitorNode.set('currPage_infoUrlCount',$BTEle.length);
                    //挨个抓取
                    $BTEle.each(function(){
                        let $item = $(this); //A标签，整个BT内容被包裹其中
                        let infoUrl = that.toAbsoluteUrl( that.currCrawlUrl, $item.find(".T1 a").eq(0).attr('href') );
                        let info = getInfo( that.formatStr($item.find(".BotInfo .ctime").text()) );
                        BTs.push( that.createBT({
                            task: that.task,
                            magnet: getMagnet(infoUrl),
                            title: that.formatStr( $item.find(".T1 a").eq(0).text() ),
                            size: info.size,
                            date: info.date,
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