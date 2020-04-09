#!/usr/bin/env node

//This file contains unit tests for NodeJS

const expect = require('chai').expect;

const PageRip = require("../pagerip.js");

describe("--- REGEX URL ---\n", function(){

	var pagerip = new PageRip({debug:true});

	it("REGEX_URL_BASE", function(){
		let regex = pagerip._consts.REGEX_URL_BASE;

		//True
		expect(regex.test("example.com")).equal(true);
		expect(regex.test("example.com/")).equal(true);
		expect(regex.test("example.com/test/index")).equal(true);
		expect(regex.test("www.example.com")).equal(true);
		expect(regex.test("www.example.com/")).equal(true);
		expect(regex.test("www.example.com/test/index")).equal(true);
		expect(regex.test("//example.com")).equal(true);
		expect(regex.test("//example.com/")).equal(true);
		expect(regex.test("//example.com/test/index")).equal(true);
		expect(regex.test("http://example.com")).equal(true);
		expect(regex.test("http://example.com/")).equal(true);
		expect(regex.test("http://example.com/test/index")).equal(true);
		expect(regex.test("http://www.example.com")).equal(true);
		expect(regex.test("http://www.example.com/")).equal(true);
		expect(regex.test("http://www.example.com/test/index")).equal(true);

		//False
		expect(regex.test("example")).equal(false);
		expect(regex.test("/")).equal(false);
		expect(regex.test("/test/index")).equal(false);
	});

	it("REGEX_URL_CURRENT", function(){
		let regex = pagerip._consts.REGEX_URL_CURRENT;

		//True
		expect(regex.test("http://www.example.com")).equal(true);
		expect(regex.test("http://www.example.com/")).equal(true);
		expect(regex.test("http://www.example.com/test")).equal(true);
		expect(regex.test("http://www.example.com/test/index")).equal(true);
		expect(regex.test("http://www.example.com/test1/test2/index")).equal(true);

		//False
		expect(regex.test("example")).equal(false);
		expect(regex.test("/")).equal(false);
		expect(regex.test("/test/index")).equal(false);
		expect(regex.test("//example.com/test/index")).equal(false);
	});

	it("REGEX_URL_EXTENSION", function(){
		let regex = pagerip._consts.REGEX_URL_EXTENSION;

		//True
		expect(regex.test("http://www.example.com/index.html")).equal(true);
		expect(regex.test("http://www.example.com/test/index.html")).equal(true);

		//False
		expect(regex.test("example.com/index.html")).equal(false);
		expect(regex.test("example.com/test/index.html")).equal(false);
		expect(regex.test("www.example.com/index.html")).equal(false);
		expect(regex.test("www.example.com/test/index.html")).equal(false);
	});

	it("REGEX_URL_IS_ABSOLUTE", function(){
		let regex = pagerip._consts.REGEX_URL_IS_ABSOLUTE;

		//True
		expect(regex.test("http://www.example.com/index.html")).equal(true);
		expect(regex.test("http://www.example.com/test/index.html")).equal(true);

		//False
		expect(regex.test("example.com/index.html")).equal(false);
		expect(regex.test("example.com/test/index.html")).equal(false);
		expect(regex.test("www.example.com/index.html")).equal(false);
		expect(regex.test("www.example.com/test/index.html")).equal(false);
	});

	it("REGEX_URL_ACTION", function(){
		let regex = pagerip._consts.REGEX_URL_ACTION;

		//True
		expect(regex.test("mailto:test@example.com")).equal(true);
		expect(regex.test("tel:5555555555")).equal(true);

		//False
		expect(regex.test("http://www.example.com")).equal(false);
	});

	it("REGEX_URL_BASIC_AUTH", function(){
		let regex = pagerip._consts.REGEX_URL_BASIC_AUTH;

		//True
		expect(regex.test("user:pass@example.com")).equal(true);
		expect(regex.test("user:pass@www.example.com")).equal(true);
		expect(regex.test("//user:pass@example.com")).equal(true);
		expect(regex.test("http://user:pass@example.com")).equal(true);

		//False
		expect(regex.test("example.com")).equal(false);
		expect(regex.test("www.example.com")).equal(false);
		expect(regex.test("http://www.example.com")).equal(false);
	});

	it("REGEX_URL_FULL", function(){
		let regex = pagerip._consts.REGEX_URL_FULL;

		//True
		expect(regex.test("http://example.com")).equal(true);
		expect(regex.test("http://example.com/")).equal(true);
		expect(regex.test("http://example.com/test")).equal(true);
		expect(regex.test("http://example.com/test/index")).equal(true);
		expect(regex.test("http://example.com/test/index.html")).equal(true);
		expect(regex.test("http://example.com/test/index.html?")).equal(true);
		expect(regex.test("http://example.com/test/index.html?q=query")).equal(true);
		expect(regex.test("http://example.com/test/index.html#")).equal(true);
		expect(regex.test("http://example.com/test/index.html#hash")).equal(true);
		expect(regex.test("http://example.com/test/index.html#hash?q=query")).equal(true);
		//False
		expect(regex.test("example.com")).equal(false);
		expect(regex.test("www.example.com")).equal(false);
	});
});

