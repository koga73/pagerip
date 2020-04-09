#!/usr/bin/env node

//By: AJ Savino
//Requires NodeJS 12+

const fs = require("fs");
const fsExtra = require("fs-extra");
const PageRip = require("./pagerip.js");

module.exports = (function(params){
	var _instance = null;

	const _consts = {
		NAME:"PageRip",
		VERSION:"1.0.0",

		DEFAULT_OUTPUT_PATH:"./output.txt", //If not specified
		DEFAULT_DOWNLOAD_PATH:"./download/", //If not specified

		CONSOLE_UPDATE_INTERVAL:250 //ms
	};

	var _vars = {
		outputPath:null,
		downloadPath:null,

		_pagerip:null,

		_consoleUpdateInverval:0,
		_consoleOutput:{
			threads:[],
			urlCount:0,
			externalUrlCount:0,
			crawlCount:0,
			downloadCount:0,
			errorCount:0,
			firstUpdate:true,
			lastError:null
		}
	};

	var _methods = {
		init:function(){
			process.on('uncaughtException', _methods._handler_uncaught_exception);

			//Create PageRip instance
			_vars._pagerip = new PageRip({
				addUrlCallback:_methods._handler_addUrl,
				crawlCallback:_methods._handler_crawl,
				completeCallback:_methods._handler_complete,
				errorCallback:_methods._handler_caught_exception
			});
			var pagerip = _vars._pagerip;

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
							_instance.outputPath = arg;
						} else {
							_instance.outputPath = _consts.DEFAULT_OUTPUT_PATH;
						}
						break;

					case "-d": //Download path
						arg = _methods._getArg(i + 1);
						if (arg){
							i++;
							_instance.downloadPath = arg;
						} else {
							_instance.downloadPath = _consts.DEFAULT_DOWNLOAD_PATH;
						}
						//Make sure path ends with slash
						if (!/\/$/.test(_instance.downloadPath)){
							_instance.downloadPath += "/";
						}
						pagerip.downloadCallback = _methods._handler_download;
						break;

					case "-p": //Protocol
						arg = _methods._getArg(i + 1);
						if (arg){
							i++;
							pagerip.defaultProtocol = arg;
						}
						break;

					case "-c": //Crawl extensions
						arg = _methods._getArg(i + 1);
						if (arg){
							i++;
							pagerip.crawlExtensions = arg.split(',');
						}
						break;

					case "-i": //Ignore certificate
						pagerip.ignoreCertificates();
						break;

					default:
						//If does not start with hyphen then treat as URL
						arg = _methods._getArg(i);
						if (arg){
							pagerip.addUrl(arg);
						}
						break;
				}
			}

			try {
				_consoleUpdateInverval = setInterval(_methods._handler_console_update, _consts.CONSOLE_UPDATE_INTERVAL);

				pagerip.start();
			} catch (error){
				_methods._displayCommands();
				_instance.exit();
			}
		},

		destroy:function(){
			if (_vars._consoleUpdateInverval){
				clearInterval(_vars._consoleUpdateInverval);
			}

			if (_vars._pagerip){
				_vars._pagerip.cancel();
				_vars._pagerip = null;
			}

			process.removeListener('uncaughtException', _methods._handler_uncaught_exception);
		},

		reset:function(){
			_instance.destroy();
			_instance.init();
		},

		exit:function(){
			_instance.destroy();
			process.exit(0);
		},

		_displayCommands:function(){
			console.log();
			console.log(_consts.NAME + " " + _consts.VERSION);
			console.log("Requires NodeJS 12+");
			console.log();
			console.log("node ./pagerip-cli.js [path1] [path2] [path-n] [-o [output file path]] [-d [download path]] [-p [default protocol]] [-c [crawl extensions]] [-i]");
			console.log();
			console.log("Usage examples:");
			console.log("    node ./pagerip.js https://www.example.com -o");
			console.log("    node ./pagerip.js https://www.example.com -o ./output.txt");
			console.log("    node ./pagerip.js https://www.example.com -d");
			console.log("    node ./pagerip.js https://www.example.com -d ./download/");
			console.log("    node ./pagerip.js https://www.example1.com https://www.example2.com -o ./output.txt -d ./download/ -p http -c html,css -i");
			console.log();
			console.log("-o | output file path                   | Default: ./output.txt");
			console.log("-d | download while crawling            | Default: ./download/");
			console.log("-p | default protocol if undefined      | Default: https");
			console.log("-c | crawl url matching extensions      | Default: html,css,php,asp,aspx,cshtml,jsp,cgi");
			console.log("-i | ignore certificate errors          | Default: false");
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
			_vars._consoleOutput.errorCount++;
			_vars._consoleOutput.lastError = error;
		},

		_handler_addUrl:function(url, urlFlags, threadIndex){
			if (urlFlags.isExternal){
				_vars._consoleOutput.externalUrlCount++;
				if (threadIndex != null){
					_vars._consoleOutput.threads[threadIndex] = `FOUND | ${url}`;
				}
			} else {
				_vars._consoleOutput.urlCount++;
				if (threadIndex != null){
					_vars._consoleOutput.threads[threadIndex] = `ADDED | ${url}`;
				}
			}
		},

		_handler_complete:function(rootUrls, allUrls, externalUrls){
			clearInterval(_vars._consoleUpdateInverval);
			_methods._handler_console_update();

			if (_instance.outputPath){
				_methods._writeOutputFile(rootUrls, allUrls, externalUrls);
			}
			console.log("COMPLETE!");
			_instance.exit();
		},

		_handler_crawl:function(url, threadIndex){
			_vars._consoleOutput.crawlCount++;
			if (threadIndex != null){
				_vars._consoleOutput.threads[threadIndex] = `CRAWLING | ${url}`;
			}
		},

		_handler_download:function(url, filePath, contents, threadIndex){
			var fullPath = _instance.downloadPath + filePath;
			fsExtra.outputFile(fullPath, contents);


			_vars._consoleOutput.downloadCount++;
			if (threadIndex != null){
				_vars._consoleOutput.threads[threadIndex] = `DOWNLOADED | ${url}`;
			}
		},

		_writeOutputFile:function(rootUrls, allUrls, externalUrls){
			if (!_instance.outputPath){
				return;
			}
			//Note: Currently this writes everything to the file system at the end. However the buffer could overflow so its better to write to file system in chunks during runtime
			console.log();
			console.log("Writing file", _instance.outputPath);

			var fileContents = allUrls.reduce((str, urlArr, index) => {
				var separator = new Array(rootUrls[index].length).fill("=").join("");
				urlArr.sort();
				return str + `\n${separator}\n` + rootUrls[index] + `\n${separator}\n\n` + urlArr.reduce((str, url) => {
					return str + url + "\n";
				}, "") + "\n";
			}, "");

			externalUrls.sort();
			var externalCopy = "EXTERNAL URLS"
			var separator = new Array(externalCopy.length).fill("=").join("");
			fileContents += `\n${separator}\n` + externalCopy + `\n${separator}\n\n` + externalUrls.reduce((str, url) => {
				return str + url + "\n";
			}, "") + "\n";

			fs.writeFileSync(_instance.outputPath, fileContents);
		},

		//Write latest status to console
		_handler_console_update:function(){
			//return;

			console.clear();

			console.log();
			console.log("--- STATUS ---");
			console.log();
			var threadsLen = _vars._consoleOutput.threads.length;
			for (var i = 0; i < threadsLen; i++){
				var threadStatus = _vars._consoleOutput.threads[i];
				if (threadStatus){
					console.log(`thread[${i}] | ${_vars._consoleOutput.threads[i]}`);
				} else {
					console.log(`thread[${i}] | Empty`);
				}
			}

			console.log();
			console.log("--- SUMMARY ---");
			console.log();
			console.log("Crawled URLs:", _vars._consoleOutput.crawlCount);
			console.log("Internal URLs:", _vars._consoleOutput.urlCount);
			console.log("External URLs:", _vars._consoleOutput.externalUrlCount);
			console.log("Downloaded files:", _vars._consoleOutput.downloadCount);
			console.log("Errors:", _vars._consoleOutput.errorCount);

			if (_vars._consoleOutput.lastError){
				console.log();
				console.log("--- LAST ERROR ---");
				console.log();
				if (_vars._consoleOutput.lastError.fromPage){
					console.log("Found in source:", _vars._consoleOutput.lastError.fromPage);
				}
				if (_vars._consoleOutput.lastError.url){
					console.log("Url:", _vars._consoleOutput.lastError.url);
				}
				console.error(_vars._consoleOutput.lastError);
			}
		}
	};

	_instance = {
		outputPath:null,
		downloadPath:null,

		init:_methods.init,
		destroy:_methods.destroy,
		reset:_methods.reset,
		exit:_methods.exit
	};
	for (var param in params){
		_instance[param] = params[param];
	}
	_instance.init();
	return _instance;
})();