//AJ Savino
//Requires NodeJS 12+

const fetch = require("node-fetch");

module.exports = function(params){
	var _instance = null;

	const _consts = {
		THREADS:10,

		//If not specified
		DEFAULT_PAGE:"index",
		DEFAULT_EXTENSION:".html",
		DEFAULT_PROTOCOL:"https", //TODO: Determine protocol automatically from resource?

		//Crawl if we find a url without an extension or the extension matches
		DEFAULT_CRAWL_EXTENSIONS:[
			"html",
			"css",
			"php",
			"asp",
			"aspx",
			"cshtml",
			"jsp",
			"cgi"
		],

		//URL
		REGEX_URL_BASE:/^(([a-z0-9]+)?\:?\/\/)?([^\/\s]+\.[^\/\s]+).*$/i,
		REGEX_URL_CURRENT:/^[a-z0-9]+\:\/\/(([^\/]+)(.+\/)?)/i, //Requires absolute URL
		REGEX_URL_EXTENSION:/^[a-z0-9]+\:\/\/.+\/.+\.([^\.]+?)([?#].*)?$/i, //Requires absolute URL
		REGEX_URL_IS_ABSOLUTE:/^(([a-z0-9]+)?\:\/\/).+$/i,
		REGEX_URL_ACTION:/^([a-z0-9]+\:)(?!\/\/)([^'"]+)$/, //mailto:test@test.com, tel:5555555555
		REGEX_URL_BASIC_AUTH:/^(([a-z0-9]+)?\:?\/\/)?(.+\:.+@)/i, //username:password@example.com
		REGEX_URL_FULL:/^(([a-z0-9]+)\:\/\/)([^\/\s]+\.[^\/\s]+)(.+\/)?([^\.\s]*?(\..+?)?)([?#].*)?$/i, //Requires absolute URL

		//Headers
		REGEX_HEADER_CONTENT_TYPE:/^content-type$/i,

		//Mime types
		REGEX_MIME_HTML:/^text\/html\b/i,
		REGEX_MIME_CSS:/^text\/css\b/i,

		//Source parsing
		REGEX_LINK:/<a[\s\S]+?href=['"]([^'"]*?)['"]/ig,
		REGEX_STYLE:/<link[\s\S]+?href=['"]([^'"]*?)['"]/ig,
		REGEX_SCRIPT:/<script[\s\S]+?src=['"]([^'"]*?)['"]/ig,
		REGEX_IMG:/<img[\s\S]+?src=['"]((?!data:)[^'"]*?)['"]/ig,
		REGEX_SOURCE_SET:/<source[\s\S]+?srcset=['"]([^'"]*?)['"]/ig,
		REGEX_CSS_IMPORT:/@import[\s\S]+?['"]([^'"]*?)['"]/ig,
		REGEX_CSS_RESOURCE:/url\((?!data:)['"]?([^'"]*?)['"]?\)/ig
	};

	var _vars = {
		addUrlCallback:null,
		downloadCallback:null,
		completeCallback:null,

		defaultProtocol:_consts.DEFAULT_PROTOCOL,
		crawlExtensions:_consts.DEFAULT_CRAWL_EXTENSIONS,
		isRunning:false,

		//URLs
		rootUrls:[], //URLs specified by user
		allUrls:[], //URLs found crawling
		externalUrls:[], //URLs pointing to non-root URL domains

		//Private
		_crawlQueue:[], //URLs to crawl
		_crawlQueueIndex:0,
		_downloadQueue:[], //URLs to download
		_downloadQueueIndex:0,
		_threads:new Array(_consts.THREADS)
	};

	var _methods = {
		addUrl:function(absoluteUrl){
			var baseUrl = _methods._getUrlBase(absoluteUrl);
			var baseUrlNoAuth = _methods._trimBasicAuth(baseUrl);
			var absoluteUrlNoAuth = _methods._trimBasicAuth(absoluteUrl);
			_instance.rootUrls.push(baseUrlNoAuth);
			_instance.allUrls.push(new Array());

			_methods._addUrl(absoluteUrlNoAuth, baseUrlNoAuth, null);
		},

		start:function(){
			//Make sure we have minimum parameters specified
			if (!_instance.rootUrls.length){
				throw new Error("Must specify at least one URL to crawl");
			}

			_instance.isRunning = true;
			_methods._crawlNext();
		},

		cancel:function(){
			_instance.isRunning = false;
		},

		_crawlNext:function(){
			if (!_instance.isRunning){
				return;
			}
			//Check completion
			if (_vars._crawlQueueIndex == _vars._crawlQueue.length){
				if (_instance.downloadCallback){
					if (_vars._downloadQueueIndex == _vars._downloadQueue.length){
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
				if (_vars._crawlQueueIndex == _vars._crawlQueue.length){
					if (_instance.downloadCallback){
						if (_vars._downloadQueueIndex < _vars._downloadQueue.length){
							//console.log("_downloadQueueIndex:", _vars._downloadQueueIndex);
							_vars._threads[i] = _methods._download(_vars._downloadQueue[_vars._downloadQueueIndex]);
							_vars._downloadQueueIndex++;
						}
					}
				} else {
					//console.log("_crawlQueueIndex:", _vars._crawlQueueIndex);
					_vars._threads[i] = _methods._crawl(_vars._crawlQueue[_vars._crawlQueueIndex]);
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
			_instance.isRunning = false;

			if (_instance.completeCallback){
				_instance.completeCallback(_instance.rootUrls, _instance.allUrls, _instance.externalUrls);
			}
		},

		//TODO: Add error handling
		_crawl:function(url){
			return new Promise(async (resolve, reject) => {
				//console.log("CRAWLING URL:", url);

				try {
					var response = await _methods._download(url);
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

		_download:function(url){
			return new Promise(async (resolve, reject) => {
				//Get response
				try {
					var response = await _methods._fetchUrl(url);
				} catch (error){
					reject(error);
					return;
				}
				//Save if we have a download path
				if (_instance.downloadCallback){
					var fullUrlMatch = _consts.REGEX_URL_FULL.exec(url);
					if (!fullUrlMatch){
						return;
					}
					var filePath = `${fullUrlMatch[3]}${fullUrlMatch[4] || ""}${fullUrlMatch[5] || "/"}`;
					//Make sure we have a file name
					if (!fullUrlMatch[5] || !/[a-z]/i.test(fullUrlMatch[5])){
						filePath += _consts.DEFAULT_PAGE;
					}
					//Make sure have a file extension
					if (!(fullUrlMatch[6] && fullUrlMatch[6].length)){
						filePath += _consts.DEFAULT_EXTENSION;
					}

					_instance.downloadCallback(url, filePath, response.body);
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
			var rootUrlsLen = _instance.rootUrls.length;

			//Actions like mailto: and tel:
			if (_consts.REGEX_URL_ACTION.test(url)){
				for (var i = 0; i < rootUrlsLen; i++){
					var rootUrl = _instance.rootUrls[i];
					if (baseUrl == rootUrl){

						if (_instance.allUrls[i].indexOf(url) != -1){
							return; //Duplicate
						}
						if (_instance.addUrlCallback){
							_instance.addUrlCallback(url, {
								isAction:true,
								isExternal:false,
								isCrawlable:false
							});
						}

						_instance.allUrls[i].push(url);

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
			var didAdd = false;
			for (var i = 0; i < rootUrlsLen; i++){
				var rootUrl = _instance.rootUrls[i];
				if (_methods._trimBasicAuth(_methods._getUrlBase(absoluteUrl)) == rootUrl){

					if (_instance.allUrls[i].indexOf(absoluteUrl) != -1){
						return; //Duplicate
					}
					didAdd = true;

					_instance.allUrls[i].push(absoluteUrl);

					break;
				}
			}
			//Make sure we stay on our domain
			if (i == rootUrlsLen){
				if (_instance.externalUrls.indexOf(url) == -1){
					_instance.externalUrls.push(url);

					if (_instance.addUrlCallback){
						_instance.addUrlCallback(url, {
							isAction:false,
							isExternal:true,
							isCrawlable:false
						});
					}
				}
				return;
			}

			var urlExtension = _consts.REGEX_URL_EXTENSION.exec(absoluteUrl);
			if (urlExtension){
				urlExtension = urlExtension[1];
			}

			var isCrawlable = false;
			if (!urlExtension || (urlExtension && _instance.crawlExtensions.indexOf(urlExtension) != -1)){
				//HTML page found, add to crawl queue
				_vars._crawlQueue.push(absoluteUrl);
				isCrawlable = true;
			} else if (_vars._downloadQueue){
				_vars._downloadQueue.push(absoluteUrl);
			}

			if (_instance.addUrlCallback && didAdd){
				_instance.addUrlCallback(url, {
					isAction:false,
					isExternal:false,
					isCrawlable:isCrawlable
				});
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
					var protocol = match[2] || _instance.defaultProtocol;
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

	_instance = {
		addUrlCallback:_vars.addUrlCallback,
		downloadCallback:_vars.downloadCallback,
		completeCallback:_vars.completeCallback,

		defaultProtocol:_vars.defaultProtocol,
		crawlExtensions:_vars.crawlExtensions,

		//URLs
		rootUrls:_vars.rootUrls,
		allUrls:_vars.allUrls,
		externalUrls:_vars.externalUrls,

		addUrl:_methods.addUrl,
		start:_methods.start,
		cancel:_methods.cancel
	};
	for (var param in params){
		_instance[param] = params[param];
	}
	return _instance;
};