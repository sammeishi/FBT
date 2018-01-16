module.exports = {
    //数据库
    db:{
        res:{
            path: "./bt.db"
        }
    },
    web:{
        open: true,
        port: 8888,
    },
    //socket代理
    "socketProxy":{
        "local":{
            "ip":"127.0.0.1",
            "port": 7777
        }
    },
    //任务配置
    "tasks":[
        { engine: "sukebei.nyaa.si-hs", key: "丝袜"},
        { engine: "sukebei.nyaa.si-hs", key: "黑丝"},
        { engine: "sukebei.nyaa.si-hs", key: "美腿"},
        { engine: "sukebei.nyaa.si-hs", key: "情趣"},
        { engine: "sukebei.nyaa.si-hs", key: "白丝"}
    ]
};