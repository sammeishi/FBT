/*
* web服务
* 提供3个http接口：
* 获取指定起始，数量的有效数据
* 批量设置无效
* 获取总量
* */
let gconf = require("./config");
let Promise = require("promise");
let sqlite3 = require("sqlite3");
let fs = require("fs");
let http = require("http");
let port = gconf.web.port;
let url = require('url');
let E = {};
/*
* 启动服务
* */
E.run = function run(){
    http.createServer(function (request, response) {
        let p = url.parse(request.url, true);
        let name = p.pathname.split("/").pop();
        if( !name ){
            name = "index";
        }
        if( name in servers ){
            servers[name]( p.query ,function( content ){
                if( name === "index" ){
                    response.writeHead(200, {'Content-Type': 'text/html'});
                }
                else{
                    response.writeHead(200, {'Content-Type': 'text/plain'});
                }
                response.write( content );
                response.end();
                return true;
            });
        }
        else{
            response.writeHead(404, { "Content-Type": "text/plain" });
            response.end("404 error! File not found.");
        }
    }).listen(port);
    console.log('web listen ',port);
};
/*
* servers
* */
let servers = {
    //输出首页
    index:function( query, cb ){
        fs.readFile('./web/index.html', function (err, data) {
            if (err) {
                cb( err.toString() );
            }
            else{
                cb( data.toString() );
            }
        });
    },
    //统计数量
    count:function( query,cb ){
        let jsonp = query.jsonp || "callback";
        /*
        * 查询数据库
        * */
        open()
            .then(function( db ){
                db.get("select count(*) as res from `all` where status = 1 ",function( err,rows ){
                    if( err ){
                        cb( err.toString() );
                    }
                    else{
                        db.close();
                        cb( jsonp + "(" + JSON.stringify(rows['res']) + ")" );
                    }
                });
            })
            .catch(function( err ){
                db.close();
                cb( err.toString() );
            });
    },
    //统计今天新增
    today:function(query,cb){},
    //设置无效
    disable:function( query,cb ){
        let jsonp = query.jsonp || "callback";
        open()
            .then(function( db ){
                db.all("UPDATE `all` SET status  = 0  WHERE id in("+ query.ids +")",function( err,rows ){
                    if( err ){
                        cb( err.toString() );
                    }
                    else{
                        cb( jsonp + "( true )" );
                    }
                });
            })
            .catch(function( err ){
                cb( err.toString() );
            });
    },
    //查询所有数据
    list:function( query,cb ){
        let start = query.start || 0;
        let size = query.size || 50;
        let jsonp = query.jsonp || "callback";
        open()
            .then(function( db ){
                db.all("select * from `all` where status = 1 ORDER BY id DESC limit "+start+"," + size,function( err,rows ){
                    if( err ){
                        cb( err.toString() );
                    }
                    else{
                        cb( jsonp + "(" + JSON.stringify(rows) + ")" );
                    }
                });
            })
            .catch(function( err ){
                cb( err.toString() );
            });
    }
};

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
        });
    })
}

//////////////////
module.exports = E;