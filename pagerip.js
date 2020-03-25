#!/usr/bin/env node

//By: AJ Savino
//Requires NodeJS 12+

const fs = require("fs");
const fsExtra = require("fs-extra");
const fetch = require("node-fetch");

module.exports = (function(){
	const _consts = {
		NAME:"PageRip",
		VERSION:"1.0.0",

		THREADS:10,
		DEFAULT_OUTPUT_PATH:"./output.txt", //If not specified
		DEFAULT_DOWNLOAD_PATH:"./download/", //If not specified
		DEFAULT_PAGE:"index", //If not specified
		DEFAULT_EXTENSION:".html", //If not specified

		//TODO: Determine protocol automatically from resource
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
		REGEX_URL_FULL:/^(([a-z0-9]+)\:\/\/)([^\/\s]+\.[^\/\s]+)(.+\/)?([^\.\s]*?(\..+?)?)([?#].*)?$/i, //Requires absolute URL

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
		//Flags
		outputPath:null,
		downloadPath:null,
		defaultProtocol:_consts.DEFAULT_PROTOCOL,

		//URLs
		rootUrls:[], //URLs specified by user
		crawlQueue:[], //URLs to crawl
		downloadQueue:[], //URLs to download
		allUrls:[], //URLs found crawling
		externalUrls:[], //URLs pointing to non-root URL domains

		//Private
		_crawlQueueIndex:0,
		_downloadQueueIndex:0,
		_threads:new Array(_consts.THREADS)
	};

	var _methods = {
		init:function(){
			process.on('uncaughtException', _methods._handler_uncaught_exception);

			//Parse args
			var args = process.argv;
			var argsLen = args.length;
			//Start at arg 2 to skip node.exe and pagerip.js
			for (var i = 2; i < argsLen; i++){
				var arg = args[i];
				switch (arg){
					case "-o": //Output path
						arg = _methods._getArg(i + 1);
						if (arg){
							i++;
							_vars.outputPath = arg;
						} else {
							_vars.outputPath = _consts.DEFAULT_OUTPUT_PATH;
						}
						break;

					case "-d": //Download path
						arg = _methods._getArg(i + 1);
						if (arg){
							i++;
							_vars.downloadPath = arg;
						} else {
							_vars.downloadPath = _consts.DEFAULT_DOWNLOAD_PATH;
						}
						//Make sure path ends with slash
						if (!/\/$/.test(_vars.downloadPath)){
							_vars.downloadPath += "/";
						}
						break;

					case "-p": //Protocol
						arg = _methods._getArg(i + 1);
						if (arg){
							i++;
							_vars.defaultProtocol = arg;
						}
						break;

					default:
						//If does not start with hyphen then treat as URL
						arg = _methods._getArg(i);
						if (arg){
							var baseUrl = _methods._getUrlBase(arg);
							_vars.rootUrls.push(baseUrl);
						}
						break;
				}
			}

			//Make sure we have minimum parameters specified
			var rootUrlsLen = _vars.rootUrls.length;
			if (!rootUrlsLen){
				_methods._displayCommands();
				_methods.exit();
				return;
			}
			if (!_vars.outputPath && !_vars.downloadPath){
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

		_displayCommands:function(){
			console.log();
			console.log(_consts.NAME + " " + _consts.VERSION);
			console.log("Requires NodeJS 12+");
			console.log();
			console.log("node ./pagerip.js [path1] [path2] [path-n] [-o [output file path]] [-d [download path]] [-p [default protocol]]");
			console.log();
			console.log("Usage examples:");
			console.log("    node ./pagerip.js https://www.example.com -o");
			console.log("    node ./pagerip.js https://www.example.com -o ./output.txt");
			console.log("    node ./pagerip.js https://www.example.com -d");
			console.log("    node ./pagerip.js https://www.example.com -d ./download/");
			console.log("    node ./pagerip.js https://www.example1.com https://www.example2.com -o ./output.txt -d ./download/ -p http");
			console.log();
			console.log("-o | output file path          | Default: ./output.txt");
			console.log("-d | download while crawling   | Default: ./download/");
			console.log("-p | default protocol          | Default: https");
			console.log();
		},

		_getArg:function(argIndex){
			if (argIndex >= process.argv.length){
				return null;
			}
			var arg = process.argv[argIndex];
			//If does not start with hyphen then return arg
			if (!/^-/.test(arg)){
				return arg;
			}
			return null;
		},

		_handler_uncaught_exception:function(error){
			console.error("UNCAUGHT FATAL ERROR:\n", error);
			process.exit(1); //Uncaught fatal error
		},

		_handler_caught_exception:function(error){
			console.error("CAUGHT ERROR:\n", error);
		},

		_crawlNext:function(){
			//Check completion
			if (_vars._crawlQueueIndex == _vars.crawlQueue.length){
				if (_vars.downloadPath){
					if (_vars._downloadQueueIndex == _vars.downloadQueue.length){
						_methods._complete();
						return;
					}
				} else {
					_methods._complete();
					return;
				}
			}
			//Loop through threads and do something
			for (var i = 0; i < _consts.THREADS; i++){
				//Thread is busy, skip
				if (_vars._threads[i]){
					continue;
				}
				//We need to check for completion again since an eariler thread may not be complete but a later thread might be
				if (_vars._crawlQueueIndex == _vars.crawlQueue.length){
					if (_vars.downloadPath){
						if (_vars._downloadQueueIndex < _vars.downloadQueue.length){
							//console.log("_downloadQueueIndex:", _vars._downloadQueueIndex);
							_vars._threads[i] = _methods._download(_vars.downloadQueue[_vars._downloadQueueIndex]);
							_vars._downloadQueueIndex++;
						}
					}
				} else {
					//console.log("_crawlQueueIndex:", _vars._crawlQueueIndex);
					_vars._threads[i] = _methods._crawl(_vars.crawlQueue[_vars._crawlQueueIndex]);
					_vars._crawlQueueIndex++;
				}
				//Thread has work, await and recurse
				if (_vars._threads[i]){
					(async function(i){
						try {
							await _vars._threads[i];
						} catch (error){
							_methods._handler_caught_exception(error);
						}
						//Clear to indicate thread is open
						_vars._threads[i] = null;
						//Recurse
						_methods._crawlNext();
					})(i);
				}
			}
		},

		_complete:function(){
			_methods._writeOutputFile();
			_methods.exit();
		},

		_writeOutputFile:function(){
			if (!_vars.outputPath){
				return;
			}
			//Note: Currently this writes everything to the file system at the end. However the buffer could overflow so its better to write to file system in chunks during runtime
			console.log("Writing file", _vars.outputPath);

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

			fs.writeFileSync(_vars.outputPath, fileContents);
		},

		_saveFile:function(url, contents){
			var fullUrlMatch = _consts.REGEX_URL_FULL.exec(url);
			if (!fullUrlMatch){
				return;
			}
			var fullPath = `${_vars.downloadPath}${fullUrlMatch[3]}${fullUrlMatch[4] || ""}${fullUrlMatch[5] || "/"}`;
			//Make sure we have a file name
			if (!fullUrlMatch[5] || !/[a-z]/i.test(fullUrlMatch[5])){
				fullPath += _consts.DEFAULT_PAGE;
			}
			//Make sure have a file extension
			if (!(fullUrlMatch[6] && fullUrlMatch[6].length)){
				fullPath += _consts.DEFAULT_EXTENSION;
			}

			fsExtra.outputFile(fullPath, contents);

			//console.log(url);
			console.log("SAVING FILE:", fullPath);
			//console.log();
		},

		//TODO: Add error handling
		_crawl:function(url){
			return new Promise(async (resolve, reject) => {
				console.log("CRAWLING URL:", url);

				try {
					var response = await _methods._download(url, true); //Suppress log
				} catch (error){
					reject(error);
					return;
				}

				//Parse content-type
				var contentType = null;
				for (var header in response.headers){
					if (_consts.REGEX_HEADER_CONTENT_TYPE.test(header)){
						contentType = response.headers[header];
						break;
					}
				}

				//Parse URLs
				var body = response.body.toString();
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

		_download:function(url, suppressLog){
			suppressLog = suppressLog === true;
			if (!suppressLog){
				console.log("DOWNLOADING URL:", url);
			}

			return new Promise(async (resolve, reject) => {
				//Get response
				try {
					var response = await _methods._fetchUrl(url);
				} catch (error){
					reject(error);
					return;
				}
				//Save if we have a download path
				if (_vars.downloadPath){
					_methods._saveFile(url, response.body);
				}

				resolve(response);
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
			} else if (_vars.downloadQueue){
				_vars.downloadQueue.push(absoluteUrl);
			}
		},

		_fetchUrl:function(url){
			return new Promise((resolve, reject) => {
				fetch(url)
					.then((response) => {
						var headers = response.headers.raw();
						response.buffer().then((buf) => {
							resolve({
								headers:headers,
								body:buf
							});
						});
					})
					.catch(reject);
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
					var protocol = match[2] || _vars.defaultProtocol;
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