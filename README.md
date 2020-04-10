# pagerip
A web crawler that lists or downloads resources

## CLI Usage
Without global install:
```
npx pagerip https://www.example.com -o -d
```

With global install:
```
npm i -g pagerip
pagerip https://www.example.com -o -d
```

## CLI Options:
```
node ./pagerip-cli.js [path1] [path2] [path-n] [-o [output file path]] [-d [download path]] [-p [default protocol]] [-c [crawl extensions]] [-i]

Usage examples:
    node ./pagerip.js https://www.example.com -o
    node ./pagerip.js https://www.example.com -o ./output.txt
    node ./pagerip.js https://www.example.com -d
    node ./pagerip.js https://www.example.com -d ./download/
    node ./pagerip.js https://www.example1.com https://www.example2.com -o ./output.txt -d ./download/ -p http -c html,css -i

-o | output file path                   | Default: ./output.txt
-d | download while crawling            | Default: ./download/
-p | default protocol if undefined      | Default: https
-c | crawl url matching extensions      | Default: html,css,php,asp,aspx,cshtml,jsp,cgi
-i | ignore certificate errors          | Default: false
```

### JS usage
```
npm i pagerip
```

```javascript
const PageRip = require("pagerip");

//All callbacks are optional
var pagerip = new PageRip({
	addUrlCallback: addCallback,
	crawlCallback: crawlCallback,
	crawlCallback: downloadCallback,
	completeCallback: completeCallback,
	errorCallback: errorCallback
});
pagerip.addUrl("https://www.example.com");
pagerip.start();

//Called when a URL is added
function addCallback(url, urlFlags, threadIndex){
	//url is String
	//urlFlags is Object { isAction:Boolean, isExternal:Boolean, isCrawlable:Boolean} "action" is like "tel:5555555555"
	//threadIndex is Number
}

//Called when a URL is crawled
function crawlCallback(url, threadIndex){
	//url is String
	//threadIndex is Number
}

//Called when a URL is downloaded
function downloadCallback(url, filePath, contents, threadIndex){
	//url is String
	//filePath is String of relative filePath generated from url
	//contents is Buffer of response body
	//threadIndex is Number
}

//Called when crawling is complete
function completeCallback(rootUrls, allUrls, externalUrls){
	//rootUrls is Array
	//allUrls is Array[Array]
	//externalUrls is Array[Array]
}

//Called when an error occurs
function errorCallback(error){
	//error is Error with two optional attributes "url" and "fromPage"
}
```

#### Full API
```javascript
var pagerip = new PageRip({
	debug:true, //Exposes private methods and constants via public instance
	threads:10, //Number of threads for crawl/download queues - This can ONLY be set on initialization

	addUrlCallback: addCallback,		//Called when a URL is added
	crawlCallback: crawlCallback,		//Called when a URL is crawled
	crawlCallback: downloadCallback,	//Called when a URL is downloaded
	completeCallback: completeCallback,	//Called when crawling is complete
	errorCallback: errorCallback,		//Called when an error occurs
	
	defaultProtocol:"https"
	//Crawl URLs with the following extensions (in addition to no extension)
	crawlExtensions:[
		"html",
		"css",
		"php",
		"asp",
		"aspx",
		"cshtml",
		"jsp",
		"cgi"
	]
});

pagerip.addUrl("https://www.example.com");
pagerip.start();
pagerip.cancel();
pagerip.ignoreCertificates();

//Array of root URLs, you probably don't need to modify this
pagerip.rootUrls
//Array of all URLs, you don't need to modify this but use as a getter
pagerip.allUrls
//Array of external URLs, you don't need to modify this but use as a getter
pagerip.externalUrls
```