/*
* BT抓取引擎： 搜索
* 以搜索关键字为入口，得到列表页，列表页内每一项都是种子，通过翻页按钮下一页
* 运行流程：入口页（呈现出列表），抓取每一项，提取内容，继续下一页
* 需要传入：
* 关键词
* 列表项查询表达式
* 翻页表达式
* 内容提取表达式
* 最大抓取页数
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
    entryUrl: null, //入口URL
    socketProxy: false, //socket代理
    urlInterval: 0, //每个URL完成后的间隔，单位毫秒
    startInterval: 1000 * 60 * 60 * 1, //更新间隔,单位毫秒 ，默认1小时更新1次
    page: 20, //最大抓取页数
    query:{ //查询器，jquery筛选器
        nextUrl: null, //下一页url，筛选出来的必须是URL
        itemUrl: null, //每一页的URL，在list页面中
        title: null, //磁力的标题
        magnet: null, //磁力url
        fileSize: null, //文件大小，如果有的话
        createTime: null, //创建时间
    }
};
/*
* ================
* 核心逻辑结构
* 获取当前列表页-》提取项-》获取每一项种子-》继续下一页
* ===============
* */
let CORE_ACTION = {
    //入口，获取入口URL当作第一个list
    entry:function(){
        this.loop();
    },
    //循环提取列表页中的每一个BT
    loop:function(){
        this.nextListPage(function( listPageHTML ){
            let $ = cheerio.load( listPageHTML );
            $("table td.x-item a").each(function(i,elem){
                console.log( $(this).attr("title"),$(this).attr("href") );
            });
        });
    },
    /*
    * 获取下一个列表页
    * 如果当前page=0，则使用入口页面
    * */
    nextListPage:function( cb ){
        //到达最大页数
        if( this.currPage >= this.engConf.page ){
            return cb( true );
        }
        //抓取下一页html
        let url = this.getNextListPageUrl();
        spHttp.get(url,this.spName)
            .then((function( body ){
                this.context.listPageHTML = body;
                return cb( body );
            }).bind(this))
            .catch(function( err ){
                console.log('err:',err);
            });
    },
    /*
    * 从当前列表HTML中提取下一页按钮
    * */
    getNextListPageUrl:function(){
        if( this.currPage === 0 ){
            return this.engConf.entryUrl;
        }
        else{

        }
    }
};
/*
* 引擎构造模板
* 会被new一个实例。一个运行的引擎将数据保存在实例内。
* 其他功能调用原型
* */
let tpl = function( ec ){
    //引擎配置文件
    this.engConf = extend( true,{},_engConf,ec );
    this.spName = this.engConf.socketProxy;
    //抓取上下文
    this.context = {};
    this.currPage = 0; //当前页数
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