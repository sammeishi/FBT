/*
* 存储BT结果，基于sqli3数据库，会被多线程使用
* 1: 保证数据库以及所有表存在
* 2：提供结果存储-查询接口
* */
let gconf = require("../config.js");
let Promise = require('promise');
let sqlite3 = require("sqlite3");
let E = {};
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
            "`title` TEXT," +
            "`source` TEXT," +
            "`magnet` TEXT NOT NULL," +
            "`date` INTEGER" +
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
* 存储多个BT
* 当前bt的存储主要是磁力链接
* bt的数据结构
* {
*   task: "所属任务ID",
*   title: "BT名称",
*   magnet: "BT链接",
* }
* */
E.addBT = function addBT( BTs,cb ){
    let insertTpl = "INSERT INTO `all` (task,title,source,magnet,date) VALUES ";
    let valueTpl = "('%task%','%title%','%source%','%magnet%','%date%')";
    open()
        .then(function( db ){
            let valueSql = [];
            for(let i = 0,n = BTs.length; i < n; i++){
                let BT = BTs[ i ];
                let value = valueTpl;
                value = value.replace("%task%",BT.task);
                value = value.replace("%title%",BT.title);
                value = value.replace("%source%",BT.source);
                value = value.replace("%magnet%",BT.magnet);
                value = value.replace("%date%",(new Date()).valueOf());
                valueSql.push( value );
            }
            db.run( insertTpl + valueSql.join(","),function( err ){
                if( err ){
                    console.log( "add BT error: ",err );
                }
                db.close();
                cb( true );
            });
        })
        .catch(function( err ){
            console.log('open error!',err);
            db.close();
            cb( false );
        });
};
/*
* 通过来源字段过滤BT
* source = 数组
* */
E.filterBySource = function filterBySource( sources ){
    //复制一份, 加入引号。source是字符
    let querySources = sources.join(",").split(",");
    for(let i = 0,n = querySources.length ; i < n; i++){
        querySources[i] = "'" + querySources[i] + "'";
    }
    let sql = "select source from `all` where source in( "+ querySources.join(",") +" ) ";
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
                            existSources.push( rows[i]['source'] )
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
///////////////////
module.exports = E;