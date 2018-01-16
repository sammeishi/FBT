/*
* 引擎模板： 列表页循环引擎
* 语义说明：
* LP = list page BT的列表页，含有BT列表，以及翻页按钮
* 核心抓取(Crawl:)分为3个阶段：
* 1： 准备页(prepare),准备列表页，可能是列表页的DOM，也可能是源代码
* 2： 查询(query), 根据查询规则，去查询列表页。结果必须是 BT列表： [ BT ]
* 3： 读取(ready), 遍历BT列表，读取infoUrl读取每一个信息
* */
const extend = require('extend');
const nodeUrl = require('url');
const _ = require("underscore");
const storage = require("./../../util/storage.js");
const spHttp = require("./../../util/spHttp.js");
const monitor = require("./../../util/monitor.js");
const Promise = require('promise');
const cheerio = require('cheerio');
/*
* 引擎默认配置文件
* */
let _conf = {
    LPUrl: null, //列表页URL模板 %PAGE% = 页数
    encodeURI: false, //开启URL编码
    socketProxy: false, //socket代理
    urlInterval: 50, //每个URL完成后的间隔，单位毫秒
    urlTimeout: 60 * 1000, //URL超时
    sleepTime: 1000 * 60 * 60 * 1, //休眠时间，默认睡眠1小时
    readRetry: 3, //读取一个种子重试次数
    page: 20, //最大抓取页数
    queryRules:{
        infoUrl: null,
        testInfoUrl: null,
        title: null,
        magnet: null,
        date: null,
        size: null,
    },
};
/*
* BT基础结构 与数据库一致且超集
* */
let BT_STRUCT = storage.BT_STRUCT,
    createBT = function( i ){
        return extend( {},BT_STRUCT,i || {} );
    };
