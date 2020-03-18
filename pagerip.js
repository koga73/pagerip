#!/usr/bin/env node

//By: AJ Savino
//Requires NodeJS 12+

const fs = require("fs");
const fetchUrl = require("fetch").fetchUrl;

module.exports = (function(){
	const _consts = {
		NAME:"PageRip",
		VERSION:"1.0.0",

		THREADS:10,
		DEFAULT_OUTPUT:"./output.txt", //If not specified
		DEFAULT_PROTOCOL:"https", //If not specified

		//Crawl if we find a url without an extension or the extension matches
		CRAWL_EXTENSIONS:[
			"html",
			"php",
			"asp",
			"aspx",
			"cshtml",
			"jsp",
			"cgi",
			"css"
		],

		//URL
		REGEX_URL_BASE:/^(([a-z0-9]+)?\:?\/\/)?([^\/\s]+\.[^\/\s]+).*$/i,
		REGEX_URL_CURRENT:/^[a-z0-9]+\:\/\/(([^\/]+)(.+\/)?)/i, //Requires absolute URL
		REGEX_URL_EXTENSION:/^[a-z0-9]+\:\/\/.+\/.+\.([^\.]+?)([?#].*)?$/i, //Requires absolute URL
		REGEX_URL_IS_ABSOLUTE:/^(([a-z0-9]+)?\:\/\/).+$/i,
		REGEX_URL_ACTION:/^([a-z0-9]+\:)(?!\/\/)(.+)$/, //mailto:test@test.com, tel:5555555555
		REGEX_URL_BASIC_AUTH:/^(([a-z0-9]+)?\:?\/\/)?(.+\:.+@)/i, //username:password@example.com

		//Headers
		REGEX_HEADER_CONTENT_TYPE:/^content-type$/i,

		//Mime types
		REGEX_MIME_HTML:/^text\/html\b/i,
		REGEX_MIME_CSS:/^text\/css\b/i,

		//Source parsing
		REGEX_LINK:/<a[\s\S]+?href=['"](.*?)['"]/ig,
		REGEX_STYLE:/<link[\s\S]+?href=['"](.*?)['"]/ig,
		REGEX_SCRIPT:/<script[\s\S]+?src=['"](.*?)['"]/ig,
		REGEX_IMG:/<img[\s\S]+?src=['"](.*?)['"]/ig,
		REGEX_SOURCE_SET:/<source[\s\S]+?srcset=['"](.*?)['"]/ig,
		REGEX_CSS_IMPORT:/@import[\s\S]+?['"](.*?)['"]/ig,
		REGEX_CSS_RESOURCE:/url\(['"]?(.*?)['"]?\)/ig
	}

	var _vars = {
		output:_consts.DEFAULT_OUTPUT,
		rootUrls:[], //URLs specified by user
		crawlQueue:[], //URLs to crawl
		allUrls:[], //URLs found crawling
		externalUrls:[],

		_crawlQueueIndex:0,
		_threads:new Array(_consts.THREADS)
	};

	var _methods = {
		init:function(){
			process.on('uncaughtException', _methods._handler_uncaught_exception);
			process.stdin.on("data", _methods._handler_stdin_data);

			//Parse args
			var args = process.argv;
			var argsLen = args.length;
			//Start at arg 2 to skip node.exe and pagerip.js
			for (var i = 2; i < argsLen; i++){
				var arg = args[i];

				//If does not start with hyphen then treat as URL
				if (!/^-/.test(arg)){
					var baseUrl = _methods._getUrlBase(arg);
					_vars.rootUrls.push(baseUrl);
				}

				//Output
				if (arg == "-o"){
					i++;
					_vars.output = args[i];
				}
			}

			var rootUrlsLen = _vars.rootUrls.length;
			if (!rootUrlsLen){
				_methods._displayCommands();
				_methods.exit();
				return;
			}

			//Init allUrls 2d array
			for (var i = 0; i < rootUrlsLen; i++){
				var rootUrl = _vars.rootUrls[i];
				_vars.rootUrls[i] = _methods._trimBasicAuth(rootUrl);

				_vars.allUrls.push(new Array());
				_methods._addUrl(rootUrl, rootUrl, null); //Should first param be arg ?
			}

			//Crawl URLs
			_methods._crawlNext();
		},

		destroy:function(){
			process.stdin.removeListener("data", _methods._handler_stdin_data);
			process.removeListener('uncaughtException', _methods._handler_uncaught_exception);
		},

		reset:function(){
			_methods.destroy();
			_methods.init();
		},

		exit:function(){
			_methods.destroy();
			process.exit(0);
		},

		//Console input
		_handler_stdin_data:function(data){
			var input = data.toString().trim();
			switch (input){
				case "?":
				default:
					_methods._displayCommands();
					break;
			}
		},

		_displayCommands:function(){
			console.log();
			console.log(_consts.NAME + " " + _consts.VERSION);
			console.log("Usage example: node ./pagerip.js https://www.example.com https://app.example.com -o output.txt");
			console.log();
			console.log();
		},

		_getArg:function(key){
			var index = process.argv.indexOf(key);
			var next = process.argv[index + 1];
			return index < 0 ? null : !next || next[0] === "-" ? true : next;
		},

		_handler_caught_exception:function(error, dontLog){
			dontLog = dontLog === true;

			if (error.isFatal === true){
				_methods.handler_caught_fatal(error);
			} else if (!dontLog){
				console.warn(`CAUGHT ERROR:\n${error}`); //Recoverable
			}
		},

		_handler_uncaught_exception:function(error){
			console.error(`UNCAUGHT FATAL ERROR:\n${error}`);
			process.exit(1); //Uncaught fatal error
		},

		_crawlNext:function(){
			if (_vars._crawlQueueIndex == _vars.crawlQueue.length){
				_methods._complete();
			}
			for (var i = 0; i < _consts.THREADS; i++){
				if (_vars._crawlQueueIndex == _vars.crawlQueue.length){
					break;
				}
				if (!_vars._threads[i]){
					//console.log(_vars._crawlQueueIndex);
					(async function(i){
						_vars._threads[i] = _methods._crawl(_vars.crawlQueue[_vars._crawlQueueIndex]);
						await _vars._threads[i];
						_vars._threads[i] = null;
						//Recurse
						_methods._crawlNext();
					})(i);
					_vars._crawlQueueIndex++;
				}
			}
		},

		_complete:function(){
			//Note: Currently this writes everything to the file system at the end. However the buffer could overflow so its better to write to file system in chunks during runtime
			console.log("Writing file", _vars.output);

			var fileContents = _vars.allUrls.reduce((str, urlArr, index) => {
				var separator = new Array(_vars.rootUrls[index].length).fill("=").join("");
				urlArr.sort();
				return str + `\n${separator}\n` + _vars.rootUrls[index] + `\n${separator}\n\n` + urlArr.reduce((str, url) => {
					return str + url + "\n";
				}, "") + "\n";
			}, "");

			_vars.externalUrls.sort();
			var externalCopy = "EXTERNAL URLS"
			var separator = new Array(externalCopy.length).fill("=").join("");
			fileContents += `\n${separator}\n` + externalCopy + `\n${separator}\n\n` + _vars.externalUrls.reduce((str, url) => {
				return str + url + "\n";
			}, "") + "\n";

			fs.writeFileSync(_vars.output, fileContents);

			_methods.exit();
		},

		_crawl:function(url){
			return new Promise(async (resolve, reject) => {
				console.log("CRAWLING URL:", url);

				//Get response
				var response = await _methods._fetchUrl(url);

				//Parse content-type
				var contentType = null;
				for (var header in response.meta.responseHeaders){
					if (_consts.REGEX_HEADER_CONTENT_TYPE.test(header)){
						contentType = response.meta.responseHeaders[header];
						break;
					}
				}

				//Parse URLs
				var body = response.body;
				body = body.replace(/&#34;/g, '"');
				body = body.replace(/&#39;/g, "'");

				var baseUrl = _methods._getUrlBase(url);
				switch (true){

					//Response is HTML
					case _consts.REGEX_MIME_HTML.test(contentType):
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_LINK), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_STYLE), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_SCRIPT), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_IMG), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_SOURCE_SET), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_CSS_IMPORT), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_CSS_RESOURCE), baseUrl, url);
						break;

					//Response is CSS
					case _consts.REGEX_MIME_CSS.test(contentType):
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_CSS_IMPORT), baseUrl, url);
						_methods._matchesToUrls(body.matchAll(_consts.REGEX_CSS_RESOURCE), baseUrl, url);
						break;

					//Else
					default:
						break;
				}

				resolve();
			});
		},

		_matchesToUrls:function(matchIterator, baseUrl, currentUrl){
			if (!matchIterator){
				return;
			}
			var match = matchIterator.next();
			if (match.value){
				_methods._addUrl(match.value[1], baseUrl, currentUrl);
			}
			if (!match.done){
				_methods._matchesToUrls(matchIterator, baseUrl, currentUrl);
			}
		},

		_addUrl:function(url, baseUrl, currentUrl){
			var rootUrlsLen = _vars.rootUrls.length;

			//Actions like mailto: and tel:
			if (_consts.REGEX_URL_ACTION.test(url)){
				for (var i = 0; i < rootUrlsLen; i++){
					var rootUrl = _vars.rootUrls[i];
					if (baseUrl == rootUrl){

						if (_vars.allUrls[i].indexOf(url) != -1){
							return; //Duplicate
						}
						console.log("ADDING:", url);

						_vars.allUrls[i].push(url);

						break;
					}
				}
				return;
			}

			//Make sure it's absolute
			var absoluteUrl = url;
			if (!_methods._isUrlAbsolute(absoluteUrl)){
				absoluteUrl = _methods._makeUrlAbsolute(absoluteUrl, baseUrl, currentUrl);
			}

			//Add URL
			for (var i = 0; i < rootUrlsLen; i++){
				var rootUrl = _vars.rootUrls[i];
				if (_methods._trimBasicAuth(_methods._getUrlBase(absoluteUrl)) == rootUrl){

					if (_vars.allUrls[i].indexOf(absoluteUrl) != -1){
						return; //Duplicate
					}
					console.log("ADDING:", url);

					_vars.allUrls[i].push(absoluteUrl);

					break;
				}
			}
			//Make sure we stay on our domain
			if (i == rootUrlsLen){
				if (_vars.externalUrls.indexOf(url) == -1){
					_vars.externalUrls.push(url);
				}
				return;
			}

			var urlExtension = _consts.REGEX_URL_EXTENSION.exec(absoluteUrl);
			if (urlExtension){
				urlExtension = urlExtension[1];
			}
			if (!urlExtension || (urlExtension && _consts.CRAWL_EXTENSIONS.indexOf(urlExtension) != -1)){
				//HTML page found, add to crawl queue
				_vars.crawlQueue.push(absoluteUrl);
			}
		},

		_fetchUrl:function(url){
			return new Promise((resolve, reject) => {
				fetchUrl(url, (error, meta, body) => {
					var response = {
						error,
						meta,
						body:body.toString("utf8")
					};
					if (error){
						reject(response);
					} else {
						resolve(response);
					}
				});
			});
		},

		//Pass raw to not assemble
		_getUrlBase:function(url, raw){
			raw = raw === true;

			var match = _consts.REGEX_URL_BASE.exec(url);
			if (match && match.length >= 4){
				if (raw){
					return `${match[1]}${match[3]}`
				} else {
					var protocol = match[2] || _consts.DEFAULT_PROTOCOL;
					return `${protocol}://${match[3]}`;
				}
			} else if (!raw){
				throw new Error("Base URL could not be determined");
			}
		},

		_isUrlAbsolute:function(url){
			return _consts.REGEX_URL_IS_ABSOLUTE.test(url);
		},

		_makeUrlAbsolute:function(relativeUrl, baseUrl, currentUrl){
			var path = _methods._getUrlPath(relativeUrl);
			switch (true){
				//Starts with "." or ".." or "test"
				case /^\./.test(path):
					var currentPathMatch = _consts.REGEX_URL_CURRENT.exec(currentUrl);
					if (currentPathMatch){
						currentUrl = currentPathMatch[0];
					}
					return _methods._concatUrl(currentUrl, path);

				//Starts with /
				case /^\//.test(path):
				default:
					//Use baseUrl from relativeUrl if we can. Otherwise use passed in baseUrl
					if (!baseUrl){
						throw new Error("baseURL undefined");
					}
					try {
						var relativeBaseUrl = _methods._getUrlBase(relativeUrl);
						if (relativeBaseUrl != baseUrl){
							baseUrl = relativeBaseUrl;
						}
					} catch (error){}
					return _methods._concatUrl(baseUrl, path);
			}
		},

		_getUrlPath:function(url){
			return url.replace(_methods._getUrlBase(url, true), "");
		},

		_trimBasicAuth:function(url){
			return url.replace(_consts.REGEX_URL_BASIC_AUTH, "$1");
		},

		_concatUrl:function(host, path){
			var lastChar = host[host.length - 1];
			var firstChar = path[0];
			if (lastChar != "/" && firstChar != "/"){
				return host + "/" + path;
			} else if (lastChar == "/" && firstChar == "/"){
				return host.substr(0, host.length - 1) + path;
			} else {
				return host + path;
			}
		}
	};
	_methods.init();

	return {
		init:_methods.init,
		destroy:_methods.destroy,
		reset:_methods.reset
	};
})();