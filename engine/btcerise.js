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
    LPUrl: "http://www.btcerise.info/search?keyword=%key%&p=%page%",
    socketProxy: "local",
    encodeURI: true
};
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
                    let $BTEle = $('#content .r:not([style])');
                    //通知监视器
                    this.monitorNode.set('currPage_BTCount',$BTEle.length);
                    that.monitorNode.set('currPage_infoUrlCount',$BTEle.length);
                    //挨个抓取
                    $BTEle.each(function(){
                        let $item = $(this); //A标签，整个BT内容被包裹其中
                        let infoUrl = that.toAbsoluteUrl( that.currCrawlUrl, $item.find("a.link").attr('href') );
                        BTs.push( that.createBT({
                            task: that.task,
                            magnet: $item.find("a:nth-child(1)").eq(0).attr('href'),
                            title: that.formatStr($item.find('h5').eq(0).text()),
                            size: that.formatStr($item.find('span .prop_val').eq(1).text()),
                            date: that.formatStr($item.find('span .prop_val').eq(0).text()),
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