describe("--- REGEX HEADERS ---\n", function(){

	var pagerip = new PageRip({debug:true});

	it("REGEX_HEADER_CONTENT_TYPE", function(){
		let regex = pagerip._consts.REGEX_HEADER_CONTENT_TYPE;

		//True
		expect(regex.test("content-type")).equal(true);

		//False
		expect(regex.test("content-type1")).equal(false);
		expect(regex.test("1content-type")).equal(false);
	});
});

describe("--- REGEX MIME TYPES ---\n", function(){

	var pagerip = new PageRip({debug:true});

	it("REGEX_MIME_HTML", function(){
		let regex = pagerip._consts.REGEX_MIME_HTML;

		//True
		expect(regex.test("text/html")).equal(true);
		expect(regex.test("text/html charset=utf8")).equal(true);
	});

	it("REGEX_MIME_CSS", function(){
		let regex = pagerip._consts.REGEX_MIME_CSS;

		//True
		expect(regex.test("text/css")).equal(true);
		expect(regex.test("text/css charset=utf8")).equal(true);
	});
});

describe("--- REGEX SOURCE PARSING ---\n", function(){

	var pagerip = new PageRip({debug:true});

	it("REGEX_LINK", function(){
		let regex = pagerip._consts.REGEX_LINK;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("<a href='#'></a>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a href='#' class='test'></a>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a class='test' href='#'></a>")).equal(true);

		//False
		regex.lastIndex = 0; //reset
		expect(regex.test("<a></a>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a class='test'></a>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link href='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script src='#'></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<img src='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='#'/>")).equal(false);
	});

	it("REGEX_STYLE", function(){
		let regex = pagerip._consts.REGEX_STYLE;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("<link href='#'/>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link rel='stylesheet' href='#'/>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link href='#' rel='stylesheet'/>")).equal(true);

		//False
		regex.lastIndex = 0; //reset
		expect(regex.test("<link/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link rel='stylesheet'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a href='#'></a>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script src='#'></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<img src='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='#'/>")).equal(false);
	});

	it("REGEX_SCRIPT", function(){
		let regex = pagerip._consts.REGEX_SCRIPT;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("<script src='#'></script>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script type='text/javascript' src='#'></script>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script src='#' id='test'></script>")).equal(true);

		//False
		regex.lastIndex = 0; //reset
		expect(regex.test("<script></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script type='text/css'></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a href='#'></a>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link href='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<img src='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='#'/>")).equal(false);
	});

	it("REGEX_IMG", function(){
		let regex = pagerip._consts.REGEX_IMG;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("<img src='#'/>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<img alt='test' src='#'/>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<img src='#' alt='test'/>")).equal(true);

		//False
		regex.lastIndex = 0; //reset
		expect(regex.test("<img src='data:image'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<img alt='test'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script type='text/css'></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a href='#'></a>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link href='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='#'/>")).equal(false);
	});

	it("REGEX_SOURCE_SET", function(){
		let regex = pagerip._consts.REGEX_SOURCE_SET;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='#'/>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source class='test' srcset='#'/>")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='#' class='test'/>")).equal(true);

		//False
		regex.lastIndex = 0; //reset
		expect(regex.test("<source srcset='data:image'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source class='test'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<source src='#'/>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<script type='text/css'></script>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<a href='#'></a>")).equal(false);
		regex.lastIndex = 0; //reset
		expect(regex.test("<link href='#'/>")).equal(false);
	});

	it("REGEX_CSS_IMPORT", function(){
		let regex = pagerip._consts.REGEX_CSS_IMPORT;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("@import 'test.css';")).equal(true);
	});

	it("REGEX_CSS_RESOURCE", function(){
		let regex = pagerip._consts.REGEX_CSS_RESOURCE;

		//True
		regex.lastIndex = 0; //reset
		expect(regex.test("background:url(test.jpg)")).equal(true);
		regex.lastIndex = 0; //reset
		expect(regex.test("background:url('test.jpg')")).equal(true);
	});
});