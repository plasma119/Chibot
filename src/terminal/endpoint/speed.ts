import WebSocket from 'ws';

/**
 * ... I think this is speed test for client(browser) to server using websocket
 */

var http = require('http');
var ws = require('ws');

var server = http.createServer(function (
    req: { method: string; url: string },
    res: { writeHead: (arg0: number, arg1: { 'Content-Type': string }) => void; end: (arg0: string) => void }
) {
    console.log(req.method + ' ' + req.url);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
        '\
    <script>\
      window.onload = function() {\
        var ws = new WebSocket("ws://" + location.hostname + ":8001/");\
        function log(text) {\
          document.body.appendChild(document.createTextNode(text));\
          document.body.appendChild(document.createElement("br"));\
        }\
        log("connecting to " + ws.URL);\
        ws.onopen = function() {\
          log("connected");\
        };\
        ws.onclose = function(e) {\
          log("disconnected");\
        };\
        ws.onmessage = function(e) {\
          var text = "got " + (e.data.size / (1024 * 1024)).toFixed(3) + " MB";\
          ws.send(text);\
          log(text);\
        };\
      };\
    </script>\
  '
    );
});

console.log('listening on port 8000');
server.listen(8000);

var wss = new ws.Server({ port: 8001 });
wss.on('connection', function (ws: WebSocket) {
    var onmessage = (data: string) => {
        console.log(data);
    };
    ws.on('message', function (data) {
        onmessage(data.toString());
    });
    function test(sizeInMB: number, callback: { (): void; (...args: any[]): void }) {
        var data = new Uint8Array(sizeInMB * 1024 * 1024);
        for (var j = 0; j < data.length; j++) {
            data[j] = 32 + Math.random() * 95;
        }
        var sendStart = Date.now();
        var sendTime: number;
        console.log('sending ' + sizeInMB.toFixed(3) + ' MB');
        onmessage = function (data: string) {
            var totalTime = (Date.now() - sendStart) / 1000;
            console.log(data + ', took ' + totalTime.toFixed(3) + ' seconds');
            times.push({ sizeInMB: sizeInMB, sendTime: sendTime, totalTime: totalTime });
            setTimeout(callback, 500);
        };
        ws.send(data, function () {
            sendTime = (Date.now() - sendStart) / 1000;
            console.log('sent ' + sizeInMB.toFixed(3) + ' MB, took ' + sendTime.toFixed(3) + ' seconds');
        });
    }
    var times: { sizeInMB: any; sendTime: any; totalTime: number }[] = [];
    var i = 0;
    function next() {
        i += 0.5;
        if (i > 5) done();
        else test(i, next);
    }
    function done() {
        console.log('sizeInMB\tsendTime\ttotalTime');
        for (var i = 0; i < times.length; i++) {
            console.log(times[i].sizeInMB + '\t' + times[i].sendTime + '\t' + times[i].totalTime);
        }
    }
    setTimeout(next, 500);
});
