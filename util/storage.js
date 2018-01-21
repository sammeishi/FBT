/*
* 存储BT结果，基于sqli3数据库，会被多线程使用
* 1: 保证数据库以及所有表存在
* 2：提供结果存储-查询接口
* */
const gconf = require("../config.js");
const _ = require('underscore');
const Promise = require('promise');
const dateFormat = require('dateformat');
const sqlite3 = require("sqlite3");
const log4js = require('log4js');
const logger = log4js.getLogger("storage");
let E = {};
logger.level = 'all';
/*
* 打开数据库
* Promise方式
* */
function open(){
    return  new Promise(function(resolve, reject){
        let db = new sqlite3.Database(gconf.db.res.path, function(error){
            if( error !== null ){
                reject( error );
            }
            else{
                resolve( db );
            }
        })
    })
}
/*
* inArray
* */
function inArray( a,f ){
    for(let i = 0,n = a.length; i < n; i++){
        if( a[i] === f ){
            return true;
        }
    }
    return false;
}
/*
* 初始化
* 数据库文件不存在则创建
* 读取任务列表，为每一个任务分配一个表
* */
E.init = function init( cb ){
    //尝试打开sqlite，如果不存会创建
    open()
    //检查表是否存在
    .then(function( db ){
        return new Promise(function(resolve, reject){
            let sql = "select count(*) as count from sqlite_master where type='table' and name = 'all' limit 1";
            db.get(sql,[],function( err,row ){
                if( err ){
                    reject( err );
                }
                else{
                    let isTableExist =  typeof(row['count']) !== "undefined" ? (row.count > 0) : false;
                    resolve( { db,isTableExist} );
                }
            });
        });
    })
    //创建BT表,总共就1个表，存储所有结果
    .then(function( arg ){
        let db = arg.db;
        let isTableExist = arg.isTableExist;
        let sql = "CREATE TABLE `all` (" +
            "`id` INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE," +
            "`task` TEXT NOT NULL," +
            "`status` INTEGER DEFAULT 1," +
            "`magnet` TEXT UNIQUE," +
            "`title` TEXT," +
            "`size` TEXT," +
            "`date` DATE," +
            "`infoUrl` TEXT," +
            "`addDate` DATE" +
            ")";
        return new Promise(function(resolve, reject){
            if( isTableExist === false ){
                db.run( sql,[],function(err){
                    if( err ){
                        reject( err );
                    }
                    else{
                        resolve( db );
                    }
                } );
            }
            else{
                resolve( db );
            }
        });
    })
    //初始化完成
    .then( function( db ){
        db.close();
        cb( true );
    } )
    //发生错误
    .catch(function(err){
        db.close();
        cb( false,err );
    });
};
/*
* 导出BT基础结构
* */
E.BT_STRUCT = {
    task: null,
    title: null, //标题
    magnet: null, //磁力链接
    size: 0, //大小
    date: null, //详情页中的bt日期
    infoUrl: null, //详情页
    status: true, //是否有效
    addDate: null, //抓取的日期
};
/*
* 存储多个BT
* 当前bt的存储主要是磁力链接
* bt的数据结构
* {
*   task: "所属任务ID",
*   title: "BT名称",
*   magnet: "BT链接",
* }
* */
E.addBT = function addBT( BTs ){
    let insertTpl = "INSERT INTO `all` (task,magnet,title,size,date,infoUrl,addDate) VALUES ";
    let valueTpl = "('%task%','%magnet%','%title%','%size%','%date%','%infoUrl%','%addDate%')";
    return new Promise(( resolve,reject )=>{
        removeAlreadyExist( BTs ,function( s,res ){
            if( !s ){
                console.error( "removeAlreadyExist err:" ,res);
                return reject( res );
            }
            else{
                BTs = res;
            }
            if( BTs.length === 0 ){
                return resolve( BTs );
            }
            open()
                .then(function( db ){
                    let valueSql = [];
                    for(let i = 0,n = BTs.length; i < n; i++){
                        let BT = BTs[ i ];
                        let value = valueTpl;
                        value = value.replace("%task%",(BT.task));
                        value = value.replace("%magnet%",(BT.magnet));
                        value = value.replace("%title%",(BT.title));
                        value = value.replace("%size%",(BT.size));
                        value = value.replace("%date%",(BT.date));
                        value = value.replace("%infoUrl%",(BT.infoUrl));
                        value = value.replace("%addDate%",dateFormat(new Date(),"yyyy-mm-dd HH:MM:ss"));
                        valueSql.push( value );
                    }
                    db.run( insertTpl + valueSql.join(","),function( err ){
                        db.close();
                        err ? reject(err) :  resolve( BTs );
                    });
                })
                .catch(function( err ){
                    reject( err );
                });
        });
    });
};
/*
* 通过infoUrl去除存在的，防止重复读取相同的infoUrl
* */
E.filterByInfoUrl = function filterByInfoUrl( sources ){
    //复制一份, 加入引号。source是字符
    let querySources = sources.join(",").split(",");
    for(let i = 0,n = querySources.length ; i < n; i++){
        querySources[i] = "'" + querySources[i] + "'";
    }
    let sql = "select infoUrl from `all` where infoUrl in( "+ querySources.join(",") +" ) ";
    let newSources = [];
    return new Promise(function(resolve,reject){
        if( sources.length === 0 ){
            return resolve([]);
        }
        open()
            //查询数据库存在的source，比较差集
            .then(function( db ){
                db.all(sql,[],function( err,rows ){
                    //查询错误，直接返回
                    if( err ){
                        return reject( err );
                    }
                    else{
                        //提取查询的结果，组成数组
                        let existSources = [];
                        for(let i = 0,n = rows.length; i < n; i++){
                            existSources.push( rows[i]['infoUrl'] )
                        }
                        //比较差集
                        for( let i = 0,n = sources.length; i < n; i++ ){
                            let s = sources[i];
                            inArray( existSources,s ) === false ?  newSources.push(s) : null;
                        }
                        db.close();
                        resolve( newSources );
                    }
                });
            })
            //打开数据库失败
            .catch(function( err ){
                db.close();
                reject( err );
            })
    });
};
/*
* 去除已经存在的磁力
* */
function removeAlreadyExist( BTs,cb ){
    let magnetList = _.map( BTs,( BT )=>{ return  BT.magnet; } );
    let queryMagnetList = _.map( BTs,( BT )=>{ return "'" + BT.magnet + "'"; } );
    //复制一份, 加入引号。source是字符
    let sql = "select magnet from `all` where magnet in( "+ queryMagnetList.join(",") +" ) ";
    let newBTs = [];
    if( magnetList.length === 0 ){
        return cb(true,[]);
    }
    open()
    //查询数据库存在的source，比较差集
        .then(function( db ){
            db.all(sql,[],function( err,rows ){
                //查询错误，直接返回
                if( err ){
                    console.error('removeAlreadyExist open err',err);
                    return cb( false,err );
                }
                else{
                    //提取查询的结果，组成数组
                    let existList = {};
                    for(let i = 0,n = rows.length; i < n; i++){
                        existList[ rows[i]['magnet'] ] = true;
                    }
                    //提取出差集BT
                    newBTs = _.filter(BTs,( BT )=>{
                        return existList[ BT.magnet ] !== true;
                    });
                    db.close();
                    cb( true, newBTs );
                }
            });
        })
        //打开数据库失败
        .catch(function( err ){
            db.close();
            cb( false,err );
        })
}
///////////////////
module.exports = E;