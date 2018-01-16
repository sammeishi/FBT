const extend = require('extend');
const _ = require("underscore");
const log4js = require('log4js');
const monitor = require("../util/monitor.js");
const list_loop_tpl = require('./tpl/list.loop.tpl');
const pinyin = require('pinyin');
/*
* 配置
* */
let conf = {
    LPUrl: "https://sukebei.nyaa.si/?f=0&c=0_0&q=%key%&s=id&o=desc&p=%page%",
    socketProxy: "local",
    encodeURI: true,
    page: 50,
    queryRules:{
        title: ".panel:first-child .panel-title",
        magnet: "a.card-footer-item[href]",
        infoUrl: 'a[title][href]',
        testInfoUrl: ".*\/view\\/\\d+$",
        size: ".panel-body .row:nth-child(4) .col-md-5",
        date: "div[data-timestamp]",
    }
};

/*
* 导出引擎类,基于list.loop模板
* */
module.exports = class extends list_loop_tpl{
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
        let key = this.conf.key;
        if( _.isArray(key) ){
            key = key.join("+");
        }
        this.conf.LPUrl = this.conf.LPUrl.replace("%key%",key);
        //创建logger
        this.logger = log4js.getLogger( this.task );
        this.logger.level = 'error';
        //创建监视器
        this.monitorNode = new monitor.node( this.task );
    }
    /*
    * 存储前过滤种子
    * */
    beforeSave( BTS ){
        return _.map( BTS,function( BT ){
            //去除date的UTC
            if( BT.date ){
                BT.date = BT.date.toString().replace(/ UTC/gi,"");
            }
        } );
    }
    /*
    * 引擎启动
    * */
    start(){
        this.next();
    }
};