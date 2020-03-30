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
	};

	var _vars = {
		outputPath:null,
		downloadPath:null,

		_pagerip:null
	};

	var _methods = {
		init:function(){
			process.on('uncaughtException', _methods._handler_uncaught_exception);

			//Create PageRip instance
			_vars._pagerip = new PageRip({
				addUrlCallback:_methods._handler_addUrl,
				addExternalUrlCallback:_methods._handler_addExternalUrl,
				completeCallback:_methods._handler_complete
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
				pagerip.start();
			} catch (error){
				_methods._displayCommands();
				_instance.exit();
			}
		},

		destroy:function(){
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
			console.log("node ./pagerip-cli.js [path1] [path2] [path-n] [-o [output file path]] [-d [download path]] [-p [default protocol]]");
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

		_handler_addUrl:function(url, urlFlags){
			if (!urlFlags.isExternal){
				console.log("ADDED:", url);
				console.log();
			}
		},

		_handler_complete:function(rootUrls, allUrls, externalUrls){
			if (_instance.outputPath){
				_methods._writeOutputFile(rootUrls, allUrls, externalUrls);
			}
			console.log("COMPLETE!");
			_instance.exit();
		},

		_handler_download:function(url, filePath, contents){
			var fullPath = _instance.downloadPath + filePath;

			console.log("DOWNLOADED URL:", url);
			console.log("SAVING FILE:", fullPath);
			console.log();

			fsExtra.outputFile(fullPath, contents);
		},

		_writeOutputFile:function(rootUrls, allUrls, externalUrls){
			if (!_instance.outputPath){
				return;
			}
			//Note: Currently this writes everything to the file system at the end. However the buffer could overflow so its better to write to file system in chunks during runtime
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