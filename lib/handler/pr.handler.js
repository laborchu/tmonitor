'use strict';
let path = require('path');
let fs = require('fs');
let chalk = require('chalk');
let _ = require('lodash');
var request = require('request');
const puppeteer = require('puppeteer')
var DingRobot = require('ding-robot');

let Handler = require('./handler');
let Logger = require('../logger');
let Utils = require('../utils');

let PrHandler = module.exports = Handler.extend({
	constructor: function (options) {
		this.options = options;
	}
});



PrHandler.prototype.do = function () {
	PrHandler.__super__.do();
	const stateMap = {
		'open': '待办中',
		'progressing': '进行中',
		'closed': '关闭',
		'rejected': '拒绝',
		'open': '待办中',
	}
	const htmlString =
		`<html>
		<head>
			<title></title>
			<style type="text/css">
				table{
					width: 100%;
					text-align: left;
				}
				thead{
					background-color: #FAFAFA;
				}
				th{
					padding: 8px 5px;
				}
				tr{
					color: #333;
				}
				tr td{
					border-bottom: 1px solid #eee;
					padding: 8px 5px;
				}
				.closed-bg{
					background-color: #B5CE8F;
				}
			</style>
		</head>
		<body>
			<table cellspacing="0" cellpadding="0">
				<thead>
					<tr>
						<th style="width: 80px">所属项目</th>
						<th>PR标题</th>
						<th>审核人</th>
						<th style="width: 80px">状态</th>
					</tr>
				</thead>
				<tbody>
					#{tr}
				</tbody>
			</table>
		</body>
	</html>`;
	let projects = this.options.projects;
	let projectArray = projects.split(',');
	for (let project of projectArray) {
		this.getPR(project).then((prArray) => {
			if (!prArray.length) {
				return;
			}
			prArray.sort((a, b) => {
				if (a.repo.name > b.repo.name) {
					return 1;
				} else if (a.repo.name < b.repo.name) {
					return -1;
				}
				return 0;
			})
			let trs = "";
			for (let pr of prArray) {
				let assigneeName = ""
				for (let assignee of pr.assignees) {
					assigneeName += assignee.name + " ";
				}
				let tr = `<tr>`;
				tr += `<td>${project}</td>`;
				tr += `<td>${pr.title}</td>`;
				tr += `<td>${assigneeName}</td>`;
				tr += `<td>${pr.state}</td>`;
				tr += `</tr>`;
				trs += tr;
			}
			let html = htmlString.replace('#{tr}', trs);
			(async () => {
				let fileName = `${new Date().getTime()}-${project}.png`;
				const browser = await puppeteer.launch()
				const page = await browser.newPage()
				await page.setContent(html)
				await page.screenshot({ path: fileName, fullPage: true })
				await browser.close();
				this.sendMsg(project, fileName)
			})();
		})
	}

};

PrHandler.prototype.getPR = function (project) {
	let milestoneUrl = `https://gitee.com/api/v5/repos/bc-mall/${project}/pulls?access_token=${this.options.gtoken}&state=open&sort=created&direction=desc&page=1&per_page=100`;
	return new Promise((resolve, reject) => {
		request(milestoneUrl, (error, response, body) => {
			if (error) reject(error);
			if (response.statusCode != 200) {
				reject('Invalid status code <' + response.statusCode + '>');
			}
			let issueArray = JSON.parse(body);
			resolve(issueArray);
		});
	});
}

PrHandler.prototype.sendMsg = function (project, fileName) {
	var robot = new DingRobot(this.options.dtoken);
	robot.markdown(project, `# ${project}\n` +
		`![screenshot](http://tmonitor.tysu.com.cn/images/${fileName})\n` +
		"###### 截止当前还未审核的，请审核人员尽快审核 \n"
	);
}