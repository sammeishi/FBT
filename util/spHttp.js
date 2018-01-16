/*
* http请求
* 主要提供get方式请求，返回源码
* 并且提供ss代理方式
* */
let gconf = require("./../config.js");
let Promise = require('promise');
let request = require('request');
let httpAgent = require('socks5-http-client/lib/Agent');
let httpsAgent = require('socks5-https-client/lib/Agent');
let extend = require('extend');
let randomUseragent = require('random-useragent');
let E = {};
let socketProxy = gconf.socketProxy;
/*
* 普通的get方式请求
* */
E.get = function get( url,spName ){
    let options = {
        url: url,
        timeout: 1000 * 60,
        headers: " 'User-Agent': 'Mobile 111111'"
    };
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
            err ? reject( err ) : resolve( body );
        });
    });
};
//////////////////
module.exports = E;