/*
* 获取document的DOM，用于筛选器的查询
* */
function GET_DOC_DOM( html ){
    return cheerio.load( html );
}
/*
* 转化为绝对URL
* */
function toAbsoluteUrl( refer,url ){
    return (new nodeUrl.URL( url, refer )).href;
}
/*
* 格式化字符串去除特殊符号
* */
function formatStr( str ){
    str = str.replace(/<\/?[^>]*>/g,''); //去除HTML tag
    str = str.replace(/[ | ]*\n/g,'\n'); //去除行尾空白
    str = str.replace(/\n[\s| | ]*\r/g,'\n'); //去除多余空行
    str = str.replace(/ /ig,'');//去掉
    str = str.replace(/^[\s　]+|[\s　]+$/g, "");//去掉全角半角空格
    str = str.replace(/[\r\n]/g,"");//去掉回车换行
    return str;
}
/*
* 模板基类，里面的函数均可覆盖以二次定制
* */
class LIST_LOOP_TPL {
    constructor( ec ){
        this.conf = extend( {},_conf,ec );//合并配置文件
        this.monitorNode = null;
        this.task = this.conf.id; //task名称
        this.spName = this.conf.socketProxy; //socket代理名
        this.queryRules = this.conf.queryRules; //查询规则
        this.page = this.conf.page; //抓取总页数
        this.currPage = 0; //当前页数
        this.logger = null;
        this.monitorNode = null;
        this.currCrawlUrl = null; //当前抓取的url
    }
    /*
    * 开始下一页
    * */
    next(){
        if( this.currPage >= this.page  ){
            //监视器，设置状态为休眠
            this.monitorNode.set("status",2);
            //完成一轮抓取，休眠后继续下一轮
            this.logger.debug('Round Done,Sleep',this.conf.sleepTime / 1000 + "s" );
            return setTimeout(this.wakeUp.bind(this),this.conf.sleepTime);
        }
        else{
            this.monitorNode.set("status",1);
            this.monitorNode.set("currPage_crawlIndex",0);
            this.currPage++;
        }
        //创建当前抓取页的URL
        let url = this.getCrawlUrl();
        //监视器
        this.monitorNode.set("currPage", this.currPage );
        this.monitorNode.set("currPage_url", url );
        //保存当前列表页，以为之后用
        this.currCrawlUrl = url;
        //开始抓取
        this.logger.debug("TAKE PAGE",this.currPage );
        this.crawl( url ).then(()=>{
            this.logger.debug("TAKE PAGE",this.currPage,"DONE");
            this.monitorNode.add('crawledPage',1);
            this.monitorNode.addGlobal('crawledPage',1);
            this.next();
        }).catch(( err )=>{
            //发生错误，记录错误并继续
            this.monitorNode.add('crawledPage',1);
            this.monitorNode.addGlobal('crawledPage',1);
            this.logger.error( `crawl ${ this.currCrawlUrl } error:`, err );
            this.next();
        });
    }
    /*
    * 唤醒，继续下一轮
    * */
    wakeUp(){
        this.currPage = 0;
        this.currCrawlUrl = null;
        this.monitorNode.set("currPage_infoUrlCount",0);
        this.monitorNode.set("currPage_BTCount",0);
        this.monitorNode.set("currPage_crawlIndex",0);
        this.monitorNode.set("currPage_crawlSuccessCount",0);
        this.monitorNode.set("currPage_crawlErrCount",0);
        this.monitorNode.set("currPage_saveCount",0);
        this.next();
    }
    /*
    * 获取当前要抓取的列表页URL
    * */
    getCrawlUrl(){
        let url = this.conf.LPUrl.replace("%page%", this.currPage );
        //开启URL编码
        if( this.conf.encodeURI ){
            url = encodeURI( url );
        }
        return url;
    }
    /*
    * 抓取一页
    * */
    crawl( url ){
        this.logger.debug("crawl",url);
        return new Promise(( resolve, reject )=>{
            //准备页,生成html以及DOM
            this.prepare( url )
                //查询全部BT，得到BT列表，只含有infoUrl
                .then(( $ )=>{
                    return this.query( $ );
                })
                //读取全部BT信息
                .then(( BTs )=>{
                    return this.read( BTs );
                })
                //存储至库
                .then(( BTs )=>{
                    return this.save( BTs );
                })
                //完成抓取
                .then(( BTs )=>{
                    resolve();
                })
                //出错了呢~
                .catch(function( err ){
                    reject( err );
                });
        });
    }
    /*
    * 各种查询器，用于匹配目标DOM
    * 通过DOM提取出信息
    * */
    //在列表页中查询所有infourl,如果继承类不覆盖则使用css查询器查询出A标签
    queryAllInfoUrl( $ ){
        let urls = [];
        let that = this;
        let existUrl = {};
        return new Promise((resolve, reject) => {
            $( this.queryRules.infoUrl ).each(function() {
                let infoUrl = toAbsoluteUrl( that.currCrawlUrl, $(this).attr('href') );
                if( that.testInfoUrl( infoUrl ) && typeof(existUrl[ infoUrl ]) === "undefined" ){
                    urls.push( infoUrl );
                    existUrl[ infoUrl ] = true;
                }
            });
            that.monitorNode.set('currPage_infoUrlCount',urls.length);
            resolve( urls );
        });
    }
    //测试BT的详情url是否正确
    testInfoUrl( url ){
        let rule = this.queryRules.testInfoUrl;
        if( rule ){
            return new RegExp( rule ).test( url );
        }
        else{
            return true;
        }
    }
    /*
    * 准备阶段：获取并生成列表页DOM
    * */
    prepare( url ){
        return new Promise(( resolve, reject ) => {
            spHttp.get(url,this.spName).then(function( body ){
                return resolve( GET_DOC_DOM(body) );
            }).catch(function( err ){
                return reject( err );
            });
        });
    }
    /*
    * 查询阶段：查询列表页中所有BT. 只含有infoUrl字段
    * 构建出BTs数组
    * */
    query( $ ){
        return new Promise(( resolve, reject ) => {
            //查询所有infourl
            this.queryAllInfoUrl( $ )
                //过滤已经入库的infoUrl
                .then(( infoUrls )=>{
                    return new Promise(( r2, j2 )=>{
                        storage.filterByInfoUrl( infoUrls )
                            //比对去除无效的BT，根据infoUrl
                            .then(( correctInfoUrls )=>{
                                r2( _.filter( infoUrls,function( url ){
                                    return _.indexOf( correctInfoUrls,url ) !== -1;
                                }) );
                            })
                            .catch(( err )=>{
                                //忽略错误
                                r2( infoUrls );
                            })
                    });
                })
                //构建出BTs
                .then(( infoUrls )=>{
                    let BTs = [];
                    _.each( infoUrls,( url ) => {
                        BTs.push( createBT({
                            task: this.task,
                            infoUrl: url
                        }) );
                    } );
                    this.monitorNode.set('currPage_BTCount',BTs.length);
                    return resolve( BTs );
                })
                //查询出错
                .catch(( err )=>{
                    reject( err );
                });
        });
    }
    /*
    * 读取阶段：根据infoUrl读取每一个BT
    * 调用 getBT  可以被覆盖\
    * getBT基类默认实现通过css筛选器获取各个BT信息
    * */
    read( BTs ){
        let index = 0;
        let urlInterval = this.conf.urlInterval;
        //循环获取BT
        let NEXT_BT = ( cb )=>{
            let callAgain = ()=> { index++; setTimeout( NEXT_BT.bind(this,cb),urlInterval );};
            if( index >= BTs.length ){
                return cb();
            }
            this.readOne( BTs[ index ] ).then(()=>{
                this.monitorNode.add('currPage_crawlIndex',1);
                this.monitorNode.add('currPage_crawlSuccessCount',1);
                this.monitorNode.addGlobal('crawlSuccessCount',1);
                //读取成功，睡眠后继续
                return callAgain();
            }).catch(( err )=>{
                //读取失败，保存错误，继续下一个
                this.monitorNode.add('currPage_crawlIndex',1);
                this.monitorNode.add('currPage_crawlErrCount',1);
                this.monitorNode.addGlobal('crawlErrCount',1);
                return callAgain();
            });
        };
        return new Promise((resolve, reject)=>{
            NEXT_BT(function(){
                resolve( BTs );
            });
        });
    }
    /*
    * 读取一个种子信息
    * 失败后重试
    * */
    readOne( BT ){
        let url = BT.infoUrl;
        let retry = this.readRetry || 1;
        let queryRules = this.queryRules;
        return new Promise((resolve, reject)=>{
            let loop = ( BT,cb )=>{
                spHttp.get( url,this.spName )
                    .then( function( body ){
                        let $ = GET_DOC_DOM( body );
                        BT.title = formatStr($( queryRules.title ).first(0).text());
                        BT.date = $( queryRules.date ).first(0).text();
                        BT.magnet = $( queryRules.magnet ).first(0).attr("href");
                        BT.size = $( queryRules.size ).first(0).text();
                        cb( true );
                    })
                    .catch(function( err ){
                        if( (retry--) <= 0 ){
                            return cb( false, err );
                        }
                        else{
                            return loop( BT,cb );
                        }
                    });
            };
            return loop(BT,function( s,err ){
                s ? resolve( BT ) : reject( err );
            });
        });
    }
    /*
    * 存储阶段
    * 去除无效的，磁力地址为空的BT
    * */
    save( BTs ){
        let BTS = this.beforeSave( BTs );
        //去除不含有磁力链接地址的BT
        BTs = _.filter(BTs,function( BT ){
            return _.isString(BT.magnet) && BT.magnet.indexOf("magnet") !== -1;
        });
        return new Promise(( resolve, reject )=>{
            storage.addBT( BTs )
                //完成
                .then(( BTs )=>{
                    if( BTs.length ){
                        this.logger.debug("save BT:",BTs.length);
                        //监视器更新
                        this.monitorNode.set('currPage_saveCount',BTs.length);
                        this.monitorNode.add('saveCount',BTs.length);
                        this.monitorNode.addGlobal('saveCount',BTs.length);
                    }
                    resolve();
                })
                //发生错误
                .catch(( err )=>{
                    console.log( "save error ! ",err );
                    reject( err );
                });
        });
    }
    /*
    * 存储前进行一次过滤
    * */
    beforeSave( BTs ){
        return BTs;
    }
};

/*
* exports
* */
module.exports = LIST_LOOP_TPL;