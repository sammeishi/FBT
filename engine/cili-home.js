const extend = require('extend');
const _ = require("underscore");
const spHttp = require("../util/spHttp.js").factory();
const monitor = require("../util/monitor.js");
const createTaskId = require('../util/createTaskId');
const log4js = require('log4js');
const pretty = require('prettysize');
const pinyin = require('pinyin');
const list_loop_tpl = require('./tpl/list.loop.tpl');
/*
* 配置
* */
let conf = {
    LPUrl: "https://www.cili-home.com/word/%key%_%page%.html",
    socketProxy: null,
    encodeURI: true,
    queryRules:{
        title: ".T1",
        magnet: ".BotInfo p a[rel='nofollow']",
        infoUrl: '#content .r a',
        testInfoUrl: ".*read\/[0-9a-zA-Z]+\.html$",
        size: ".BotInfo p:nth-child(2)",
        date: ".BotInfo p:nth-child(1)",
    }
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
    * 存储前矫正大小与日期，去除前面的汉字
    * */
    beforeSave( BTs ){
        _.each( BTs,function( BT ){
            //去除date的UTC
            if( BT.date ){
                BT.date = BT.date.toString().replace(/创建日期/gi,"");
                BT.date = BT.date.toString().replace(/:/gi,"");
                BT.date = BT.date.toString().replace(/：/gi,"");
                BT.date = BT.date.toString().replace(/ /gi,"");
            }
            if( BT.size ){
                BT.size = BT.size.toString().replace(/文件大小:/gi,"");
                BT.size = BT.size.toString().replace(/:/gi,"");
                BT.size = BT.size.toString().replace(/：/gi,"");
                BT.size = BT.size.toString().replace(/ /gi,"");
            }
        } );
        return BTs;
    }
    /*
    * 引擎启动
    * */
    start(){
        this.next();
    }
};