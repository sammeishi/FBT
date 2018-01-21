const _ = require("underscore");

let rules = [
    '字幕', '中文','一本道','加勒比','东京热','一本到','の','日本','AV','av',
    'ス','ト',
    'ッ','キ','ン','グ',
    'ジ','ュ','リ','ア'
];

module.exports = ( BTs ) => {
    return _.filter( BTs,function( BT ){
        if( !_.isString( BT.title ) ){
            return true;
        }
        for(let i  in rules){
            let rule = rules[i];
            if( _.isString( rule ) ){
                if( BT.title.indexOf( rule ) !== -1 ){
                    return false;
                }
            }
            else if( _.isFunction( rule ) ) {
                if( !(BT.title ? rule( BT.title ) : true) ){
                    return false;
                }
            }
        }
        return true;
    } );
};