# pagerip
A web crawler that lists or downloads resources

CLI Example:
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
-i | ignore certificate errors      	 | Default: false
```