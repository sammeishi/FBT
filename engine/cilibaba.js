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
    LPUrl: "http://www.cilisoba.net/search/%key%/?c=&s=create_time&p=%page%",
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
    * 读取一个种子，cilibaba不在info页输出磁力，通过接口
    * */
    readOne( BT ){
        let url = BT.infoUrl;
        let APIUrl = this.conf.BTJsonApi.replace("%ID%", url.split("/").pop());
        let retry = this.readRetry || 1;
        return new Promise((resolve, reject)=>{
            //将读取封装到函数内，用于错误重试
            let loop = ( cb )=>{
                spHttp.get( APIUrl,this.spName )
                    .then( function( body ){
                        let res = JSON.parse( body );
                        if( res && typeof(res) === "object" && res.result && res.result.length ){
                            BT.title = res.result[0].name;
                            BT.date = res.result[0].last_seen;
                            BT.size = pretty(res.result[0].length);
                            BT.magnet = "magnet:?xt=urn:btih:"+res.result[0].info_hash;
                        }
                        cb( true );
                    })
                    .catch(function( err ){
                        //发生错误，已达到错误重试次数，返回失败
                        if( retry <= 0 ){
                            return cb( false, err );
                        }
                        //发生错误，未达到重试次数，继续重试
                        else{
                            retry--;
                            return loop( cb );
                        }
                    });
            };
            return loop(function( s,err ){
                s ? resolve( BT ) : reject( err );
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