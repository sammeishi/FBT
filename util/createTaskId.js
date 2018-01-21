const _ = require('underscore');
const pinyin = require('pinyin');
module.exports = ( conf )=>{
    let py = pinyin( conf.key ,{ style: pinyin.STYLE_FIRST_LETTER });
    let keyFirstLetter = _.map(py, _.first).join("");
    if( !keyFirstLetter ){
        keyFirstLetter = parseInt(Math.random()*10000000,10)+1;
    }
    return conf.engine + "-" + keyFirstLetter;
};