/*
* http请求
* 主要提供get方式请求，返回源码
* 并且提供ss代理方式
* */
const gconf = require("./../config.js");
const Promise = require('promise');
const request = require('request');
const httpAgent = require('socks5-http-client/lib/Agent');
const httpsAgent = require('socks5-https-client/lib/Agent');
const extend = require('extend');
const randomUseragent = require('random-useragent');
const socketProxy = gconf.socketProxy;
/*
* 默认选项
* */
let defOpt = {
    timeout: 1000 * 60,
    headers: " 'User-Agent': 'Chrome 111111'"
};
/*
* 创建一个HTTP请求器
* */
module.exports = class{
    constructor( options ){
        this.options = extend({},defOpt,options || {});
    }
    /*
    * get请求
    * */
    get( url,spName ){
        let options = extend( {},this.options,{ url: url } );
        //加入socket代理
        if( spName ){
            let sp = socketProxy[ spName ];
            let isHttps = url.substr(0,8).toLocaleLowerCase() === "https://";
            options = extend({},options,{
                agentClass: isHttps ? httpsAgent : httpAgent,
                agentOptions: {
                    socksHost: sp.ip,
                    socksPort: sp.port
                }
            });
        }
        //返回Promise
        return new Promise(function( resolve, reject ){
            request( options, function(err,res,body) {
                if( res && res.statusCode !== 200 ){
                    return reject(" HTTP STATUS ERROR:  " + res.statusCode);
                }
                err ? reject( err ) : resolve( body );
            });
        });
    }
    /*
    * 创建
    * */
    static factory( opt ){
        return new this( opt );
    }
};