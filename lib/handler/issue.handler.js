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

let IssueHandler = module.exports = Handler.extend({
	constructor: function (options) {
		this.options = options;
	}
});



IssueHandler.prototype.do = function () {
	IssueHandler.__super__.do();
	const stateMap = {
		'open': '待办中',
		'progressing': '进行中',
		'closed': '关闭',
		'rejected': '拒绝',
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
				.progressing-bg{
					background-color: #FCC600;
				}
				.rejected-bg{
					background-color: #FF4444;
				}
			</style>
		</head>
		<body>
			<table cellspacing="0" cellpadding="0">
				<thead>
					<tr>
						<th style="width: 80px">编号</th>
						<th>任务名称</th>
						<th style="width: 80px">负责人</th>
						<th style="width: 80px">状态</th>
					</tr>
				</thead>
				<tbody>
					#{tr}
				</tbody>
			</table>
		</body>
	</html>`;

	IssueHandler.__super__.getGiteeToken().then((token)=>{
		this.options.gtoken = token;
		this.getMilestone().then((milestoneArray) => {
			for (let milestone of milestoneArray) {
				this.getIssues(milestone).then((issueArray) => {
					if (!issueArray.length) {
						return;
					}
					issueArray.sort((a, b) => {
						if (a.assignee.name > b.assignee.name) {
							return 1;
						} else if (a.assignee.name < b.assignee.name) {
							return -1;
						}
						return 0;
					})
					let trs = "";
					for (let issue of issueArray) {
						let tr = `<tr class='${issue.state}-bg'>`;
						tr += `<td>${issue.number}</td>`;
						tr += `<td>${issue.title}</td>`;
						tr += `<td>${issue.assignee.name}</td>`;
						tr += `<td>${stateMap[issue.state]}</td>`;
						tr += `</tr>`;
						trs += tr;
					}
					let html = htmlString.replace('#{tr}', trs);
					(async () => {
						let fileName = `${new Date().getTime()}-${milestone.number}.png`;
						const browser = await puppeteer.launch()
						const page = await browser.newPage()
						await page.setContent(html)
						await page.screenshot({ path: fileName, fullPage: true })
						await browser.close();
						this.sendMsg(milestone, fileName)
					})();
				});
			}
		})
	});
};


IssueHandler.prototype.getMilestone = function () {
	let milestoneUrl = `https://gitee.com/api/v5/repos/${this.options.repo}/milestones?access_token=${this.options.gtoken}&state=open&sort=due_on&page=1&per_page=100`;
	return new Promise((resolve, reject) => {
		request(milestoneUrl, (error, response, body) => {
			if (error) reject(error);
			if (response.statusCode != 200) {
				reject('Invalid status code <' + response.statusCode + '>');
			}
			let milestoneArray = JSON.parse(body);
			let productMilestoneArray = [];
			for (let milestone of milestoneArray) {
				if (this.options.title) {
					if (milestone.title.indexOf(this.options.title) != -1) {
						productMilestoneArray.push(milestone);
					}
				} else {
					productMilestoneArray.push(milestone);
				}
			}
			resolve(productMilestoneArray);
		});
	});
}

IssueHandler.prototype.getIssues = function (milestone) {
	let milestoneUrl = `https://gitee.com/api/v5/repos/${this.options.repo}/issues?access_token=${this.options.gtoken}&state=all&sort=created&direction=desc&page=1&per_page=100&milestone=${encodeURIComponent(milestone.title)}`;
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

IssueHandler.prototype.sendMsg = function (milestone, fileName) {
	var robot = new DingRobot(this.options.dtoken);
	robot.markdown(milestone.title, `# ${milestone.title}\n` +
		`![screenshot](http://tmonitor.tysu.com.cn/images/${fileName})\n` +
		"###### 截止当前完成情况，请注意进度 \n"
	);
}