'use strict';
var request = require('request');

var Handler = module.exports = function(){

};
Handler.prototype.do = function(){
};

Handler.prototype.getGiteeToken = function(){
    return new Promise((resolve, reject) => {
		request("http://tmonitor.tysu.com.cn/token.json", (error, response, body) => {
			if (error) reject(error);
			if (response.statusCode != 200) {
				reject('Invalid status code <' + response.statusCode + '>');
			}
			let data = JSON.parse(body);
			resolve(data.access_token);
		});
	});
};
Handler.extend = require('class-extend').extend;