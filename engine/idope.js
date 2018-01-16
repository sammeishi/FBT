const extend = require('extend');
const _ = require("underscore");
const spHttp = require("../util/spHttp.js");
const monitor = require("../util/monitor.js");
const log4js = require('log4js');
const pretty = require('prettysize');
const pinyin = require('pinyin');
const list_loop_tpl = require('./tpl/list.loop.tpl');
/*
* 配置
* */
let conf = {
    BTJsonApi:  "http://www.cilisoba.net/api/json_info?hashes=%ID%",
    LPUrl: "https://idope.se/torrent-list/%key%/?p=%page%&o=-3",
    socketProxy: "local",
    encodeURI: true,
    queryRules:{
        title: ".container h4",
        magnet: "a.magnet-link",
        infoUrl: '.x-item a',
        testInfoUrl: ".*\/h\\/\\d+$",
        size: ".container table tr:nth-child(3) td",
        date: ".container table tr:nth-child(1) td",
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
        let py = pinyin( this.conf.key ,{ style: pinyin.STYLE_FIRST_LETTER });
        let keyFirstLetter = _.map(py, _.first).join("");
        if( !keyFirstLetter ){
            keyFirstLetter = parseInt(Math.random()*10000000,10)+1;
        }
        this.conf.id = this.task = this.conf.engine + "-" + keyFirstLetter;
        //生成LPUrl，根据关键词
        this.conf.LPUrl = this.conf.LPUrl.replace("%key%",this.conf.key);
        //创建logger
        this.logger = log4js.getLogger( this.task );
        this.logger.level = 'error';
        //创建监视器
        this.monitorNode = new monitor.node( this.task );
    }
    /*
    * 引擎启动
    * */
    start(){
        this.next();
    }
};