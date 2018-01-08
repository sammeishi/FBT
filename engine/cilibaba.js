/*
* BT抓取引擎： cilibaba
* */
let extend = require('extend');
let storage = require("./../util/storage.js");
let spHttp = require("../util/spHttp.js");
let Promise = require('promise');
let cheerio = require('cheerio');
/*
* 引擎默认配置文件
* */
let _engConf = {
    baseUrl: "http://www.cilisoba.net/",
    pageUrl: "search/%key%/?c=&s=create_time&p=%page%",
    BTJsonApi:  "/api/json_info?hashes=%ID%",
    spName: "local", //socket代理
    urlInterval: 2, //每个URL完成后的间隔，单位毫秒
    startInterval: 60 * 60 * 1, //更新间隔,单位秒 ，默认1小时更新1次
    countPage: 0,//总共抓取页数
    page: 50 //最大抓取页数
};
/*
* ================
* 核心逻辑结构
* 获取列表页-》提取每个BT的站点ID-》私有接口获取BT全部信息 ->继续下一页
* ===============
* */
let CORE_ACTION = {
    //入口,
    entry:function(){
        let that = this;
        this.countPage = 0;
        this.currPage = 1;
        this.loop(function(){
            let startInterval = that.engConf.startInterval;
            //循环抓取结束，睡眠，等待下一次
            console.log( '['+ that.task +'] sleep ', startInterval + "s");
            setTimeout(that.entry.bind(that),startInterval * 1000);
        });
    },
    //循环提取列表页中的每一个BT
    //转换为DOM，提取每一个BT的ID，根据ID接口获取BT信息
    loop:function( cb ){
        //到达最大页数,开启定时器
        if( this.countPage >= this.engConf.page ){
            cb ? cb() : null;
            return true;
        }
        console.log('['+ this.task +'] GET PAGE '+ this.currPage);
        //开始循环
        this.nextPage((function( s,err ){
            err ? console.log('GET PAGE END, HAD ERR: ',err) : null;
            console.log('['+this.task+'] GET PAGE END: '+ this.currPage);
            this.currPage++;
            this.countPage++;
            this.loop( cb );
        }).bind(this));
    },
    /*
    * 抓取一页。
    * 每次执行会自动向下移动一页，直到最大页数
    * */
    nextPage:function( cb ){
        let that = this;
        this.getCurrPageHTML()
            //提取ID
            .then(function( listPageHTML ){
                return new Promise(function(resolve, reject){
                    let $ = cheerio.load( listPageHTML );
                    let ids = [];
                    $("table td.x-item a").each(function(){
                        ids.push( $(this).attr("href").split("/").pop() );
                    });
                    resolve( ids );
                });
            })
            //筛选ID:去除无效的ID
            .then(function( ids ){
                let newIds = [];
                return new Promise(function(resolve, reject){
                    for(let i = 0,n = ids.length; i < n; i++){
                        let id = ids[ i ];
                        /^[\d]+$/.test(id) ? newIds.push( id ): null;
                    }
                    resolve( newIds );
                });
            })
            //筛选ID,如果已经在数据库中存在则去除
            .then( function( ids ){
                return storage.filterBySource( ids );
            } )
            //查询每一个种子信息
            .then(function( ids ){
                return new Promise(function( resolve, reject ){
                    if( ids.length === 0 ){
                        return resolve( [] );
                    }
                    let idIndex = 0;
                    let BTs = [];
                    let round = function(){
                        if( ( idIndex + 1 ) >= ids.length ){
                            return resolve( BTs );
                        }
                        else{
                            idIndex++;
                        }
                        //查询种子，查到后加入到数组，继续下一个处理
                        that.getBTInfo( ids[ idIndex ] ).then(function( BTInfo ){
                            BTInfo ? BTs.push( BTInfo ) : null;
                            //下一轮，定时器，防止网站检查
                            next( true );
                        }).catch(function( err ){
                            //如果查询失败，则忽略错误，继续下一个
                            next( true );
                        });
                    };
                    let next = function( timer ){
                        timer ? setTimeout(round,that.engConf.urlInterval * 1000) : round();
                    };
                    next();
                });
            })
            //存储到数据库
            .then(function( BTs ){
                return new Promise(function( resolve, reject ){
                    if( BTs.length === 0 ){
                        return resolve();
                    }
                    storage.addBT( BTs,function( s,err ){
                        console.log('save bt to storage: ', s ? BTs.length : 0);
                        s ? resolve() : reject( err );
                    } );
                });
            })
            //执行完成
            .then(function(){
                cb( true );
            })
            //出错
            .catch(function(err){
                console.log( "err=>",err );
                cb( false,err );
            });
    },
    /*
    * 获取当前列表页的HTML
    * 如果当前page=0，则使用入口页面
    * 排队模式,当前处理完成才能继续下一个
    * @return Promise
    * */
    getCurrPageHTML:function(){
        let url = this.getNextListPageUrl();
        return spHttp.get(url,this.engConf.spName);
    },
    /*
    * 从当前列表HTML中提取下一页按钮
    * 如果当前page=0，则使用搜索页
    * */
    getNextListPageUrl:function(){
        let url = this.engConf.baseUrl + this.engConf.pageUrl.replace("%key%", this.engConf.key);
        url = url.replace( "%page%", this.currPage );
        return encodeURI(url);
    },
    /*
    * 获取一个BT信息
    * */
    getBTInfo:function( id ){
        let url = encodeURI( this.engConf.baseUrl + this.engConf.BTJsonApi.replace("%ID%", id));
        let that = this;
        return new Promise(function( resolve, reject ){
            spHttp.get(url,that.engConf.spName)
                .then(function( body ){
                    let res = JSON.parse( body );
                    let BTInfo = null;
                    if( res && typeof(res) === "object" && res.result && res.result.length ){
                        BTInfo = {
                            task: that.engConf.id,
                            source: id,
                            title: res.result[0].name,
                            magnet: "magnet:?xt=urn:btih:"+res.result[0].info_hash,
                        };
                    }
                    resolve( BTInfo );
                })
                .catch(function( err ){
                    reject( err );
                });
        });
    }
};
/*
* 引擎构造模板
* 会被new一个实例。一个运行的引擎将数据保存在实例内。
* 其他功能调用原型
* */
let tpl = function( ec ){
    this.task = ec.id;
    //引擎配置文件
    this.engConf = extend( true,{},_engConf,ec );
    //抓取上下文
    this.currPage = 1; //当前页数
    this.countPage = 0;
    /*启动引擎,由任务管理调用*/
    this.start = function(){
        this.entry();
    }
};
tpl.prototype = CORE_ACTION;
tpl.prototype.constructor = tpl;
/*
* 导出构造模板
* */
exports.tpl = tpl;